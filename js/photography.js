import { CONFIG } from './config.js';
import { average } from './weather.js';

function clamp(n, min=0, max=100) { return Math.min(max, Math.max(min, n)); }
function absenceScore(v, badAt=50) { return Number.isFinite(v) ? clamp(100 - (v / badAt) * 100) : 60; }
function moderateScore(v, ideal, tolerance) { return Number.isFinite(v) ? clamp(100 - Math.abs(v - ideal) / tolerance * 100) : 60; }
function positiveCloudiness(cloud, desired=55) { return Number.isFinite(cloud) ? clamp(100 - Math.abs(cloud - desired) / 55 * 100) : 60; }

function cloudinessScoreForMode(data, mode='landscape') {
  const points = Array.isArray(data.openWeatherPoints) ? data.openWeatherPoints : [];
  const cloud = points.map(p => Number(p.cloudiness)).filter(Number.isFinite);
  if (!cloud.length) return null;
  const avg = cloud.reduce((a,b)=>a+b,0) / cloud.length;

  // Para amanecer/atardecer y costa buscamos una cantidad intermedia de nubes:
  // suficiente para textura y color, pero evitando un cielo completamente cubierto.
  if (mode === 'sunriseSunset' || mode === 'coast') {
    const desired = mode === 'coast' ? 50 : 55;
    return clamp(100 - Math.abs(avg - desired) / 55 * 100);
  }

  // Para nocturna importa especialmente cómo entra la noche. El último tramo
  // de 3 h del día (habitualmente 21 h) tiene un peso adicional.
  if (mode === 'nocturnal') {
    const evening = points.filter(p => Number.isInteger(p.hour) && p.hour >= 18);
    const weighted = evening.length
      ? evening.reduce((sum,p) => sum + Number(p.cloudiness) * (p.hour >= 21 ? 2.5 : p.hour >= 20 ? 1.5 : 1), 0) /
        evening.reduce((sum,p) => sum + (p.hour >= 21 ? 2.5 : p.hour >= 20 ? 1.5 : 1), 0)
      : avg;
    return absenceScore(weighted, 100);
  }

  // En paisaje/naturaleza/arquitectura una cantidad moderada aporta textura,
  // pero el beneficio es menor que en amanecer/atardecer y costa.
  return positiveCloudiness(avg, mode === 'nature' ? 40 : 30);
}

function skyComponents(hourly) {
  const descriptions = hourly.map(x => x.sky?.description).filter(Boolean).join(' ').toLowerCase();
  const values = hourly.map(x => x.sky?.value).filter(Number.isFinite);
  const cloudProxy = values.length ? average(values) : null;
  return { low: cloudProxy, mid: cloudProxy, high: cloudProxy, descriptions };
}

export function calculatePhotographyScore(data, mode='landscape') {
  const weights = CONFIG.PHOTOGRAPHY_SCORE_WEIGHTS[mode] ?? CONFIG.PHOTOGRAPHY_SCORE_WEIGHTS.landscape;
  const components = skyComponents(data.hourly ?? []);
  const rain = Number.isFinite(data.rain) ? absenceScore(data.rain, 8) : 65;
  const rainProbability = Number.isFinite(data.rainProbability) ? absenceScore(data.rainProbability, 100) : 65;
  const lowCloud = Number.isFinite(data.lowCloud) ? absenceScore(data.lowCloud, 100) : (components.low !== null ? 70 : 60);
  const midCloud = Number.isFinite(data.midCloud) ? positiveCloudiness(data.midCloud, mode === 'sunriseSunset' ? 50 : 30) : (components.mid !== null ? 70 : 60);
  const highCloud = Number.isFinite(data.highCloud) ? positiveCloudiness(data.highCloud, mode === 'sunriseSunset' ? 65 : 45) : (components.high !== null ? 70 : 60);
  const storms = Number.isFinite(data.stormProbability) ? absenceScore(data.stormProbability, 100) : 70;
  const wind = Number.isFinite(data.wind) ? moderateScore(data.wind, mode === 'coast' ? 12 : 6, 18) : 65;
  const temperature = Number.isFinite(data.temperature) ? moderateScore(data.temperature, 21, 18) : 60;
  const humidity = Number.isFinite(data.humidity) ? moderateScore(data.humidity, 60, 45) : 60;
  const visibility = Number.isFinite(data.visibility) ? absenceScore(100-data.visibility, 100) : 60;
  const scores = { rain, rainProbability, lowCloud, midCloud, highCloud, storms, wind, temperature, humidity, visibility };
  const raw = Object.entries(weights).reduce((sum, [key, weight]) => sum + scores[key] * weight, 0);
  const cloudiness = cloudinessScoreForMode(data, mode);
  let adjusted = raw;
  if (Number.isFinite(cloudiness)) {
    // La nubosidad total de OpenWeather complementa el estado del cielo de AEMET.
    // Le damos una influencia visible, pero limitada, para no dominar al resto
    // de factores del índice.
    const influence = mode === 'nocturnal' ? 0.18 : (mode === 'sunriseSunset' || mode === 'coast' ? 0.14 : 0.08);
    adjusted = raw * (1 - influence) + cloudiness * influence;
  }
  const score = Math.round(clamp(adjusted));
  const positives = [];
  const negatives = [];
  if (highCloud >= 75) positives.push('Nubosidad alta favorable');
  if (rain >= 80) positives.push('Sin lluvia o lluvia muy baja');
  if (wind >= 70) positives.push('Viento razonable para el modo');
  if (storms >= 80) positives.push('Baja probabilidad de tormentas');
  if (midCloud >= 70 && (mode === 'sunriseSunset' || mode === 'landscape')) positives.push('Nubosidad media útil para textura de cielo');
  if (Number.isFinite(cloudiness)) {
    if ((mode === 'sunriseSunset' || mode === 'coast') && cloudiness >= 70) positives.push('Nubosidad favorable para textura y color');
    if ((mode === 'sunriseSunset' || mode === 'coast') && cloudiness < 30) positives.push('Cielo parcialmente despejado');
    if (mode === 'nocturnal' && cloudiness >= 75) negatives.push('Nubosidad elevada al inicio de la noche');
    if (mode === 'nocturnal' && cloudiness <= 25) positives.push('Nubosidad baja al inicio de la noche');
  }
  if (lowCloud < 45) negatives.push('Nubosidad baja elevada');
  if (rainProbability < 50) negatives.push('Probabilidad de lluvia significativa');
  if (storms < 50) negatives.push('Riesgo de tormenta elevado');
  if (wind < 45) negatives.push('Viento poco favorable');
  return { score, category: score >= 81 ? 'Excelente' : score >= 61 ? 'Bueno' : score >= 41 ? 'Aceptable' : score >= 21 ? 'Desfavorable' : 'Muy desfavorable', factors: { ...scores, cloudiness }, positives, negatives };
}

export function calculateSkyPhotographyScore(data, mode='sunriseSunset') {
  return calculatePhotographyScore({ ...data, rain: data.rain ?? 0 }, mode).score;
}

export function calculateSpecificIndices(data) {
  const day = calculatePhotographyScore(data, 'landscape').score;
  const sunrise = calculatePhotographyScore(data, 'sunriseSunset').score;
  const sunset = calculatePhotographyScore(data, 'sunriseSunset').score;
  const night = calculatePhotographyScore(data, 'nocturnal').score;
  const sky = calculateSkyPhotographyScore(data, 'sunriseSunset');
  return { general: day, sunrise, sunset, day, night, sky };
}

export function calculateBestPhotographyWindows(hourly, astronomy, mode='landscape') {
  const candidates = [];
  for (const row of hourly ?? []) {
    const time = parseForecastDate(row);
    if (!time) continue;
    const isGolden = inRange(time, astronomy?.goldenMorning) || inRange(time, astronomy?.goldenEvening);
    const isBlue = inRange(time, astronomy?.blueMorning) || inRange(time, astronomy?.blueEvening);
    const score = calculatePhotographyScore({ rain: row.precipitation, rainProbability: row.rainProbability, stormProbability: row.stormProbability, wind: row.wind?.speed, temperature: row.temperature, humidity: row.humidity, hourly: [row] }, isGolden || isBlue ? 'sunriseSunset' : mode).score;
    candidates.push({ row, time, score, label: isGolden ? 'Hora dorada' : isBlue ? 'Hora azul' : 'Ventana' });
  }
  candidates.sort((a,b) => b.score-a.score);
  return mergeAdjacentWindows(candidates.slice(0, 12)).slice(0, 6);
}

function parseForecastDate(row) {
  if (!row?.date || row.hour === null || row.hour === undefined) return null;
  const hh = String(row.hour).padStart(2, '0').slice(-2);
  const date = new Date(`${row.date}T${hh}:00:00+02:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
function inRange(date, range) { return Array.isArray(range) && range[0] && range[1] && date >= range[0] && date <= range[1]; }
function mergeAdjacentWindows(items) { return items.map(x => ({ start:x.time, end:new Date(x.time.getTime()+60*60*1000), score:x.score, label:x.label })).sort((a,b)=>b.score-a.score); }
