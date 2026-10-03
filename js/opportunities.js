import { PHOTO_LOCATIONS } from '../data/photo-locations.js';
import { getMunicipalityById } from './locations.js';
import { calculatePhotographyScore, calculateBestPhotographyMoment, buildPhotographyScoreData } from './photography.js';
import { calculateSunTimes } from './astronomy.js';

export function calculateLocationOpportunity(location, weather, astronomy, mode, openWeatherPoints = []) {
  const hourly = weather?.hourly ?? [];
  const candidates = hourly.filter(x => !x.date || x.date === astronomy.date);
  const base = candidates.length ? candidates : hourly;
  const agg = buildPhotographyScoreData(base, openWeatherPoints);
  const scored = calculatePhotographyScore(agg, mode);
  const bestMoment = calculateBestPhotographyMoment({ hourly: base, openWeatherPoints, astronomy: astronomy.sunTimes ?? null, mode });
  return { location, score:scored.score, category:scored.category, factors:scored.factors, positives:scored.positives, negatives:scored.negatives, bestMoment, astronomy, weather, openWeatherPoints };
}

function maxOrNull(a){ const x=a.filter(Number.isFinite); return x.length?Math.max(...x):null; }
function avgOrNull(a){ const x=a.filter(Number.isFinite); return x.length?x.reduce((s,v)=>s+v,0)/x.length:null; }

export function rankLocations(results) { return [...results].sort((a,b)=>b.score-a.score); }
export function compareLocations(results) { return rankLocations(results).slice(0,6); }

export async function exploreMurcia({ weatherLoader, openWeatherLoader = null, mode, date, filterMoment = 'all', startHour = null, endHour = null } = {}) {
  const out=[];
  const weatherByMunicipality = new Map();
  const openWeatherByLocation = new Map();
  const selectedDate = date || new Date().toISOString().slice(0,10);

  // Consultamos AEMET una sola vez por municipio y de forma secuencial.
  // Así evitamos ráfagas de peticiones que provocan HTTP 429.
  const municipalities = [];
  const seenMunicipalities = new Set();
  for (const location of PHOTO_LOCATIONS) {
    const municipality = getMunicipalityById(location.municipalityId);
    if (municipality && !seenMunicipalities.has(municipality.id)) {
      seenMunicipalities.add(municipality.id);
      municipalities.push(municipality);
    }
  }

  for (let index = 0; index < municipalities.length; index += 1) {
    const municipality = municipalities[index];
    try {
      const weather = await weatherLoader(municipality);
      weatherByMunicipality.set(municipality.id, weather);
    } catch (error) {
      console.warn(`No se pudo obtener AEMET para ${municipality.name}:`, error);
    }
    if (index < municipalities.length - 1) await new Promise(resolve => setTimeout(resolve, 550));
  }

  // OpenWeather se obtiene para las coordenadas exactas de cada localización.
  // Así Recomendados y Fotografía utilizan exactamente la misma referencia geográfica.
  if (openWeatherLoader) {
    for (const location of PHOTO_LOCATIONS) {
      try {
        const forecast = await openWeatherLoader(location);
        openWeatherByLocation.set(location.id, forecast?.points?.filter(p => p.date === selectedDate) ?? []);
      } catch (error) {
        console.warn(`No se pudo obtener OpenWeather para ${location.name}:`, error);
      }
    }
  }

  for (const location of PHOTO_LOCATIONS) {
    const municipality = getMunicipalityById(location.municipalityId);
    if (!municipality) continue;
    const weather = weatherByMunicipality.get(municipality.id);
    if (!weather) continue;
    const openWeatherPoints = openWeatherByLocation.get(location.id) ?? [];
    try {
      const hourlyForDate = weather.hourly?.filter(x => x.date === selectedDate) ?? [];
      if (!hourlyForDate.length) {
        console.warn(`Sin predicción horaria para ${location.name} el ${selectedDate}`);
        continue;
      }
      const astronomy={ date:selectedDate, sunTimes: calculateSunTimes(selectedDate, location.latitude, location.longitude) };
      let opportunity = calculateLocationOpportunity(location, { ...weather, hourly:hourlyForDate }, astronomy, mode, openWeatherPoints);
      let windowStart = startHour, windowEnd = endHour;
      if (filterMoment && filterMoment !== 'all') {
        const hourMap = { dawn:[5,9], day:[9,18], sunset:[18,22], night:[22,5] };
        const range = hourMap[filterMoment];
        if (range) { windowStart = range[0]; windowEnd = range[1]; }
      }
      if (windowStart !== null && windowStart !== undefined && windowEnd !== null && windowEnd !== undefined) {
        const filteredMoment = calculateBestPhotographyMoment({ hourly: hourlyForDate, openWeatherPoints, astronomy: astronomy.sunTimes, mode, startHour: windowStart, endHour: windowEnd });
        // Cuando el usuario fija una franja, no permitimos volver al mejor momento de todo el día.
        // Si no existe ningún tramo dentro de la ventana, esta localización no puede competir en el ranking.
        if (!filteredMoment) {
          console.warn(`Sin tramo horario válido para ${location.name} dentro de la franja seleccionada`);
          continue;
        }
        // El índice de la localización sigue siendo el índice general del día.
        // La ventana seleccionada solo determina el "mejor momento" dentro de esa franja.
        // Así Recomendados y Fotografía muestran siempre el mismo índice para una
        // misma localización + fecha + modo, sin confundirlo con la puntuación puntual
        // de una hora concreta.
        opportunity = { ...opportunity, filteredMoment };
      }
      out.push(opportunity);
    } catch (error) {
      console.warn(`No se pudo analizar ${location.name}:`, error);
    }
  }
  return rankLocations(out);
}
