const TIME_ZONE = 'Europe/Madrid';
const CACHE_PREFIX = 'mpwp_recommended_openmeteo_v1';
const CACHE_TTL = 60 * 60 * 1000;
const HOURLY_FIELDS = [
  'temperature_2m', 'relative_humidity_2m', 'precipitation',
  'precipitation_probability', 'cloud_cover', 'cloud_cover_low',
  'cloud_cover_mid', 'cloud_cover_high', 'wind_speed_10m',
  'wind_direction_10m', 'wind_gusts_10m', 'weather_code'
];
const DAILY_FIELDS = ['temperature_2m_max','temperature_2m_min','precipitation_sum','precipitation_probability_max','wind_speed_10m_max','uv_index_max','weather_code'];

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

function weatherCodeDescription(code) {
  const c = Number(code);
  if (c === 0) return 'Despejado';
  if (c === 1) return 'Poco nuboso';
  if (c === 2) return 'Intervalos nubosos';
  if (c === 3) return 'Cubierto';
  if ([45,48].includes(c)) return 'Niebla';
  if ([51,53,55,56,57].includes(c)) return 'Llovizna';
  if ([61,63,65,66,67].includes(c)) return 'Lluvia';
  if ([71,73,75,77].includes(c)) return 'Nieve';
  if ([80,81,82].includes(c)) return 'Chubascos';
  if ([85,86].includes(c)) return 'Chubascos de nieve';
  if ([95,96,99].includes(c)) return 'Tormenta';
  return 'Condición no disponible';
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
      stormProbability: [95,96,99].includes(Number(hourly.weather_code?.[index])) ? 100 : null,
      sky: { value: cloud, description: weatherCodeDescription(hourly.weather_code?.[index]) },
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
  const dailyRaw = raw?.daily || {};
  const daily = (dailyRaw.time || []).map((date, index) => ({
    date,
    temperature: { max: numberOrNull(dailyRaw.temperature_2m_max?.[index]), min: numberOrNull(dailyRaw.temperature_2m_min?.[index]), values: [] },
    humidity: { max: null, min: null, values: [] },
    rainProbability: Number.isFinite(numberOrNull(dailyRaw.precipitation_probability_max?.[index])) ? [{ period: '00-24', value: numberOrNull(dailyRaw.precipitation_probability_max?.[index]) }] : [],
    precipitation: numberOrNull(dailyRaw.precipitation_sum?.[index]),
    sky: [{ period: '00-24', value: null, descripcion: weatherCodeDescription(dailyRaw.weather_code?.[index]) }],
    wind: [{ period: '00-24', speed: numberOrNull(dailyRaw.wind_speed_10m_max?.[index]), direction: null }],
    gusts: [], uvMax: numberOrNull(dailyRaw.uv_index_max?.[index])
  }));
  return { municipality, source: 'Open-Meteo', updatedAt: new Date().toISOString(), daily, hourly: rows };
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
    daily: DAILY_FIELDS.join(','),
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


const POINT_CACHE_PREFIX = 'mpwp_openmeteo_point_v1_';
export async function getOpenMeteoForecast(latitude, longitude, municipality, { force = false } = {}) {
  const lat = Number(latitude), lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('Las coordenadas no son válidas para consultar Open-Meteo.');
  const cacheKey = `${POINT_CACHE_PREFIX}${lat.toFixed(4)}_${lon.toFixed(4)}`;
  if (!force) {
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (cached?.data && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
    } catch {}
  }
  const params = new URLSearchParams({
    latitude: String(lat), longitude: String(lon),
    hourly: HOURLY_FIELDS.join(','), daily: DAILY_FIELDS.join(','),
    timezone: TIME_ZONE, forecast_days: '7'
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) { const error = new Error(`Open-Meteo respondió HTTP ${response.status}.`); error.status = response.status; throw error; }
    const raw = await response.json();
    const place = municipality || { id: `point-${lat.toFixed(4)}-${lon.toFixed(4)}`, name: 'Localización seleccionada', latitude: lat, longitude: lon };
    const normalized = normalizeLocationForecast(raw, place);
    if (!normalized.hourly.length) throw new Error('Open-Meteo no ha devuelto datos horarios para esta localización.');
    try { localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: normalized })); } catch {}
    return normalized;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('La consulta a Open-Meteo ha superado el tiempo de espera.');
    throw error;
  } finally { clearTimeout(timeout); }
}
