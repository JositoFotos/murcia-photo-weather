import { CONFIG } from './config.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const memoryCache = new Map();

/** Consults the 2025 World Atlas through Netlify so the browser never needs to
 * download/decompress the atlas tiles and failures can be reported consistently. */
export async function getLightPollution(latitude, longitude, { force = false } = {}) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -65 || lat >= 75 || lon < -180 || lon > 180) {
    throw new Error('Las coordenadas están fuera de la cobertura del atlas (65° S a 75° N).');
  }
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = memoryCache.get(key);
  if (!force && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return cached.data;
  const endpoint = String(CONFIG.LIGHT_POLLUTION_PROXY_URL || '').trim();
  if (!endpoint) throw new Error('No está configurado el servicio de contaminación lumínica.');
  const url = new URL(endpoint);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  let payload;
  try { payload = await response.json(); } catch { throw new Error('El servicio del atlas devolvió una respuesta no válida.'); }
  if (!response.ok) throw new Error(payload?.error || `Error al consultar el atlas (HTTP ${response.status}).`);
  if (!Number.isFinite(Number(payload?.lpIndex)) || !Number.isFinite(Number(payload?.mpsas))) {
    throw new Error('El atlas no contiene un valor válido para estas coordenadas.');
  }
  memoryCache.set(key, { timestamp: Date.now(), data: payload });
  return payload;
}
