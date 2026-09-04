import { calculateSunTimes, formatTime, getMoonData, calculateMilkyWay, calculateAstronomicalEvents } from './astronomy.js';
import { PHOTO_LOCATIONS } from '../data/photo-locations.js';
import { getWeatherData, processAemetData } from './aemet.js';
import { getMunicipalityById } from './locations.js';
import { exploreMurcia } from './opportunities.js';
import { loadWeatherCache, saveWeatherCache } from './storage.js';
import { CONFIG } from './config.js';

const $ = id => document.getElementById(id);

function localDateISO(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function paramsState(){const p=new URLSearchParams(location.search);return {lat:Number(p.get('lat')),lon:Number(p.get('lon')),date:p.get('date')||localDateISO(),name:p.get('name')||'Ubicación seleccionada',mode:p.get('mode')||'landscape'};}
function fmtTime(v){return v?formatTime(v):'N/D'}
function currentMode(){ return new URLSearchParams(location.search).get('mode') || 'landscape'; }
function updateLinks(){
  const lat=Number($('astro-lat').value),lon=Number($('astro-lon').value),date=$('astro-date').value,name=$('astro-location').value||'Ubicación astronómica',mode=currentMode();
  const params=new URLSearchParams({lat:String(lat),lon:String(lon),date,name,mode});
  const q=`?${params.toString()}`;
  $('photo-link').href=`index.html${q}`;
  $('back-photo').href=`index.html${q}`;
}

function render(){
  const lat=Number($('astro-lat').value),lon=Number($('astro-lon').value),date=$('astro-date').value;
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||!date){$('astro-status').textContent='Faltan datos';return;}
  const sun=calculateSunTimes(date,lat,lon);
  const moon=getMoonData(date,lat,lon);
  const mw=calculateMilkyWay(date,lat,lon,sun,moon);
  const events=calculateAstronomicalEvents(date,lat,lon,CONFIG.DEFAULT_TIME_ZONE);
  $('moon-info').innerHTML=`<div class="astro-main"><span class="astro-icon moon">${moon.icon}</span><div><span class="astro-kicker">Fase lunar</span><strong>${moon.name}</strong><span class="astro-muted">${moon.illuminationPercent}% iluminada · ${moon.waxing?'creciente':'menguante'}</span></div></div><div class="astro-stats"><div><span>Salida</span><strong>${fmtTime(moon.rise)}${moon.riseDateLabel ? ` <small>${moon.riseDateLabel}</small>` : ''}</strong></div><div><span>Puesta</span><strong>${fmtTime(moon.set)}${moon.setDateLabel ? ` <small>${moon.setDateLabel}</small>` : ''}</strong></div><div><span>Distancia</span><strong>${Number.isFinite(moon.distance)?Math.round(moon.distance).toLocaleString('es-ES')+' km':'N/D'}</strong></div><div><span>Altura · 12h</span><strong>${Number.isFinite(moon.altitude)?Math.round(moon.altitude*180/Math.PI)+'°':'N/D'}</strong></div></div>`;
  $('milky-way-info').innerHTML=`<div class="astro-main"><span class="astro-icon">🌌</span><div><span class="astro-kicker">Visibilidad fotográfica</span><strong>${mw.score}/100</strong><span class="astro-muted">${mw.label || (mw.score>=80?'Excelente':mw.score>=60?'Favorable':mw.score>=40?'Moderada':'Limitada')}</span></div></div><div class="astro-stats"><div><span>Ventana</span><strong>${mw.start&&mw.end?fmtTime(mw.start)+'–'+fmtTime(mw.end):'N/D'}</strong></div><div><span>Máxima altura</span><strong>${Number.isFinite(mw.bestAltitude)?Math.round(mw.bestAltitude)+'°':'N/D'}</strong></div><div><span>Mejor momento</span><strong>${fmtTime(mw.bestTime)}</strong></div><div><span>Azimut aprox.</span><strong>${Number.isFinite(mw.centerAzimuth)?Math.round(mw.centerAzimuth)+'°':'N/D'}</strong></div></div><p class="astro-note">Estimación astronómica para fotografía nocturna; la nubosidad real debe comprobarse en la página de Fotografía.</p>`;
  $('astro-events').innerHTML=events.length?events.map(e=>`<article class="astro-event"><strong>${e.icon||'🔭'} ${e.title}</strong><span>${e.detail||e.description||''}</span></article>`).join(''):'<div class="empty">No hay eventos destacados calculados para esta fecha.</div>';
  updateLinks();
  $('astro-status').textContent=`Actualizado · ${$('astro-location').value||'Ubicación'} · ${date}`;
}

async function getWeatherForMunicipality(m){
  const cached=loadWeatherCache(m.id,CONFIG.CACHE_DURATION);
  if(cached)return cached;
  const normalized=processAemetData(await getWeatherData(m.id),m);
  saveWeatherCache(m.id,normalized);
  return normalized;
}

function renderOpportunityCards(ranked){
  const container=$('astro-opportunity-ranking');
  if(!container)return;
  const medals=['🥇','🥈','🥉'];
  container.innerHTML = ranked.slice(0,6).map((item,index)=>`<button class="ranking-row astro-ranking-row" data-opportunity-id="${item.location.id}" type="button"><span><strong>${medals[index]||`${index+1}.`}</strong> ${item.location.name}<small>${item.category}</small></span><strong>${item.score}/100</strong></button>`).join('') || '<div class="empty">No se han podido obtener predicciones para las localizaciones.</div>';
  container.querySelectorAll('[data-opportunity-id]').forEach(button=>{
    button.addEventListener('click',()=>{
      const item=ranked.find(x=>x.location.id===button.dataset.opportunityId);
      if(!item)return;
      const q=new URLSearchParams({
        lat:String(item.location.latitude),
        lon:String(item.location.longitude),
        date:$('astro-date').value,
        name:item.location.name,
        mode:currentMode()
      });
      location.href=`index.html?${q.toString()}`;
    });
  });
}

async function refreshOpportunityRanking(){
  const status=$('astro-map-score-status');
  if(!status)return;
  status.textContent='Analizando…';
  try{
    const mode=currentMode();
    const ranked=await exploreMurcia({weatherLoader:getWeatherForMunicipality,mode,date:$('astro-date').value});
    renderOpportunityCards(ranked);
    status.textContent=`${Math.min(ranked.length,6)} destacadas de ${ranked.length}`;
  }catch(error){
    status.textContent='No disponible';
    $('astro-opportunity-ranking').innerHTML=`<div class="empty">No se ha podido cargar el ranking de oportunidades: ${error.message}</div>`;
  }
}

async function refreshAstronomy({reloadMap=true}={}){
  render();
  if(reloadMap) await refreshOpportunityRanking();
}

const st=paramsState();
if(Number.isFinite(st.lat))$('astro-lat').value=st.lat;
if(Number.isFinite(st.lon))$('astro-lon').value=st.lon;
$('astro-date').value=st.date;
$('astro-location').value=st.name;
$('astro-update').addEventListener('click',()=>refreshAstronomy({reloadMap:true}));
['astro-lat','astro-lon','astro-location'].forEach(id=>$(id).addEventListener('change',()=>refreshAstronomy({reloadMap:true})));
$('astro-date').addEventListener('change',()=>refreshAstronomy({reloadMap:true}));
$('astro-date').addEventListener('input',render);
refreshAstronomy({reloadMap:true}).catch(error=>{ $('astro-status').textContent=`Error: ${error.message}`; });
