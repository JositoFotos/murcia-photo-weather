const TIME_ZONE = 'Europe/Madrid';
const VARIABLES = ['cloud_cover','cloud_cover_low','cloud_cover_mid','cloud_cover_high','visibility','precipitation_probability','relative_humidity_2m'];

export async function getCandilazoForecast({ latitude, longitude, date, sunset }) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(latitude), longitude: String(longitude),
    hourly: VARIABLES.join(','), timezone: TIME_ZONE, forecast_days: '7'
  }).toString();
  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Open-Meteo respondió HTTP ${response.status}.`);
  const data = await response.json();
  const hourly = data?.hourly;
  if (!hourly || !Array.isArray(hourly.time) || !hourly.time.length) throw new Error('Open-Meteo no ha devuelto datos horarios.');
  if (!hourly.time.some(t => String(t).startsWith(date))) return { status: 'unavailable', message: 'La fecha seleccionada queda fuera del horizonte horario disponible de Open-Meteo.' };
  const sunsetParts = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(sunset);
  const part = type => sunsetParts.find(x => x.type === type)?.value;
  const sunsetHour = Number(part('hour')) + Number(part('minute')) / 60;
  const samples = hourly.time.map((time, i) => {
    if (!String(time).startsWith(date)) return null;
    const hour = Number(String(time).slice(11,13));
    if (Math.abs(hour - sunsetHour) > 1.01) return null;
    const point = { time, hour };
    for (const key of VARIABLES) point[key] = Array.isArray(hourly[key]) ? hourly[key][i] : null;
    return point;
  }).filter(Boolean);
  const usable = samples.filter(p => ['cloud_cover_high','cloud_cover_mid','cloud_cover_low','cloud_cover','visibility'].some(k => Number.isFinite(p[k])));
  if (usable.length < 2) return { status: 'unavailable', message: 'No hay suficientes observaciones horarias alrededor del ocaso para estimar el potencial.' };
  const mean = key => { const vals=usable.map(p=>p[key]).filter(Number.isFinite); return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null; };
  const high=mean('cloud_cover_high'), mid=mean('cloud_cover_mid'), low=mean('cloud_cover_low'), total=mean('cloud_cover');
  const visibility=mean('visibility'), precip=mean('precipitation_probability'), humidity=mean('relative_humidity_2m');
  // Transparent experimental heuristic, not a calibrated probability.
  let score=0, weight=0;
  const add=(value,w)=>{ if(Number.isFinite(value)){ score += Math.max(0,Math.min(100,value))*w; weight += w; } };
  add(high===null?null:Math.min(100, high*1.05), .30);
  add(mid===null?null:Math.min(100, mid*1.10), .32);
  add(low===null?null:Math.max(0,100-low*1.35), .18);
  add(visibility===null?null:Math.max(0,Math.min(100,(visibility/10000)*100)), .12);
  add(precip===null?null:Math.max(0,100-precip*1.4), .08);
  if (weight < .55) return { status: 'unavailable', message: 'Los datos de nubosidad por capas o visibilidad son insuficientes para una estimación prudente.' };
  score = Math.round(score / weight);
  // Dense low cloud can prevent the low sun from illuminating clouds above the horizon.
  if (Number.isFinite(low) && low >= 80) score = Math.min(score, 35);
  if (Number.isFinite(precip) && precip >= 70) score = Math.min(score, 45);
  const availableFields = ['cloud_cover_high','cloud_cover_mid','cloud_cover_low','visibility','precipitation_probability'].filter(k=>usable.some(p=>Number.isFinite(p[k]))).length;
  const confidence = Math.round(Math.min(95, Math.max(25, usable.length*18 + availableFields*7)));
  const favorable=[], unfavorable=[];
  if (Number.isFinite(high) && high>=25 && high<=85) favorable.push('Nubosidad alta presente: puede recibir tonos cálidos si la luz alcanza esas capas.');
  if (Number.isFinite(mid) && mid>=20 && mid<=80) favorable.push('Nubosidad media: puede aportar textura y volumen al cielo.');
  if (Number.isFinite(visibility) && visibility>=10000) favorable.push('Visibilidad prevista relativamente buena.');
  if (Number.isFinite(low) && low>=70) unfavorable.push('Mucha nubosidad baja; puede tapar la luz cercana al horizonte.');
  if (Number.isFinite(precip) && precip>=50) unfavorable.push('Probabilidad de precipitación elevada para la franja.');
  if (Number.isFinite(high) && Number.isFinite(mid) && high<15 && mid<15) unfavorable.push('Poca nubosidad alta y media: podría faltar superficie de nubes que se tiña.');
  if (!favorable.length) favorable.push('No destaca un factor claramente favorable con los datos disponibles.');
  if (!unfavorable.length) unfavorable.push('La previsión no muestra un impedimento claro entre las variables disponibles; el horizonte real puede diferir.');
  return { status:'ok', score, confidence, sampleCount:usable.length, sunset, windowStart:new Date(sunset.getTime()-15*60000), windowEnd:new Date(sunset.getTime()+45*60000), factors:{high,mid,low,total,visibility,precip,humidity}, favorable, unfavorable, attribution:'Open-Meteo', modified:true };
}
