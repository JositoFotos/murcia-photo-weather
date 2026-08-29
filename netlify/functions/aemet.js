const AEMET_BASE_URL = 'https://opendata.aemet.es/opendata/api';

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

function isAllowedPath(path) {
  return /^\/prediccion\/especifica\/municipio\/(diaria|horaria)\/\d{5}$/.test(path);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'GET') return json(405, { error: 'Método no permitido.' });

  const path = String(event.queryStringParameters?.path ?? '').trim();
  const apiKey = String(process.env.AEMET_API_KEY ?? '').trim();

  if (!apiKey) return json(500, { error: 'El secreto AEMET_API_KEY no está configurado en Netlify.' });
  if (!isAllowedPath(path)) return json(400, { error: 'Endpoint AEMET no permitido.' });

  try {
    const firstUrl = `${AEMET_BASE_URL}${path}?api_key=${encodeURIComponent(apiKey)}`;
    const firstResponse = await fetch(firstUrl, { headers: { Accept: 'application/json' } });
    const firstText = await firstResponse.text();
    let envelope;
    try { envelope = JSON.parse(firstText); } catch { return json(502, { error: 'AEMET devolvió una respuesta no JSON.' }); }

    if (!firstResponse.ok || Number(envelope?.estado) !== 200 || typeof envelope?.datos !== 'string') {
      return json(firstResponse.status || 502, {
        error: envelope?.descripcion || `AEMET respondió con HTTP ${firstResponse.status}.`
      });
    }

    const secondResponse = await fetch(envelope.datos, { headers: { Accept: 'application/json' } });
    const secondText = await secondResponse.text();
    let data;
    try { data = JSON.parse(secondText); } catch { return json(502, { error: 'AEMET devolvió datos que no son JSON válido.' }); }

    if (!secondResponse.ok) return json(secondResponse.status || 502, { error: `AEMET respondió con HTTP ${secondResponse.status}.` });
    return json(200, data);
  } catch (error) {
    return json(502, { error: `No se pudo consultar AEMET: ${error?.message || 'error de red'}` });
  }
};
