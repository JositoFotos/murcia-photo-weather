export const NODATA = 'N/D';

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
