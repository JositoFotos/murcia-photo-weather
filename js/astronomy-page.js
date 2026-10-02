import { calculateSunTimes, formatTime, getMoonData, calculateMilkyWay, calculateAstronomicalEvents, calculateLunarCalendar, calculateNightConditions } from './astronomy.js';
import { getOpenWeatherForecast, getOpenWeatherForDate } from './openweather.js';
import { CONFIG } from './config.js';

const $=id=>document.getElementById(id);
const localDateISO=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const params=new URLSearchParams(location.search);
const state={
  lat:Number(params.get('lat'))||37.983,
  lon:Number(params.get('lon'))||-1.129,
  name:params.get('name')||'Murcia',
  date:params.get('date')||localDateISO(),
  mode:params.get('mode')||'landscape',
  moon:null,milkyWay:null,events:[],sun:null,openWeather:null,night:null
};

function updateLinks(){
  const q=new URLSearchParams({lat:String(state.lat),lon:String(state.lon),date:state.date,name:state.name,mode:state.mode});
  $('photo-link').href=`index.html?${q}`;
  $('back-photo').href=`index.html?${q}`;
  $('back-recommended').href=`recomendados.html?${q}`;
  $('recommended-link').href=`recomendados.html?${q}`;
}

function render(){
  state.sun=calculateSunTimes(state.date,state.lat,state.lon);
  state.moon=getMoonData(state.date,state.lat,state.lon,CONFIG.DEFAULT_TIME_ZONE);
  state.milkyWay=calculateMilkyWay(state.date,state.lat,state.lon,state.sun,state.moon);
  state.events=calculateAstronomicalEvents(state.date,state.lat,state.lon,CONFIG.DEFAULT_TIME_ZONE);
  const owPoints=getOpenWeatherForDate(state.openWeather,state.date);
  state.night=calculateNightConditions(state.date,state.moon,owPoints,state.sun);

  const m=state.moon;
  $('astro-location').value=state.name;$('astro-lat').value=state.lat;$('astro-lon').value=state.lon;$('astro-date').value=state.date;
  $('moon-info').innerHTML=`<div class="astro-main"><span class="astro-icon moon">${m.icon}</span><div><span class="astro-kicker">Fase lunar</span><strong>${m.name}</strong><span class="astro-muted">${m.illuminationPercent}% iluminada · ${m.waxing?'creciente':'menguante'}</span></div></div><div class="astro-stats"><div><span>Salida</span><strong>${m.rise?formatTime(m.rise,CONFIG.DEFAULT_TIME_ZONE):'N/D'}${m.riseDateLabel?` <small>${m.riseDateLabel}</small>`:''}</strong></div><div><span>Puesta</span><strong>${m.set?formatTime(m.set,CONFIG.DEFAULT_TIME_ZONE):'N/D'}${m.setDateLabel?` <small>${m.setDateLabel}</small>`:''}</strong></div><div><span>Distancia</span><strong>${Number.isFinite(m.distance)?`${Math.round(m.distance).toLocaleString('es-ES')} km`:'N/D'}</strong></div><div><span>Altura · 12h</span><strong>${Number.isFinite(m.altitude)?`${Math.round(m.altitude*180/Math.PI)}°`:'N/D'}</strong></div></div><p class="astro-note">La salida y la puesta se buscan en el día anterior, el seleccionado y el siguiente para evitar huecos de información.</p>`;

  const mw=state.milkyWay;
  $('milky-way-info').innerHTML=`<div class="astro-main"><span class="astro-icon">🌌</span><div><span class="astro-kicker">Centro galáctico</span><strong>${mw.visible?'Ventana nocturna favorable':'No favorable en esta fecha'}</strong><span class="astro-muted">Índice de Vía Láctea: ${mw.score}/100</span></div></div><div class="astro-stats"><div><span>Máxima altura</span><strong>${Number.isFinite(mw.bestAltitude)?`${Math.round(mw.bestAltitude)}°`:'N/D'}</strong></div><div><span>Mejor momento</span><strong>${mw.bestTime?formatTime(mw.bestTime,CONFIG.DEFAULT_TIME_ZONE):'N/D'}</strong></div><div><span>Azimut aprox.</span><strong>${Number.isFinite(mw.centerAzimuth)?`${Math.round(mw.centerAzimuth)}°`:'N/D'}</strong></div><div><span>Luz lunar</span><strong>${m.illuminationPercent}%</strong></div></div><p class="astro-note">${mw.darkStart&&mw.darkEnd?`Noche astronómica aprox.: ${formatTime(mw.darkStart,CONFIG.DEFAULT_TIME_ZONE)}–${formatTime(mw.darkEnd,CONFIG.DEFAULT_TIME_ZONE)}.`:mw.note}</p>`;

  const n=state.night;
  $('night-conditions').innerHTML=`<div class="night-score"><div><span>Índice nocturno</span><strong>${n.score}/100</strong></div><span class="night-score-label">${n.score>=81?'Excelente':n.score>=61?'Favorable':n.score>=41?'Moderado':'Limitado'}</span></div><div class="night-grid"><div><span>☁️ Nubosidad entrada noche</span><strong>${Number.isFinite(n.cloudiness)?Math.round(n.cloudiness)+' %':'N/D'}</strong></div><div><span>🌙 Iluminación lunar</span><strong>${m.illuminationPercent} %</strong></div><div><span>🌧 Prob. lluvia</span><strong>${Number.isFinite(n.rainProbability)?Math.round(n.rainProbability)+' %':'N/D'}</strong></div><div><span>👁 Visibilidad</span><strong>${Number.isFinite(n.visibility)?n.visibility.toLocaleString('es-ES',{maximumFractionDigits:1})+' km':'N/D'}</strong></div></div><p class="astro-note">Se pondera especialmente la nubosidad de 20–21 h, la luz lunar, la lluvia y la visibilidad para el inicio de una sesión nocturna.</p>`;

  const calendar=calculateLunarCalendar(state.date,CONFIG.DEFAULT_TIME_ZONE);
  $('lunar-calendar').innerHTML=calendar.map(day=>`<button type="button" class="lunar-day ${day.selected?'selected':''}" data-lunar-date="${day.date.toISOString().slice(0,10)}" title="${day.name} · ${day.illuminationPercent}% iluminada"><span>${day.label.slice(0,2)}</span><strong>${day.day}</strong><b>${day.icon}</b><small>${day.illuminationPercent}%</small></button>`).join('');
  $('lunar-calendar').querySelectorAll('[data-lunar-date]').forEach(btn=>btn.addEventListener('click',()=>{state.date=btn.dataset.lunarDate;renderAll();}));

  $('astro-events').innerHTML=state.events.length?state.events.map(evt=>`<div class="astro-event"><span class="astro-event-icon">${evt.icon}</span><div><strong>${evt.title}</strong><span>${evt.detail}</span></div></div>`).join(''):'<div class="empty">No hay eventos destacados calculados para esta fecha.</div>';
  $('astro-status').textContent=`Actualizado · ${state.name} · ${state.date}`;
  updateLinks();
}

async function renderAll(){
  try {
    $('astro-status').textContent='Actualizando…';
    state.date=$('astro-date').value||state.date;state.name=$('astro-location').value||state.name;state.lat=Number($('astro-lat').value);state.lon=Number($('astro-lon').value);
    state.openWeather=await getOpenWeatherForecast(state.lat,state.lon,{force:false});
  } catch(error) {
    state.openWeather=null;
  }
  try { render(); } catch(error) { $('astro-status').textContent=`Error: ${error.message}`; }
}

$('astro-update').addEventListener('click',renderAll);
$('astro-date').addEventListener('change',renderAll);
['astro-location','astro-lat','astro-lon'].forEach(id=>$(id).addEventListener('change',renderAll));
$('astro-date').value=state.date;$('astro-location').value=state.name;$('astro-lat').value=state.lat;$('astro-lon').value=state.lon;
renderAll();
