const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5/forecast';

function response(statusCode, body, cacheControl = 'no-store') {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': cacheControl
    },
    body: JSON.stringify(body)
  };
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

function parseCoordinate(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return response(204, {});
  if (event.httpMethod !== 'GET') return response(405, { error: 'Método no permitido.' });

  const lat = parseCoordinate(event.queryStringParameters?.lat, -90, 90);
  const lon = parseCoordinate(event.queryStringParameters?.lon, -180, 180);
  const apiKey = String(process.env.OPENWEATHER_API ?? '').trim();

  if (lat === null || lon === null) return response(400, { error: 'Latitud o longitud no válidas.' });
  if (!apiKey) return response(500, { error: 'El secreto OPENWEATHER_API no está configurado en Netlify.' });

  try {
    const url = new URL(OPENWEATHER_BASE_URL);
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('appid', apiKey);
    url.searchParams.set('units', 'metric');
    url.searchParams.set('lang', 'es');

    const { response:upstream, text } = await fetchTextWithTimeout(url);
    let data;
    try { data = text ? JSON.parse(text) : null; }
    catch { return response(502, { error: 'OpenWeather devolvió una respuesta no JSON.' }); }

    if (!upstream.ok) {
      return response(upstream.status || 502, {
        error: data?.message || `OpenWeather respondió con HTTP ${upstream.status}.`
      }, upstream.status === 429 ? 'public, max-age=0, s-maxage=0' : 'no-store');
    }
    if (!data || !Array.isArray(data.list)) return response(502, { error: 'OpenWeather no devolvió la previsión esperada.' });

    return response(200, data, 'public, max-age=300, s-maxage=300');
  } catch (error) {
    return response(error?.name === 'AbortError' ? 504 : 502, { error: error?.name === 'AbortError' ? 'Tiempo de espera agotado consultando OpenWeather.' : `No se pudo consultar OpenWeather: ${error?.message || 'error de red'}` });
  }
};
