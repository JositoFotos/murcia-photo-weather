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
  return { location, score:scored.score, category:scored.category, factors:scored.factors, positives:scored.positives, negatives:scored.negatives, astronomy };
}

function maxOrNull(a){ const x=a.filter(Number.isFinite); return x.length?Math.max(...x):null; }
function avgOrNull(a){ const x=a.filter(Number.isFinite); return x.length?x.reduce((s,v)=>s+v,0)/x.length:null; }

export function rankLocations(results) { return [...results].sort((a,b)=>b.score-a.score); }
export function compareLocations(results) { return rankLocations(results).slice(0,6); }
export async function exploreMurcia({ weatherLoader, mode }) {
  const out=[];
  for (const location of PHOTO_LOCATIONS) {
    const municipality = getMunicipalityById(location.municipalityId);
    if (!municipality) continue;
    try {
      const weather = await weatherLoader(municipality);
      out.push({ location, municipality, weather });
    } catch (error) { out.push({ location, municipality, error }); }
  }
  return out.map(x => ({ ...x, opportunity: x.weather ? calculateLocationOpportunity(x.location, x.weather, { date:new Date().toISOString().slice(0,10) }, mode) : null })).filter(x=>x.opportunity).map(x=>x.opportunity);
}
