import { CONFIG } from './config.js';

const CACHE_PREFIX = 'mpwp_openweather_v1_';

function jsonRead(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback)); }
  catch { return fallback; }
}
function jsonWrite(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function keyFor(lat, lon) { return `${CACHE_PREFIX}${Number(lat).toFixed(4)}_${Number(lon).toFixed(4)}`; }
function finite(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }

function localDateHour(isoUtc, timeZone = CONFIG.DEFAULT_TIME_ZONE) {
  if (!isoUtc) return { date: null, hour: null };
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return { date: null, hour: null };
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'
  }).formatToParts(d);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { date: `${map.year}-${map.month}-${map.day}`, hour: Number(map.hour) };
}

async function fetchJson(url, { timeoutMs = 20000, retries = 1 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      const text = await response.text();
      let payload = null;
      try { payload = text ? JSON.parse(text) : null; }
      catch { throw new Error('OpenWeather ha devuelto una respuesta que no es JSON válido.'); }
      if (!response.ok) {
        const error = new Error(payload?.message || `HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return payload;
    } catch (error) {
      lastError = error.name === 'AbortError' ? new Error('Tiempo de espera agotado al consultar OpenWeather.') : error;
      if (attempt < retries) await new Promise(resolve => setTimeout(resolve, 600 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

function proxyUrl(lat, lon) {
  const base = String(CONFIG.OPENWEATHER_PROXY_URL ?? '').trim();
  if (!base) throw new Error('OPENWEATHER_PROXY_URL no está configurada.');
  const url = new URL(base);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  return url.toString();
}

export async function getOpenWeatherForecast(lat, lon, { force = false } = {}) {
  const cacheKey = keyFor(lat, lon);
  const cached = jsonRead(cacheKey, null);
  if (!force && cached?.timestamp && Date.now() - cached.timestamp < CONFIG.CACHE_DURATION) return cached.data;
  const raw = await fetchJson(proxyUrl(lat, lon));
  const normalized = normalizeOpenWeatherForecast(raw);
  jsonWrite(cacheKey, { timestamp: Date.now(), data: normalized });
  return normalized;
}

export function normalizeOpenWeatherForecast(raw) {
  if (!raw || !Array.isArray(raw.list)) throw new Error('OpenWeather ha respondido sin previsiones horarias utilizables.');
  const points = raw.list.map(item => {
    const local = localDateHour(item.dt_txt, CONFIG.DEFAULT_TIME_ZONE);
    return {
      date: local.date,
      hour: local.hour,
      timestamp: Number.isFinite(Number(item.dt)) ? Number(item.dt) * 1000 : null,
      temperature: finite(item.main?.temp),
      feelsLike: finite(item.main?.feels_like),
      humidity: finite(item.main?.humidity),
      pressure: finite(item.main?.pressure),
      visibility: finite(item.visibility) !== null ? finite(item.visibility) / 1000 : null,
      cloudiness: finite(item.clouds?.all),
      precipitationProbability: finite(item.pop) !== null ? finite(item.pop) * 100 : null,
      rain3h: finite(item.rain?.['3h']),
      snow3h: finite(item.snow?.['3h']),
      wind: {
        speed: finite(item.wind?.speed) !== null ? finite(item.wind?.speed) * 3.6 : null,
        gust: finite(item.wind?.gust) !== null ? finite(item.wind?.gust) * 3.6 : null,
        direction: finite(item.wind?.deg)
      },
      weather: item.weather?.[0] ? {
        main: item.weather[0].main ?? null,
        description: item.weather[0].description ?? null,
        icon: item.weather[0].icon ?? null
      } : null
    };
  }).filter(x => x.date);
  return {
    source: 'OpenWeather',
    timezoneOffsetSeconds: finite(raw.city?.timezone),
    city: raw.city?.name ?? null,
    updatedAt: Date.now(),
    points
  };
}

export function getOpenWeatherForDate(forecast, date) {
  return forecast?.points?.filter(x => x.date === date) ?? [];
}

export function summarizeOpenWeather(points) {
  const valid = points ?? [];
  const visibility = valid.map(x => x.visibility).filter(Number.isFinite);
  const cloudiness = valid.map(x => x.cloudiness).filter(Number.isFinite);
  const pop = valid.map(x => x.precipitationProbability).filter(Number.isFinite);
  const rain = valid.map(x => x.rain3h).filter(Number.isFinite);
  const wind = valid.map(x => x.wind?.speed).filter(Number.isFinite);
  const gust = valid.map(x => x.wind?.gust).filter(Number.isFinite);
  const avg = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  return {
    visibility: visibility.length ? avg(visibility) : null,
    visibilityMin: visibility.length ? Math.min(...visibility) : null,
    cloudiness: cloudiness.length ? avg(cloudiness) : null,
    precipitationProbability: pop.length ? Math.max(...pop) : null,
    rain3h: rain.length ? rain.reduce((a, b) => a + b, 0) : null,
    wind: wind.length ? avg(wind) : null,
    gust: gust.length ? Math.max(...gust) : null,
    points: valid
  };
}

export function clearOpenWeatherCache() {
  Object.keys(localStorage).filter(key => key.startsWith(CACHE_PREFIX)).forEach(key => localStorage.removeItem(key));
}
