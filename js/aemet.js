import { CONFIG } from './config.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function assertApiConfigured() {
  const key = String(CONFIG.AEMET_API_KEY ?? '').trim();
  const proxy = String(CONFIG.AEMET_PROXY_URL ?? '').trim();

  if (proxy) return;

  const invalidPlaceholders = new Set([
    '',
    'MI_API_KEY',
    'TU_API_KEY',
    'YOUR_AEMET_API_KEY',
    'PON_AQUI_TU_API_KEY'
  ]);

  if (invalidPlaceholders.has(key)) {
    const error = new Error('Configura AEMET_PROXY_URL para la versión pública o AEMET_API_KEY para uso local.');
    error.code = 'API_CONFIG_MISSING';
    throw error;
  }

  const dotCount = (key.match(/\./g) || []).length;
  if (dotCount !== 2) {
    const error = new Error('La AEMET_API_KEY no tiene formato JWT válido.');
    error.code = 'API_KEY_FORMAT';
    throw error;
  }
}


async function fetchJson(url, { timeoutMs = 20000, retries = 1 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      const text = await response.text();
      let payload;
      try { payload = text ? JSON.parse(text) : null; } catch { throw new Error('AEMET ha devuelto una respuesta que no es JSON válido.'); }
      if (!response.ok) {
        const error = new Error(payload?.descripcion || `HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return payload;
    } catch (error) {
      lastError = error.name === 'AbortError' ? new Error('Tiempo de espera agotado al consultar AEMET.') : error;
      if (attempt < retries) await sleep(600 * (attempt + 1));
    } finally { clearTimeout(timeout); }
  }
  throw lastError;
}

async function requestAemetEndpoint(path) {
  assertApiConfigured();
  const proxy = String(CONFIG.AEMET_PROXY_URL ?? '').trim().replace(/\/$/, '');

  if (proxy) {
    const url = `${proxy}/aemet?path=${encodeURIComponent(path)}`;
    return fetchJson(url, { retries: 1 });
  }

  const apiKey = String(CONFIG.AEMET_API_KEY).trim();
  const firstUrl = `${CONFIG.AEMET_BASE_URL}${path}?api_key=${encodeURIComponent(apiKey)}`;
  const envelope = await fetchJson(firstUrl);
  if (!envelope || typeof envelope !== 'object') throw new Error('Respuesta inicial de AEMET inesperada.');
  if (Number(envelope.estado) !== 200 || typeof envelope.datos !== 'string') {
    const error = new Error(envelope.descripcion || 'AEMET no ha devuelto una URL de datos válida.');
    error.status = envelope.estado;
    throw error;
  }
  return fetchJson(envelope.datos);
}

export async function getDailyForecast(municipalityCode) {
  return requestAemetEndpoint(`/prediccion/especifica/municipio/diaria/${municipalityCode}`);
}

export async function getHourlyForecast(municipalityCode) {
  return requestAemetEndpoint(`/prediccion/especifica/municipio/horaria/${municipalityCode}`);
}

export async function getWeatherData(municipalityCode) {
  const [daily, hourly] = await Promise.allSettled([getDailyForecast(municipalityCode), getHourlyForecast(municipalityCode)]);
  if (daily.status === 'rejected' && hourly.status === 'rejected') throw daily.reason;
  return { daily: daily.status === 'fulfilled' ? daily.value : null, hourly: hourly.status === 'fulfilled' ? hourly.value : null };
}

function asNumber(value) {
  if (value === null || value === undefined || value === '' || value === 'N/D') return null;
  const num = Number(String(value).replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

function fieldNumber(value) {
  if (value && typeof value === 'object' && 'value' in value) return asNumber(value.value);
  return asNumber(value);
}

function dateOnly(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function unwrap(payload) {
  if (Array.isArray(payload)) return payload[0] ?? null;
  return payload ?? null;
}

function normalizeSkyList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(x => ({ periodo: x?.periodo ?? null, hora: x?.hora ?? null, value: fieldNumber(x?.value), descripcion: x?.descripcion ?? null })).filter(x => x.descripcion || x.value !== null);
}

export function processAemetData(raw, municipality) {
  if (!raw || typeof raw !== 'object') throw new Error('AEMET no ha devuelto datos meteorológicos.');
  const dailyPayload = unwrap(raw.daily);
  const hourlyPayload = unwrap(raw.hourly);
  const dailyRows = Array.isArray(dailyPayload?.prediccion?.dia) ? dailyPayload.prediccion.dia : [];
  const hourlyRows = Array.isArray(hourlyPayload?.prediccion?.dia) ? hourlyPayload.prediccion.dia : [];
  if (!dailyRows.length && !hourlyRows.length) throw new Error('AEMET ha respondido, pero no contiene predicciones utilizables.');
  return normalizeWeatherData({ municipality, dailyRows, hourlyRows, dailyRaw: dailyPayload, hourlyRaw: hourlyPayload });
}

export function normalizeWeatherData({ municipality, dailyRows, hourlyRows, dailyRaw, hourlyRaw }) {
  const daily = dailyRows.map(day => ({
    date: dateOnly(day.fecha),
    temperature: { max: asNumber(day.temperatura?.maxima), min: asNumber(day.temperatura?.minima), values: Array.isArray(day.temperatura?.dato) ? day.temperatura.dato.map(fieldNumber) : [] },
    humidity: { max: asNumber(day.humedadRelativa?.maxima), min: asNumber(day.humedadRelativa?.minima), values: Array.isArray(day.humedadRelativa?.dato) ? day.humedadRelativa.dato.map(fieldNumber) : [] },
    rainProbability: Array.isArray(day.probPrecipitacion) ? day.probPrecipitacion.map(x => ({ period: x?.periodo ?? null, value: fieldNumber(x?.value) })) : [],
    precipitation: [],
    sky: normalizeSkyList(day.estadoCielo),
    wind: Array.isArray(day.viento) ? day.viento.map(x => ({ direction: x?.direccion ?? null, speed: asNumber(x?.velocidad), period: x?.periodo ?? null })) : [],
    gusts: Array.isArray(day.rachaMax) ? day.rachaMax.map(x => fieldNumber(x?.value ?? x)) : [],
    uvMax: fieldNumber(day.uvMax)
  })).filter(day => day.date);

  const getPeriod = item => {
    if (!item || typeof item !== 'object') return null;
    const raw = item.periodo ?? item.hora ?? item.fecha ?? item.date ?? item.time ?? null;
    if (raw === null || raw === undefined || raw === '') return null;

    // AEMET may represent the hour as: 00, 7, 07, 0700, 07-08, or an ISO date/time.
    const text = String(raw).trim();
    const iso = text.match(/T(\d{2})(?::(\d{2}))?/);
    if (iso) return Number(iso[1]);

    const range = text.match(/^(\d{1,2})(?:[-/]\d{1,2})?$/);
    if (range) {
      const hour = Number(range[1]);
      return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
    }

    const compact = text.match(/^(\d{4})$/);
    if (compact) {
      const hour = Number(compact[1].slice(0, 2));
      return hour >= 0 && hour <= 23 ? hour : null;
    }

    const firstHour = text.match(/(?:^|[^0-9])(\d{1,2})(?::\d{2})?(?:[^0-9]|$)/);
    if (firstHour) {
      const hour = Number(firstHour[1]);
      return hour >= 0 && hour <= 23 ? hour : null;
    }
    return null;
  };

  const byHour = (list, mapper = x => x) => {
    const map = new Map();
    for (const item of Array.isArray(list) ? list : []) {
      const hour = getPeriod(item);
      if (hour === null) continue;
      map.set(hour, mapper(item));
    }
    return map;
  };

  const hourly = hourlyRows.flatMap(day => {
    const date = dateOnly(day.fecha);
    if (!date) return [];

    const temperatureItems = Array.isArray(day.temperatura) ? day.temperatura : [];
    const temperaturePeriods = byHour(temperatureItems, x => x?.periodo ?? x?.hora ?? null);
    const temperatures = byHour(temperatureItems, x => fieldNumber(x));
    const humidity = byHour(day.humedadRelativa, x => fieldNumber(x));
    const rainProb = byHour(day.probPrecipitacion, x => fieldNumber(x?.value ?? x));
    const precipitation = byHour(day.precipitacion, x => fieldNumber(x?.value ?? x));
    const storms = byHour(day.probTormenta, x => fieldNumber(x?.value ?? x));
    const sky = byHour(day.estadoCielo, x => ({ value: fieldNumber(x?.value), description: x?.descripcion ?? null }));

    const windMap = new Map();
    for (const item of Array.isArray(day.vientoAndRachaMax) ? day.vientoAndRachaMax : []) {
      const hour = getPeriod(item);
      if (hour === null) continue;
      const entry = windMap.get(hour) ?? { direction: null, speed: null, gust: null };
      const hasWind = Array.isArray(item?.direccion) || Array.isArray(item?.velocidad);
      if (hasWind) {
        entry.direction = Array.isArray(item.direccion) ? item.direccion[0] ?? null : item.direccion ?? null;
        entry.speed = Array.isArray(item.velocidad) ? asNumber(item.velocidad[0]) : asNumber(item.velocidad);
      } else if (Object.prototype.hasOwnProperty.call(item ?? {}, 'value')) {
        entry.gust = asNumber(item.value);
      }
      windMap.set(hour, entry);
    }

    const hours = new Set([
      ...temperatures.keys(), ...humidity.keys(), ...rainProb.keys(), ...precipitation.keys(),
      ...storms.keys(), ...sky.keys(), ...windMap.keys()
    ]);

    return [...hours].sort((a, b) => a - b).map(hour => ({
      date,
      hour,
      period: temperaturePeriods.get(hour) ?? String(hour).padStart(2, '0'),
      time: `${date}T${String(hour).padStart(2, '0')}:00:00`,
      temperature: temperatures.get(hour) ?? null,
      humidity: humidity.get(hour) ?? null,
      rainProbability: rainProb.get(hour) ?? null,
      precipitation: precipitation.get(hour) ?? null,
      stormProbability: storms.get(hour) ?? null,
      sky: sky.get(hour) ?? null,
      wind: windMap.has(hour) ? windMap.get(hour) : null
    }));
  });

  return { municipality, updatedAt: new Date().toISOString(), daily, hourly, raw: { daily: dailyRaw, hourly: hourlyRaw } };
}
