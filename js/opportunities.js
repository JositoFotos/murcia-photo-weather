import { PHOTO_LOCATIONS } from '../data/photo-locations.js';
import { getMunicipalityById } from './locations.js';
import { calculatePhotographyScore } from './photography.js';

export function calculateLocationOpportunity(location, weather, astronomy, mode) {
  const hourly = weather?.hourly ?? [];
  const candidates = hourly.filter(x => !x.date || x.date === astronomy.date);
  const base = candidates.length ? candidates : hourly;
  const agg = {
    rain: maxOrNull(base.map(x=>x.precipitation)),
    rainProbability: maxOrNull(base.map(x=>x.rainProbability)),
    stormProbability: maxOrNull(base.map(x=>x.stormProbability)),
    wind: avgOrNull(base.map(x=>x.wind?.speed)),
    temperature: avgOrNull(base.map(x=>x.temperature)),
    humidity: avgOrNull(base.map(x=>x.humidity)),
    hourly: base
  };
  const scored = calculatePhotographyScore(agg, mode);
  return { location, score:scored.score, category:scored.category, factors:scored.factors, positives:scored.positives, negatives:scored.negatives, astronomy, weather };
}

function maxOrNull(a){ const x=a.filter(Number.isFinite); return x.length?Math.max(...x):null; }
function avgOrNull(a){ const x=a.filter(Number.isFinite); return x.length?x.reduce((s,v)=>s+v,0)/x.length:null; }

export function rankLocations(results) { return [...results].sort((a,b)=>b.score-a.score); }
export function compareLocations(results) { return rankLocations(results).slice(0,6); }

export async function exploreMurcia({ weatherLoader, mode, date }) {
  const out=[];
  const cache = new Map();
  // Varias localizaciones comparten municipio AEMET. Reutilizamos la predicción
  // para no repetir peticiones y reducir el riesgo de límites del servicio.
  for (const location of PHOTO_LOCATIONS) {
    const municipality = getMunicipalityById(location.municipalityId);
    if (!municipality) continue;
    try {
      let weather = cache.get(municipality.id);
      if (!weather) {
        weather = await weatherLoader(municipality);
        cache.set(municipality.id, weather);
      }
      const astronomy={ date:date || new Date().toISOString().slice(0,10) };
      out.push(calculateLocationOpportunity(location, weather, astronomy, mode));
    } catch (error) {
      // Un fallo de una localización no debe cancelar todo el mapa.
      console.warn(`No se pudo analizar ${location.name}:`, error);
    }
  }
  return rankLocations(out);
}
