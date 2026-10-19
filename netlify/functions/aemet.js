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

// AEMET can return HTTP 200 while reporting the real status in its JSON envelope.
function upstreamStatus(response, payload, fallback = 502) {
  if (response && !response.ok && Number.isInteger(response.status)) return response.status;
  const status = Number(payload?.estado);
  if (Number.isInteger(status) && status >= 400 && status <= 599) return status;
  return fallback;
}

function hasForecastShape(data) {
  const rows = Array.isArray(data) ? data : [data];
  return rows.some(row => Array.isArray(row?.prediccion?.dia));
}

async function fetchTextWithTimeout(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    const text = await response.text();
    return { response, text };
  } finally { clearTimeout(timer); }
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
    const { response:firstResponse, text:firstText } = await fetchTextWithTimeout(firstUrl);
    let envelope;
    try { envelope = JSON.parse(firstText); } catch { return json(502, { error: 'AEMET devolvió una respuesta no JSON.' }); }

    if (!firstResponse.ok || Number(envelope?.estado) !== 200 || typeof envelope?.datos !== 'string') {
      const status = upstreamStatus(firstResponse, envelope);
      const message = envelope?.descripcion || envelope?.error || `AEMET respondió con HTTP ${status}.`;
      return json(status, { error: message, code: status === 401 || status === 403 ? 'AEMET_UNAUTHORIZED' : status === 429 ? 'AEMET_RATE_LIMIT' : 'AEMET_UPSTREAM_ERROR', upstreamStatus: status }, status === 429 ? { 'Retry-After': firstResponse.headers.get('Retry-After') || '5' } : {});
    }

    const { response:secondResponse, text:secondText } = await fetchTextWithTimeout(envelope.datos);
    let data;
    try { data = JSON.parse(secondText); } catch { return json(502, { error: 'AEMET devolvió datos que no son JSON válido.', code: 'AEMET_INVALID_JSON' }); }

    if (!secondResponse.ok) {
      const status = upstreamStatus(secondResponse, data);
      return json(status, { error: data?.descripcion || data?.error || `AEMET respondió con HTTP ${status}.`, code: status === 401 || status === 403 ? 'AEMET_UNAUTHORIZED' : status === 429 ? 'AEMET_RATE_LIMIT' : 'AEMET_UPSTREAM_ERROR', upstreamStatus: status }, status === 429 ? { 'Retry-After': secondResponse.headers.get('Retry-After') || '5' } : {});
    }

    // Defensive check: sometimes an upstream error is returned as JSON with HTTP 200.
    const reportedStatus = Number(data?.estado);
    if (!hasForecastShape(data) && Number.isInteger(reportedStatus) && reportedStatus >= 400 && reportedStatus <= 599) {
      return json(reportedStatus, { error: data?.descripcion || data?.error || `AEMET informó del estado ${reportedStatus}.`, code: reportedStatus === 401 || reportedStatus === 403 ? 'AEMET_UNAUTHORIZED' : reportedStatus === 429 ? 'AEMET_RATE_LIMIT' : 'AEMET_UPSTREAM_ERROR', upstreamStatus: reportedStatus }, reportedStatus === 429 ? { 'Retry-After': '5' } : {});
    }

    if (!hasForecastShape(data)) {
      const sample = Array.isArray(data) ? data[0] : data;
      const keys = sample && typeof sample === 'object' ? Object.keys(sample).slice(0, 20) : [];
      return json(502, { error: 'AEMET ha devuelto JSON, pero no tiene la estructura esperada de predicción municipal. Comprueba la respuesta del servicio o vuelve a intentarlo.', code: 'AEMET_UNEXPECTED_PAYLOAD', responseKeys: keys });
    }

    return json(200, data);
  } catch (error) {
    return json(error?.name === 'AbortError' ? 504 : 502, { error: error?.name === 'AbortError' ? 'Tiempo de espera agotado consultando AEMET.' : `No se pudo consultar AEMET: ${error?.message || 'error de red'}` });
  }
};
