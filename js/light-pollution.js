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
  if (!endpoint) throw new Error('No está configurado el servicio de contaminación lumínica en js/config.js.');
  const url = new URL(endpoint);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url.toString(), { signal: controller.signal, headers: { Accept: 'application/json' } });
      const responseText=await response.text();
      let payload;
      try { payload=responseText?JSON.parse(responseText):null; }
      catch {
        const error=new Error(!response.ok?`El servicio del atlas en Netlify respondió con HTTP ${response.status}. Comprueba que la función esté desplegada.`:'El servicio del atlas devolvió una respuesta no válida.');
        error.status=response.status;
        throw error;
      }
      if (!response.ok) {
        const error = new Error(payload?.error || `Error al consultar el atlas (HTTP ${response.status}).`);
        error.status = response.status;
        throw error;
      }
      if (!Number.isFinite(Number(payload?.lpIndex)) || !Number.isFinite(Number(payload?.mpsas))) {
        throw new Error('El atlas no contiene un valor válido para estas coordenadas.');
      }
      memoryCache.set(key, { timestamp: Date.now(), data: payload });
      return payload;
    } catch (error) {
      if (error.name === 'AbortError') lastError = new Error('La consulta al atlas ha tardado demasiado. Puedes reintentar.');
      else if (error instanceof TypeError && /fetch/i.test(error.message)) lastError = new Error('No se pudo conectar con la función del atlas en Netlify. Comprueba que esté desplegada y que la conexión permita la petición (posible error de red/CORS).');
      else lastError = error;
      const transient = !error?.status || error.status === 429 || error.status >= 500;
      if (attempt === 0 && transient) await new Promise(resolve => setTimeout(resolve, 800));
      else break;
    } finally { clearTimeout(timer); }
  }
  throw lastError || new Error('No se pudo consultar el atlas.');
}
