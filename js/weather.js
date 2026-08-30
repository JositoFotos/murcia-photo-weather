export const NODATA = 'N/D';

const SKY_STATES = [
  { key: 'clear', label: 'Despejado', match: ['despejado', 'cielo despejado'], icon: '☀️', level: 0 },
  { key: 'little', label: 'Poco nuboso', match: ['poco nuboso'], icon: '🌤️', level: 1 },
  { key: 'high', label: 'Nubes altas', match: ['nubes altas', 'nubosidad alta'], icon: '🌥️', level: 1 },
  { key: 'intervals', label: 'Intervalos nubosos', match: ['intervalos nubosos', 'intervalos de nubes'], icon: '⛅', level: 2 },
  { key: 'cloudy', label: 'Nuboso', match: ['nuboso'], icon: '☁️', level: 3 },
  { key: 'very-cloudy', label: 'Muy nuboso', match: ['muy nuboso'], icon: '☁️', level: 4 },
  { key: 'overcast', label: 'Cubierto', match: ['cubierto'], icon: '☁️', level: 5 },
  { key: 'unknown', label: 'Sin descripción', match: [], icon: '—', level: null }
];

function classifySky(description) {
  const text = String(description ?? '').trim().toLowerCase();
  if (!text) return SKY_STATES.at(-1);
  const exact = SKY_STATES.find(item => item.match.some(term => text === term));
  if (exact) return exact;
  const contains = SKY_STATES.find(item => item.match.some(term => text.includes(term)));
  return contains ?? SKY_STATES.at(-1);
}

export function summarizeSkyConditions(hourly) {
  const points = (hourly ?? []).map(row => ({ ...row, skyState: classifySky(row?.sky?.description) }));
  const valid = points.filter(row => row.skyState.key !== 'unknown');
  const counts = new Map();
  for (const row of valid) counts.set(row.skyState.key, (counts.get(row.skyState.key) ?? 0) + 1);
  const dominant = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || (SKY_STATES.find(x => x.key === a[0])?.level ?? 99) - (SKY_STATES.find(x => x.key === b[0])?.level ?? 99))[0]?.[0];
  const dominantState = SKY_STATES.find(item => item.key === dominant) ?? SKY_STATES.at(-1);
  const hasHighCloud = valid.some(row => row.skyState.key === 'high');
  const hasPartlyCloudy = valid.some(row => ['intervals', 'cloudy'].includes(row.skyState.key));
  const clearCount = valid.filter(row => ['clear', 'little'].includes(row.skyState.key)).length;
  const photoInterest = valid.length
    ? hasHighCloud || hasPartlyCloudy ? 'Alto' : clearCount === valid.length ? 'Moderado' : 'Bajo'
    : 'N/D';
  const sequence = valid.slice(0, 12).map(row => ({
    hour: row.hour,
    label: row.skyState.label,
    icon: row.skyState.icon,
    description: row.sky?.description ?? null
  }));
  return {
    points,
    dominant: dominantState.label,
    dominantIcon: dominantState.icon,
    photoInterest,
    hasHighCloud,
    hasPartlyCloudy,
    sequence,
    available: valid.length > 0
  };
}

export function valueOrND(value, suffix = '') {
  return Number.isFinite(Number(value)) ? `${Number(value)}${suffix}` : NODATA;
}

export function average(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((a,b) => a+b, 0) / valid.length : null;
}

export function findDay(weather, date) {
  return weather?.daily?.find(d => d.date === date) ?? null;
}

export function getHourlyForDate(weather, date) {
  return weather?.hourly?.filter(x => x.date === date) ?? [];
}

export function summarizeWeather(weather, date) {
  const day = findDay(weather, date);
  const hourly = getHourlyForDate(weather, date);
  const temps = hourly.map(x => x.temperature).filter(Number.isFinite);
  const hum = hourly.map(x => x.humidity).filter(Number.isFinite);
  const rainP = hourly.map(x => x.rainProbability).filter(Number.isFinite);
  const storms = hourly.map(x => x.stormProbability).filter(Number.isFinite);
  const wind = hourly.map(x => x.wind?.speed).filter(Number.isFinite);
  const skyText = hourly.map(x => x.sky?.description).filter(Boolean);
  return {
    date,
    temperature: { max: day?.temperature?.max ?? Math.max(...temps, NaN), min: day?.temperature?.min ?? Math.min(...temps, NaN), current: temps[0] ?? null },
    humidity: { max: day?.humidity?.max ?? Math.max(...hum, NaN), min: day?.humidity?.min ?? Math.min(...hum, NaN), mean: average(hum) },
    rainProbability: rainP.length ? Math.max(...rainP) : Math.max(...(day?.rainProbability?.map(x => x.value).filter(Number.isFinite) ?? []), NaN),
    stormProbability: storms.length ? Math.max(...storms) : null,
    wind: { mean: average(wind), max: wind.length ? Math.max(...wind) : null },
    skyDescriptions: [...new Set(skyText)]
  };
}

export function sortForecastDates(weather) {
  return [...new Set((weather?.daily ?? []).map(d => d.date).filter(Boolean))].sort();
}

export function conditionLabel(stormProbability) {
  if (!Number.isFinite(stormProbability)) return NODATA;
  if (stormProbability >= 60) return 'Alto';
  if (stormProbability >= 30) return 'Moderado';
  return 'Bajo';
}
