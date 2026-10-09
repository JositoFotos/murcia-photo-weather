const { gunzipSync } = require('node:zlib');

const ATLAS_YEAR = 2025;
const ATLAS_TILE_BASE = `https://djlorenz.github.io/astronomy/binary_tiles/${ATLAS_YEAR}`;
const TILE_SIZE = 600;
const DECODED_BYTES_MIN = TILE_SIZE * TILE_SIZE + 1; // first value is 2 bytes; remaining cells are deltas
const tileCache = new Map();

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

async function loadTile(tileX, tileY) {
  const cacheKey = `${tileX}_${tileY}`;
  if (tileCache.has(cacheKey)) return tileCache.get(cacheKey);
  const promise = (async () => {
    const url = `${ATLAS_TILE_BASE}/binary_tile_${tileX}_${tileY}.dat.gz`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`El atlas respondió HTTP ${response.status}.`);
      const compressed = Buffer.from(await response.arrayBuffer());
      const inflatedBuffer = gunzipSync(compressed);
      if (inflatedBuffer.byteLength < DECODED_BYTES_MIN) throw new Error('El archivo del atlas tiene un tamaño inesperado.');
      return new Int8Array(inflatedBuffer.buffer, inflatedBuffer.byteOffset, inflatedBuffer.byteLength);
    } finally {
      clearTimeout(timeout);
    }
  })();
  tileCache.set(cacheKey, promise);
  try { return await promise; }
  catch (error) { tileCache.delete(cacheKey); throw error; }
}

function decodePoint(data, ix, iy) {
  const x = Math.max(1, Math.min(TILE_SIZE, ix));
  const y = Math.max(1, Math.min(TILE_SIZE, iy));
  // Encoding as documented in David Lorenz's public atlas viewer: the first
  // cell is an absolute 2-byte value; following cells are signed 1-byte deltas.
  const firstNumber = 128 * Number(data[0]) + Number(data[1]);
  let change = 0;
  for (let i = 1; i < y; i++) change += Number(data[TILE_SIZE * i + 1]);
  for (let i = 1; i < x; i++) change += Number(data[TILE_SIZE * (y - 1) + 1 + i]);
  return firstNumber + change;
}

function zoneFor(index) {
  if (index < 0.01) return '0';
  if (index < 0.06) return '1a';
  if (index < 0.11) return '1b';
  if (index < 0.19) return '2a';
  if (index < 0.33) return '2b';
  if (index < 0.58) return '3a';
  if (index < 1) return '3b';
  if (index < 1.73) return '4a';
  if (index < 3) return '4b';
  if (index < 5.2) return '5a';
  if (index < 9) return '5b';
  if (index < 15.59) return '6a';
  if (index < 27) return '6b';
  if (index < 46.77) return '7a';
  return '7b';
}

function impactFor(index) {
  // This qualitative impact is our own photography-oriented description, not
  // a Bortle class and not an official scale from the atlas.
  if (index < 0.11) return { label: 'Muy baja', level: 1, description: 'Cielo relativamente oscuro; muy favorable para captar estructuras débiles.' };
  if (index < 0.33) return { label: 'Baja', level: 2, description: 'Buena base para astrofotografía, aunque conviene comprobar el horizonte.' };
  if (index < 1) return { label: 'Moderada', level: 3, description: 'El brillo artificial puede reducir el contraste del cielo.' };
  if (index < 3) return { label: 'Alta', level: 4, description: 'Puede dificultar la captura de estructuras débiles de la Vía Láctea.' };
  return { label: 'Muy alta', level: 5, description: 'El brillo artificial probablemente reducirá bastante el contraste de la fotografía nocturna.' };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'GET') return json(405, { error: 'Método no permitido.' });
  const lat = Number(event.queryStringParameters?.lat);
  const lon = Number(event.queryStringParameters?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -65 || lat >= 75 || lon < -180 || lon > 180) {
    return json(400, { error: 'Coordenadas no válidas o fuera de la cobertura del atlas (65° S a 75° N).' });
  }
  const lonFromDateLine = modulo(lon + 180, 360);
  const latFromStart = lat + 65;
  const tileX = Math.floor(lonFromDateLine / 5) + 1;
  const tileY = Math.floor(latFromStart / 5) + 1;
  const ix = Math.round(120 * (lonFromDateLine - 5 * (tileX - 1) + 1 / 240));
  const iy = Math.round(120 * (latFromStart - 5 * (tileY - 1) + 1 / 240));
  try {
    const data = await loadTile(tileX, tileY);
    const compressedValue = decodePoint(data, ix, iy);
    const lpIndex = (5 / 195) * (Math.exp(0.0195 * compressedValue) - 1);
    if (!Number.isFinite(lpIndex) || lpIndex < 0) throw new Error('El valor calculado del atlas no es válido.');
    const mpsas = 22 - (5 * Math.log(1 + lpIndex)) / Math.log(100);
    const impact = impactFor(lpIndex);
    return json(200, {
      year: ATLAS_YEAR,
      latitude: lat,
      longitude: lon,
      lpIndex,
      lpZone: zoneFor(lpIndex),
      mpsas,
      impact,
      resolution: '1/120°',
      sourceName: 'World Atlas of Artificial Night Sky Brightness 2025',
      sourceAuthor: 'David Lorenz',
      sourceUrl: 'https://djlorenz.github.io/astronomy/lp/'
    });
  } catch (error) {
    return json(502, { error: `No se pudo consultar el atlas de contaminación lumínica: ${error?.message || 'error desconocido'}` }, { 'Cache-Control': 'no-store' });
  }
};
