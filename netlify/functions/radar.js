const AEMET_BASE_URL = 'https://opendata.aemet.es/opendata/api';

function response(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Access-Control-Max-Age': '86400',
      'Cache-Control': 'public, max-age=300',
      'Vary': 'Origin',
      'Content-Type': 'application/json; charset=utf-8',
      ...headers
    },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  };
}

exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return response(204, '');
  if (event.httpMethod !== 'GET') return response(405, { error: 'Método no permitido.' });

  const apiKey = String(process.env.AEMET_API_KEY ?? '').trim();
  if (!apiKey) return response(500, { error: 'El secreto AEMET_API_KEY no está configurado en Netlify.' });

  const radar = String(event.queryStringParameters?.radar ?? 'mu').trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(radar)) return response(400, { error: 'Código de radar no válido.' });

  try {
    const firstUrl = `${AEMET_BASE_URL}/red/radar/regional/${encodeURIComponent(radar)}`;
    const first = await fetch(firstUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        api_key: apiKey
      },
      signal: AbortSignal.timeout(12000)
    });

    const envelopeText = await first.text();
    let envelope;
    try { envelope = JSON.parse(envelopeText); }
    catch {
      return response(502, { error: 'AEMET devolvió una respuesta no JSON.' });
    }

    if (!first.ok || Number(envelope?.estado) !== 200 || typeof envelope?.datos !== 'string') {
      return response(first.status || 502, {
        error: envelope?.descripcion || `AEMET respondió con HTTP ${first.status}.`
      });
    }

    return response(200, {
      imageUrl: envelope.datos,
      fetchedAt: new Date().toISOString(),
      radar
    });
  } catch (error) {
    return response(502, {
      error: `No se pudo resolver el radar de AEMET: ${error?.message || 'error de red'}`
    });
  }
};
