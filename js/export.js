import { formatTime, formatRange } from './astronomy.js';

function download(filename, content, type) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
function flattenForCsv(obj) { return Object.fromEntries(Object.entries(obj).map(([k,v]) => [k, typeof v === 'object' ? JSON.stringify(v) : v])); }

export function exportJSON(snapshot) { download('murcia-photo-weather.json', JSON.stringify(snapshot, null, 2), 'application/json'); }
export function exportCSV(snapshot) {
  const rows = (snapshot.weather?.hourly ?? []).map(x => flattenForCsv({ date:x.date, hour:x.hour, temperature:x.temperature, humidity:x.humidity, rainProbability:x.rainProbability, precipitation:x.precipitation, stormProbability:x.stormProbability, windSpeed:x.wind?.speed, windDirection:x.wind?.direction, sky:x.sky?.description }));
  const headers = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
  download('murcia-photo-weather.csv', csv, 'text/csv;charset=utf-8');
}
export async function copySummary(snapshot, copyText = async text => navigator.clipboard.writeText(text)) {
  const { location, date, indices, astronomy, summary } = snapshot;
  const text = `📸 Murcia Photo Weather\n\n📍 ${location.name}\n📅 ${new Intl.DateTimeFormat('es-ES').format(new Date(`${date}T12:00:00`))}\n🌇 Atardecer: ${formatTime(astronomy?.sunset)}\n⭐ Índice: ${indices.general}/100\n\n☁ Nubosidad: ${summary.skyDescriptions.join(', ') || 'N/D'}\n🌧 Prob. lluvia: ${Number.isFinite(summary.rainProbability) ? summary.rainProbability + ' %' : 'N/D'}\n💨 Viento: ${Number.isFinite(summary.wind.mean) ? Math.round(summary.wind.mean) + ' km/h' : 'N/D'}\n\nRecomendación:\n${snapshot.recommendation}`;
  await copyText(text); return text;
}
export function generateShareUrl(location, date) { const url = new URL(window.location.href); url.searchParams.set('lat', location.latitude.toFixed(6)); url.searchParams.set('lon', location.longitude.toFixed(6)); url.searchParams.set('date', date); return url.toString(); }
