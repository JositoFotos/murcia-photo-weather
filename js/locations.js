import { MUNICIPALITIES } from '../data/municipalities.js';
import { PHOTO_LOCATIONS } from '../data/photo-locations.js';

export function searchLocation(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const coord = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (coord) return [{ kind:'coordinates', label:`${coord[1]}, ${coord[2]}`, latitude:Number(coord[1]), longitude:Number(coord[2]) }];
  return [
    ...MUNICIPALITIES.filter(m => m.name.toLowerCase().includes(q)).map(m => ({ kind:'municipality', label:m.name, ...m })),
    ...PHOTO_LOCATIONS.filter(l => l.name.toLowerCase().includes(q) || l.description.toLowerCase().includes(q)).map(l => ({ kind:'photo', label:l.name, ...l }))
  ].slice(0, 10);
}

export function nearestMunicipality(lat, lon) {
  return MUNICIPALITIES.reduce((best, m) => !best || distance2(lat,lon,m.latitude,m.longitude) < best.d ? { m, d: distance2(lat,lon,m.latitude,m.longitude) } : best, null)?.m ?? null;
}
function distance2(a,b,c,d) { const x=(a-c); const y=(b-d)*Math.cos((a+c)*Math.PI/360); return x*x+y*y; }
export function getMunicipalityById(id) { return MUNICIPALITIES.find(m => m.id === id) ?? null; }
export function getPhotoLocationById(id) { return PHOTO_LOCATIONS.find(l => l.id === id) ?? null; }
