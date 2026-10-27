import { getNavigationContextFromUrl, getSavedNavigationContext } from './navigation-context.js';
const TZ = 'Europe/Madrid';
const VARIABLES = ['cloud_cover','cloud_cover_low','cloud_cover_mid','cloud_cover_high','visibility','precipitation_probability','relative_humidity_2m'];
const BOUNDS = { south: 37.32, north: 38.72, west: -1.82, east: -0.62 };
const REGION = [
  [38.72,-1.58],[38.70,-1.18],[38.60,-0.82],[38.42,-0.67],[38.15,-0.66],
  [37.88,-0.70],[37.62,-0.73],[37.40,-0.84],[37.32,-1.05],[37.40,-1.35],
  [37.53,-1.62],[37.78,-1.78],[38.10,-1.80],[38.40,-1.75],[38.62,-1.70]
];
const $ = id => document.getElementById(id);
const navigationContext = getNavigationContextFromUrl() || getSavedNavigationContext();
const selectedContext = navigationContext && Number.isFinite(navigationContext.latitude) && Number.isFinite(navigationContext.longitude)
  ? { latitude:navigationContext.latitude, longitude:navigationContext.longitude, name:navigationContext.name || 'Ubicación seleccionada', date:navigationContext.date }
  : null;
const map = L.map('arrebol-map', { preferCanvas: true }).setView([37.85, -1.25], 8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);
L.polygon(REGION, { color:'#38BDF8', weight:2, opacity:.75, fill:false, dashArray:'5 6' }).addTo(map);
const samplesLayer = L.layerGroup().addTo(map);
const bounds = L.latLngBounds([[BOUNDS.south, BOUNDS.west],[BOUNDS.north, BOUNDS.east]]);
map.fitBounds(bounds, { padding:[12,12] });
let samples = [];
let selectedLayer = null;

function localDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const p = Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function shiftDate(date, days) { const [y,m,d]=date.split('-').map(Number); const dt=new Date(Date.UTC(y,m-1,d+days,12)); return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`; }
function insideRegion(lat, lon) {
  let inside=false;
  for(let i=0,j=REGION.length-1;i<REGION.length;j=i++) {
    const [yi,xi]=REGION[i], [yj,xj]=REGION[j];
    const intersect=((xi>lon)!==(xj>lon)) && (lat < (yj-yi)*(lon-xi)/(xj-xi+1e-12)+yi);
    if(intersect) inside=!inside;
  }
  return inside;
}
function makeGrid() {
  const points=[];
  const latStep=.19, lonStep=.19;
  for(let lat=37.40;lat<=38.66;lat+=latStep) {
    for(let lon=-1.73;lon<=-.70;lon+=lonStep) {
      const la=Number(lat.toFixed(3)), lo=Number(lon.toFixed(3));
      if(insideRegion(la,lo)) points.push({latitude:la,longitude:lo,name:regionName(la,lo)});
    }
  }
  if (selectedContext) {
    const existing = points.find(p => Math.abs(p.latitude-selectedContext.latitude)<0.015 && Math.abs(p.longitude-selectedContext.longitude)<0.015);
    if (existing) { existing.name = selectedContext.name; existing.isSelected = true; existing.latitude = selectedContext.latitude; existing.longitude = selectedContext.longitude; }
    else points.push({ latitude:selectedContext.latitude, longitude:selectedContext.longitude, name:selectedContext.name, isSelected:true });
  }
  return points;
}
function regionName(lat,lon) {
  if(lon < -1.45) return lat > 38.1 ? 'Noroeste regional' : 'Interior occidental';
  if(lat > 38.35) return lon > -1.05 ? 'Altiplano y nordeste' : 'Norte regional';
  if(lon > -.90 && lat < 37.9) return 'Costa y Campo de Cartagena';
  if(lat < 37.65) return 'Litoral sur';
  if(lon > -1.2 && lat > 37.9) return 'Huerta de Murcia y entorno';
  return 'Interior de la Región';
}
function sunsetFor(date, lat, lon) {
  if(!window.SunCalc) return null;
  const [y,m,d]=date.split('-').map(Number);
  const noon=new Date(Date.UTC(y,m-1,d,12));
  const times=window.SunCalc.getTimes(noon,lat,lon);
  return times.sunset && Number.isFinite(times.sunset.getTime()) ? times.sunset : null;
}
function localParts(date) {
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return {hour:Number(p.hour),minute:Number(p.minute)};
}
function scorePoint(point, date, hourly) {
  if(!hourly?.time?.length) return {status:'unavailable',message:'Sin datos horarios'};
  const sunset=sunsetFor(date,point.latitude,point.longitude);
  if(!sunset) return {status:'unavailable',message:'No se pudo calcular el ocaso'};
  const sunsetLocal=localParts(sunset), sunsetDecimal=sunsetLocal.hour+sunsetLocal.minute/60;
  const indexes=[];
  hourly.time.forEach((time,i)=>{
    if(!String(time).startsWith(date)) return;
    const h=Number(String(time).slice(11,13));
    if(Math.abs(h-sunsetDecimal)<=1.01) indexes.push(i);
  });
  const usable=indexes.map(i=>{
    const row={time:hourly.time[i]};
    VARIABLES.forEach(k=>row[k]=Array.isArray(hourly[k])?hourly[k][i]:null);
    return row;
  }).filter(r=>['cloud_cover_high','cloud_cover_mid','cloud_cover_low','cloud_cover','visibility'].some(k=>Number.isFinite(r[k])));
  if(usable.length<2) return {status:'unavailable',message:'Datos insuficientes cerca del ocaso'};
  const mean=k=>{const a=usable.map(r=>r[k]).filter(Number.isFinite);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null;};
  const high=mean('cloud_cover_high'),mid=mean('cloud_cover_mid'),low=mean('cloud_cover_low'),total=mean('cloud_cover'),visibility=mean('visibility'),precip=mean('precipitation_probability'),humidity=mean('relative_humidity_2m');
  let weighted=0,weight=0;
  const add=(v,w)=>{if(Number.isFinite(v)){weighted+=Math.max(0,Math.min(100,v))*w;weight+=w;}};
  add(high===null?null:Math.min(100,high*1.05),.30);
  add(mid===null?null:Math.min(100,mid*1.10),.32);
  add(low===null?null:Math.max(0,100-low*1.35),.18);
  add(visibility===null?null:Math.max(0,Math.min(100,visibility/10000*100)),.12);
  add(precip===null?null:Math.max(0,100-precip*1.4),.08);
  if(weight<.55) return {status:'unavailable',message:'Nubosidad por capas o visibilidad insuficientes'};
  let score=Math.round(weighted/weight);
  if(Number.isFinite(low)&&low>=80) score=Math.min(score,35);
  if(Number.isFinite(precip)&&precip>=70) score=Math.min(score,45);
  const available=['cloud_cover_high','cloud_cover_mid','cloud_cover_low','visibility','precipitation_probability'].filter(k=>usable.some(r=>Number.isFinite(r[k]))).length;
  const confidence=Math.round(Math.min(95,Math.max(25,usable.length*18+available*7)));
  const positive=[],negative=[];
  if(Number.isFinite(high)&&high>=25&&high<=85) positive.push('Nubosidad alta que podría recibir tonos cálidos.');
  if(Number.isFinite(mid)&&mid>=20&&mid<=80) positive.push('Nubosidad media que puede aportar textura.');
  if(Number.isFinite(visibility)&&visibility>=10000) positive.push('Visibilidad prevista relativamente buena.');
  if(Number.isFinite(low)&&low>=70) negative.push('Mucha nubosidad baja; puede bloquear la luz del horizonte.');
  if(Number.isFinite(precip)&&precip>=50) negative.push('Probabilidad de precipitación elevada.');
  if(Number.isFinite(high)&&Number.isFinite(mid)&&high<15&&mid<15) negative.push('Poca nubosidad alta y media disponible para teñirse.');
  if(!positive.length) positive.push('No destaca un factor favorable claro con las variables disponibles.');
  if(!negative.length) negative.push('No aparece un impedimento claro en las variables consultadas.');
  return {status:'ok',score,confidence,sampleCount:usable.length,sunset,windowStart:new Date(sunset.getTime()-15*60000),windowEnd:new Date(sunset.getTime()+45*60000),factors:{high,mid,low,total,visibility,precip,humidity},positive,negative};
}
function scoreColor(score) {
  if(score<20)return '#64748B'; if(score<40)return '#2563EB'; if(score<60)return '#22C55E'; if(score<80)return '#F59E0B'; return '#EF4444';
}
function level(score) { if(score<20)return 'Muy bajo'; if(score<40)return 'Bajo'; if(score<60)return 'Moderado'; if(score<80)return 'Alto'; return 'Muy alto'; }
function fmtTime(date) { return new Intl.DateTimeFormat('es-ES',{timeZone:TZ,hour:'2-digit',minute:'2-digit'}).format(date); }
function safeText(s) { return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function showDetail(point, layer) {
  if(selectedLayer) selectedLayer.setStyle({weight:1,color:'#E2E8F0',opacity:.65});
  selectedLayer=layer; if(layer) layer.setStyle({weight:3,color:'#FFFFFF',opacity:1});
  $('selected-place').textContent=point.name;
  $('selected-coordinates').textContent=`${point.latitude.toFixed(3)}, ${point.longitude.toFixed(3)} · ${point.date}`;
  if(point.status!=='ok') {
    $('selected-score').textContent='—'; $('selected-level').textContent='Sin datos suficientes'; $('selected-window').textContent='Franja de ocaso: —'; $('selected-confidence').textContent='—'; $('confidence-fill').style.width='0%';
    $('selected-positive').innerHTML=`<li>${safeText(point.message||'Sin datos disponibles.')}</li>`; $('selected-negative').innerHTML='<li>Prueba otra fecha o actualiza los datos.</li>'; return;
  }
  $('selected-score').textContent=point.score; $('selected-score').style.color=scoreColor(point.score); $('selected-level').textContent=level(point.score);
  $('selected-window').textContent=`Ocaso ${fmtTime(point.sunset)} · ventana ${fmtTime(point.windowStart)}–${fmtTime(point.windowEnd)}`;
  $('selected-confidence').textContent=`${point.confidence}%`; $('confidence-fill').style.width=`${point.confidence}%`;
  $('selected-positive').innerHTML=point.positive.map(x=>`<li>${safeText(x)}</li>`).join('');
  $('selected-negative').innerHTML=point.negative.map(x=>`<li>${safeText(x)}</li>`).join('');
}
function renderMap(data) {
  samplesLayer.clearLayers(); samples=data;
  let valid=0;
  data.forEach(point=>{
    if(point.status==='ok') valid++;
    const color=point.status==='ok'?scoreColor(point.score):'#64748B';
    const circle=L.circle([point.latitude,point.longitude],{
      radius:point.isSelected?19000:14500, color:point.isSelected?'#FFFFFF':color, weight:point.isSelected?3:1, opacity:point.isSelected?1:.65, fillColor:color, fillOpacity:point.status==='ok'?.34:.08,
      interactive:true
    }).addTo(samplesLayer);
    const center=L.circleMarker([point.latitude,point.longitude],{radius:point.isSelected?8:5,stroke:true,weight:point.isSelected?3:1,color:'#F8FAFC',fillColor:color,fillOpacity:1}).addTo(samplesLayer);
    const popup=point.status==='ok'?`<strong>${safeText(point.name)}</strong><br>Potencial: <b>${point.score}/100 · ${level(point.score)}</b><br>Confianza orientativa: ${point.confidence}%<br><small>Ocaso ${fmtTime(point.sunset)}</small>`:`<strong>${safeText(point.name)}</strong><br>Sin datos suficientes`;
    circle.bindPopup(popup); center.bindPopup(popup);
    const choose=()=>showDetail(point,circle); circle.on('click',choose); center.on('click',()=>{showDetail(point,circle);circle.openPopup();});
    point.layer=circle;
  });
  $('arrebol-status').textContent=`${valid} de ${data.length} zonas con datos · ${$('arrebol-date').value}`;
  const selected = data.find(x=>x.isSelected);
  const best=data.filter(x=>x.status==='ok').sort((a,b)=>b.score-a.score)[0];
  if(selected) {
    showDetail(selected, selected.layer);
    map.setView([selected.latitude, selected.longitude], Math.max(map.getZoom(), 9), { animate:false });
    if(selected.layer) selected.layer.openPopup();
  } else if(best) showDetail(best,best.layer);
  else showDetail({name:'Región de Murcia',latitude:37.85,longitude:-1.25,date:$('arrebol-date').value,status:'unavailable',message:'No hay suficientes datos horarios para la fecha seleccionada.'},null);
}
async function loadMap() {
  const date=$('arrebol-date').value;
  $('arrebol-status').textContent='Consultando nubosidad por capas y visibilidad…'; $('arrebol-refresh').disabled=true;
  try {
    const grid=makeGrid();
    if(!grid.length) throw new Error('No se pudo generar la malla regional.');
    const selectedKey=selectedContext?`${selectedContext.latitude.toFixed(4)}_${selectedContext.longitude.toFixed(4)}`:'regional';
    const cacheKey=`mpwp_arrebol_grid_v2_${date}_${selectedKey}`;
    let result=null;
    try { const cached=JSON.parse(sessionStorage.getItem(cacheKey)||'null'); if(cached&&Date.now()-cached.savedAt<20*60*1000) result=cached.data; } catch {}
    if(!result) {
      const url=new URL('https://api.open-meteo.com/v1/forecast');
      url.search=new URLSearchParams({latitude:grid.map(p=>p.latitude).join(','),longitude:grid.map(p=>p.longitude).join(','),hourly:VARIABLES.join(','),timezone:TZ,forecast_days:'7'}).toString();
      const response=await fetch(url.toString(),{headers:{Accept:'application/json'}});
      if(!response.ok) throw new Error(`Open-Meteo respondió HTTP ${response.status}.`);
      const json=await response.json(); result=Array.isArray(json)?json:[json];
      try { sessionStorage.setItem(cacheKey,JSON.stringify({savedAt:Date.now(),data:result})); } catch {}
    }
    if(result.length!==grid.length) throw new Error('La respuesta meteorológica no coincide con la malla regional.');
    const scored=grid.map((point,i)=>({...point,date,...scorePoint(point,date,result[i]?.hourly)}));
    renderMap(scored);
  } catch(error) {
    $('arrebol-status').innerHTML=`<span class="arrebol-error">No se ha podido cargar el mapa: ${safeText(error.message||'Error desconocido')}. Comprueba la conexión e inténtalo de nuevo.</span>`;
    samplesLayer.clearLayers();
    showDetail({name:'Región de Murcia',latitude:37.85,longitude:-1.25,date,status:'unavailable',message:'No se pudieron obtener los datos de Open-Meteo.'},null);
  } finally { $('arrebol-refresh').disabled=false; }
}
const today=localDateString();
const maxDate=shiftDate(today,6);
const requestedDate=selectedContext?.date;
const initialDate=requestedDate && requestedDate>=today && requestedDate<=maxDate ? requestedDate : today;
$('arrebol-date').value=initialDate; $('arrebol-date').min=today; $('arrebol-date').max=maxDate;
$('arrebol-date').addEventListener('change',loadMap); $('arrebol-refresh').addEventListener('click',loadMap);
loadMap();
