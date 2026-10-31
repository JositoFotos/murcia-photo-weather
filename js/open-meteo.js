const TIME_ZONE = 'Europe/Madrid';
const CACHE_PREFIX = 'mpwp_recommended_openmeteo_v1';
const CACHE_TTL = 60 * 60 * 1000;
const HOURLY_FIELDS = [
  'temperature_2m', 'relative_humidity_2m', 'precipitation',
  'precipitation_probability', 'cloud_cover', 'cloud_cover_low',
  'cloud_cover_mid', 'cloud_cover_high', 'wind_speed_10m',
  'wind_direction_10m', 'wind_gusts_10m', 'weather_code'
];

function readCache() {
  try {
    const item = JSON.parse(localStorage.getItem(CACHE_PREFIX) || 'null');
    return item && Date.now() - item.timestamp < CACHE_TTL ? item.data : null;
  } catch { return null; }
}
function writeCache(data) {
  try { localStorage.setItem(CACHE_PREFIX, JSON.stringify({ timestamp: Date.now(), data })); }
  catch { /* La caché local es opcional. */ }
}
function numberOrNull(value) {
  const n = Number(value);
  return value === null || value === undefined || !Number.isFinite(n) ? null : n;
}

function normalizeLocationForecast(raw, municipality) {
  const hourly = raw?.hourly;
  if (!Array.isArray(hourly?.time) || !hourly.time.length) {
    throw new Error(`Open-Meteo no ha devuelto previsión horaria para ${municipality.name}.`);
  }
  const rows = hourly.time.map((time, index) => {
    const date = String(time).slice(0, 10);
    const hour = Number(String(time).slice(11, 13));
    const cloud = numberOrNull(hourly.cloud_cover?.[index]);
    return {
      date, hour, time,
      temperature: numberOrNull(hourly.temperature_2m?.[index]),
      humidity: numberOrNull(hourly.relative_humidity_2m?.[index]),
      rainProbability: numberOrNull(hourly.precipitation_probability?.[index]),
      precipitation: numberOrNull(hourly.precipitation?.[index]),
      stormProbability: null,
      sky: cloud === null ? null : { value: cloud, description: `Nubosidad ${cloud}%` },
      wind: {
        speed: numberOrNull(hourly.wind_speed_10m?.[index]),
        direction: numberOrNull(hourly.wind_direction_10m?.[index]),
        gust: numberOrNull(hourly.wind_gusts_10m?.[index])
      },
      cloudCover: cloud,
      cloudCoverLow: numberOrNull(hourly.cloud_cover_low?.[index]),
      cloudCoverMid: numberOrNull(hourly.cloud_cover_mid?.[index]),
      cloudCoverHigh: numberOrNull(hourly.cloud_cover_high?.[index]),
      weatherCode: numberOrNull(hourly.weather_code?.[index])
    };
  }).filter(row => row.date && Number.isInteger(row.hour));
  return { municipality, source: 'Open-Meteo', updatedAt: new Date().toISOString(), hourly: rows };
}

export async function getRegionalOpenMeteoForecasts(municipalities, { force = false } = {}) {
  if (!force) {
    const cached = readCache();
    if (cached) return new Map(Object.entries(cached));
  }
  const list = Array.isArray(municipalities) ? municipalities : [];
  if (!list.length) return new Map();
  const params = new URLSearchParams({
    latitude: list.map(x => x.latitude).join(','),
    longitude: list.map(x => x.longitude).join(','),
    hourly: HOURLY_FIELDS.join(','),
    timezone: TIME_ZONE,
    forecast_days: '7'
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) {
      const error = new Error(`Open-Meteo respondió HTTP ${response.status}.`);
      error.status = response.status;
      throw error;
    }
    const payload = await response.json();
    const results = Array.isArray(payload) ? payload : [payload];
    if (results.length !== list.length) throw new Error('Open-Meteo devolvió un número inesperado de ubicaciones.');
    const mapped = {};
    list.forEach((municipality, index) => {
      mapped[municipality.id] = normalizeLocationForecast(results[index], municipality);
    });
    writeCache(mapped);
    return new Map(Object.entries(mapped));
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('La consulta regional a Open-Meteo ha superado el tiempo de espera.');
    throw error;
  } finally { clearTimeout(timeout); }
}
