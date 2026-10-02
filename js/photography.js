import { CONFIG } from './config.js';
import { average } from './weather.js';

function clamp(n, min=0, max=100) { return Math.min(max, Math.max(min, n)); }
function absenceScore(v, badAt=50) { return Number.isFinite(v) ? clamp(100 - (v / badAt) * 100) : 60; }
function moderateScore(v, ideal, tolerance) { return Number.isFinite(v) ? clamp(100 - Math.abs(v - ideal) / tolerance * 100) : 60; }
function positiveCloudiness(cloud, desired=55) { return Number.isFinite(cloud) ? clamp(100 - Math.abs(cloud - desired) / 55 * 100) : 60; }

function lateNightAdverseConditions(data) {
  const hourly = Array.isArray(data.hourly) ? data.hourly : [];
  const lateNight = hourly.filter(row => Number.isInteger(row?.hour) && row.hour >= 21 && row.hour <= 23);
  if (!lateNight.length) return { penalty: 0, rain: false, storm: false };

  const hasRain = lateNight.some(row =>
    (Number.isFinite(row?.precipitation) && row.precipitation > 0) ||
    (Number.isFinite(row?.rainProbability) && row.rainProbability >= 50)
  );
  const stormValues = lateNight.map(row => row?.stormProbability).filter(Number.isFinite);
  const maxStorm = stormValues.length ? Math.max(...stormValues) : null;
  const hasStorm = Number.isFinite(maxStorm) && maxStorm >= 30;

  let penalty = 0;
  if (hasRain) penalty += 10;
  if (hasStorm) penalty += maxStorm >= 60 ? 12 : 8;

  return { penalty: Math.min(20, penalty), rain: hasRain, storm: hasStorm, maxStorm };
}

function cloudinessScoreForMode(data, mode='landscape') {
  const points = Array.isArray(data.openWeatherPoints) ? data.openWeatherPoints : [];
  const cloud = points.map(p => Number(p.cloudiness)).filter(Number.isFinite);
  if (!cloud.length) return null;
  const avg = cloud.reduce((a,b)=>a+b,0) / cloud.length;

  // Para amanecer/atardecer y costa buscamos una cantidad intermedia de nubes:
  // suficiente para textura y color, pero evitando un cielo completamente cubierto.
  if (mode === 'sunriseSunset' || mode === 'coast') {
    const desired = mode === 'sunriseSunset' ? 60 : 50;
    return clamp(100 - Math.abs(avg - desired) / 70 * 100);
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
  const desired = mode === 'nature' ? 45 : (mode === 'architecture' ? 45 : 40);
  return positiveCloudiness(avg, desired);
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
    const influence = mode === 'nocturnal' ? 0.18 : 0.12;
    adjusted = raw * (1 - influence) + cloudiness * influence;
  }
  const lateNight = mode === 'nocturnal' ? lateNightAdverseConditions(data) : { penalty: 0, rain: false, storm: false };
  const score = Math.round(clamp(adjusted - lateNight.penalty));
  const positives = [];
  const negatives = [];
  if (highCloud >= 75) positives.push('Nubosidad alta favorable');
  if (rain >= 80) positives.push('Sin lluvia o lluvia muy baja');
  if (wind >= 70) positives.push('Viento razonable para el modo');
  if (storms >= 80) positives.push('Baja probabilidad de tormentas');
  if (midCloud >= 70 && (mode === 'sunriseSunset' || mode === 'landscape')) positives.push('Nubosidad media útil para textura de cielo');
  if (Number.isFinite(cloudiness)) {
    if (['landscape','sunriseSunset','coast','nature','architecture'].includes(mode) && cloudiness >= 35 && cloudiness <= 75) positives.push('Nubosidad favorable para textura y volumen');
    if ((mode === 'sunriseSunset' || mode === 'coast') && cloudiness >= 70) positives.push('Nubosidad favorable para textura y color');
    if ((mode === 'sunriseSunset' || mode === 'coast') && cloudiness < 20) positives.push('Cielo parcialmente despejado');
    if (mode === 'nocturnal' && cloudiness >= 75) negatives.push('Nubosidad elevada al inicio de la noche');
    if (mode === 'nocturnal' && cloudiness <= 25) positives.push('Nubosidad baja al inicio de la noche');
  }
  if (mode === 'nocturnal' && lateNight.rain) negatives.push('Lluvia prevista en las últimas 3 horas del día');
  if (mode === 'nocturnal' && lateNight.storm) negatives.push('Tormenta prevista en las últimas 3 horas del día');
  if (lowCloud < 45) negatives.push('Nubosidad baja elevada');
  if (rainProbability < 50) negatives.push('Probabilidad de lluvia significativa');
  if (storms < 50) negatives.push('Riesgo de tormenta elevado');
  if (wind < 45) negatives.push('Viento poco favorable');
  return { score, category: score >= 81 ? 'Excelente' : score >= 61 ? 'Bueno' : score >= 41 ? 'Aceptable' : score >= 21 ? 'Desfavorable' : 'Muy desfavorable', factors: { ...scores, cloudiness, lateNightPenalty: lateNight.penalty }, positives, negatives };
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


export function calculateBestPhotographyMoment({ hourly = [], openWeatherPoints = [], astronomy = null, mode = 'landscape', startHour = null, endHour = null } = {}) {
  const owByHour = new Map((openWeatherPoints || []).filter(p => Number.isInteger(p.hour)).map(p => [p.hour, p]));
  const toDate = row => {
    if (!row?.date || !Number.isInteger(row.hour)) return null;
    const d = new Date(`${row.date}T${String(row.hour).padStart(2,'0')}:00:00+02:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const inSolarRange = (d, range) => Array.isArray(range) && range[0] instanceof Date && range[1] instanceof Date && d >= range[0] && d <= range[1];
  const candidates = (hourly || []).map(row => {
    const date = toDate(row);
    if (!date) return null;
    const ow = owByHour.get(row.hour);
    const isGolden = inSolarRange(date, astronomy?.goldenMorning) || inSolarRange(date, astronomy?.goldenEvening);
    const isBlue = inSolarRange(date, astronomy?.blueMorning) || inSolarRange(date, astronomy?.blueEvening);
    const isNight = row.hour >= 20 || row.hour <= 5;
    const isDay = row.hour >= 7 && row.hour < 20;
    let allowed = true;
    if (startHour !== null && startHour !== undefined && endHour !== null && endHour !== undefined) {
      const h = row.hour;
      allowed = startHour <= endHour ? h >= startHour && h <= endHour : (h >= startHour || h <= endHour);
    } else if (mode === 'sunriseSunset') {
      allowed = isGolden || isBlue;
      if (!allowed) {
        const hasSpecialWindow = (hourly || []).some(candidate => {
          if (!candidate?.date || !Number.isInteger(candidate.hour)) return false;
          const candidateDate = new Date(`${candidate.date}T${String(candidate.hour).padStart(2,'0')}:00:00+02:00`);
          return inSolarRange(candidateDate, astronomy?.goldenMorning) || inSolarRange(candidateDate, astronomy?.goldenEvening) || inSolarRange(candidateDate, astronomy?.blueMorning) || inSolarRange(candidateDate, astronomy?.blueEvening);
        });
        allowed = !hasSpecialWindow && isDay;
      }
    } else if (mode === 'nocturnal') {
      allowed = isNight;
    } else {
      allowed = isDay;
    }
    if (!allowed) return null;
    const merged = {
      ...row,
      visibility: ow?.visibility ?? null,
      openWeatherPoints: ow ? [ow] : [],
      cloudiness: Number.isFinite(ow?.cloudiness) ? ow.cloudiness : null
    };
    const scoreData = {
      rain: row.precipitation,
      rainProbability: row.rainProbability,
      stormProbability: row.stormProbability,
      wind: row.wind?.speed,
      temperature: row.temperature,
      humidity: row.humidity,
      visibility: ow?.visibility ?? null,
      hourly: [merged],
      openWeatherPoints: ow ? [ow] : []
    };
    const scored = calculatePhotographyScore(scoreData, mode);
    return { row, date, scoreData, score: scored.score, scored, label: isGolden ? 'Hora dorada' : isBlue ? 'Hora azul' : isNight ? 'Noche' : 'Día', cloudiness: ow?.cloudiness ?? null };
  }).filter(Boolean);
  candidates.sort((a,b)=>b.score-a.score);
  const best=candidates[0] ?? null;
  if (!best) return null;
  const timeLabel = best.date.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Madrid'});
  const cloudLabel = Number.isFinite(best.cloudiness) ? `Nubosidad ${Math.round(best.cloudiness)} %` : null;
  return { ...best, timeLabel, cloudLabel, reason: best.scored.positives?.[0] ?? best.scored.negatives?.[0] ?? 'Condiciones combinadas favorables.' };
}
