import { CONFIG } from './config.js';
import { PHOTO_LOCATIONS } from '../data/photo-locations.js';
import { getHourlyForecast, processAemetData } from './aemet.js';
import { getMunicipalityById } from './locations.js';
import { getOpenWeatherForecast } from './openweather.js';
import { exploreMurcia } from './opportunities.js';
import { initMap, renderOpportunities, setLocation, fitMurcia } from './map.js';
import { loadWeatherCache, saveWeatherCache } from './storage.js';

const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const localDateISO=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const validModes=['landscape','sunriseSunset','coast','nature','architecture','nocturnal'];
const state={date:params.get('date')||localDateISO(),mode:validModes.includes(params.get('mode'))?params.get('mode'):'landscape',moment:params.get('moment')||'all',results:[],selected:null};

function setStatus(message,kind='ready'){const el=$('recommended-app-status');el.dataset.state=kind;el.textContent=message;}
function timeToHour(value){if(!value)return null;const [h,m]=value.split(':').map(Number);return Number.isFinite(h)?h+(m||0)/60:null;}
function updateLinks(){
  const params={date:state.date,mode:state.mode,moment:state.moment};
  if(state.selected?.location){ params.lat=String(state.selected.location.latitude); params.lon=String(state.selected.location.longitude); params.name=state.selected.location.name || 'Ubicación seleccionada'; }
  const q=new URLSearchParams(params);
  $('photo-link').href=`index.html?${q}`;
  $('astronomy-link').href=`astronomia.html?${q}`;
}

const opportunityWeatherSessionCache = new Map();
const opportunityOpenWeatherSessionCache = new Map();
async function weatherLoader(m){
  const cachedSession = opportunityWeatherSessionCache.get(m.id);
  if (cachedSession) return cachedSession;
  const cached = loadWeatherCache(m.id, CONFIG.CACHE_DURATION);
  if (cached?.hourly?.length) { opportunityWeatherSessionCache.set(m.id, cached); return cached; }
  const rawHourly = await getHourlyForecast(m.id);
  const normalized = processAemetData({ daily:null, hourly:rawHourly }, m);
  opportunityWeatherSessionCache.set(m.id, normalized);
  return normalized;
}

async function openWeatherLoader(m){
  const cached = opportunityOpenWeatherSessionCache.get(m.id);
  if (cached) return cached;
  const forecast = await getOpenWeatherForecast(m.latitude,m.longitude,{force:false});
  opportunityOpenWeatherSessionCache.set(m.id, forecast);
  return forecast;
}

function parseMomentRange(){
  if(state.moment==='custom') return {startHour:timeToHour($('session-start').value),endHour:timeToHour($('session-end').value)};
  return {startHour:null,endHour:null};
}

function selectedTime(item){return item.filteredMoment?.timeLabel || item.bestMoment?.timeLabel || 'N/D';}
function selectedReason(item){return item.filteredMoment?.reason || item.bestMoment?.reason || (item.positives?.[0] || 'Condiciones combinadas favorables.');}

function renderBest(item){
  if(!item){$('recommended-best-title').textContent='Sin una oportunidad clara';$('recommended-best-subtitle').textContent='No se han podido obtener suficientes datos para esta combinación.';$('recommended-best-score').textContent='—';$('recommended-best-details').innerHTML='';return;}
  const moment= item.filteredMoment || item.bestMoment;
  $('recommended-best-title').textContent=`${item.location.name} · ${moment?.timeLabel||'momento no disponible'}`;
  $('recommended-best-subtitle').textContent=selectedReason(item);
  $('recommended-best-score').textContent=`${item.score}/100`;
  const chips=[];
  if(Number.isFinite(moment?.cloudiness))chips.push(`☁️ ${Math.round(moment.cloudiness)} % nubosidad`);
  if(Number.isFinite(moment?.row?.rainProbability))chips.push(`🌧 ${Math.round(moment.row.rainProbability)} % lluvia`);
  if(Number.isFinite(moment?.row?.wind?.speed))chips.push(`💨 ${Math.round(moment.row.wind.speed)} km/h`);
  $('recommended-best-details').innerHTML=chips.map(x=>`<span>${x}</span>`).join('');
}

function renderRanking(){
  const container=$('recommended-ranking');
  const rows=state.results.slice(0,CONFIG.RECOMMENDED_MAX_RESULTS);
  container.innerHTML=rows.map((item,index)=>`<button type="button" class="recommended-row" data-id="${item.location.id}"><span class="recommended-row-main"><strong>${['🥇','🥈','🥉'][index]||`${index+1}.`}</strong><span>${item.location.name}<small>${item.category}${(item.filteredMoment||item.bestMoment)?.timeLabel?` · ${(item.filteredMoment||item.bestMoment).timeLabel}`:''}</small></span></span><strong>${item.score}/100</strong></button>`).join('')||'<div class="empty">No hay localizaciones con datos suficientes.</div>';
  container.querySelectorAll('[data-id]').forEach(btn=>btn.addEventListener('click',()=>{const item=state.results.find(x=>x.location.id===btn.dataset.id);if(item)selectItem(item);}));
}

function selectItem(item){
  state.selected=item;
  setLocation(item.location.latitude,item.location.longitude,{label:item.location.name});
  renderBest(item);
  const q=new URLSearchParams({lat:item.location.latitude,lon:item.location.longitude,date:state.date,name:item.location.name,mode:state.mode,moment:state.moment});
  history.replaceState(null,'',`recomendados.html?${q}`);
  updateLinks();
}

async function run(){
  state.date=$('recommended-date').value||state.date;state.mode=$('recommended-mode').value;state.moment=$('recommended-moment').value;
  const {startHour,endHour}=parseMomentRange();
  $('recommended-status').textContent='Analizando…';$('recommended-ranking').innerHTML='<div class="empty">Consultando AEMET y OpenWeather…</div>';
  setStatus('Analizando localizaciones…','loading');updateLinks();
  try{
    const ranked=await exploreMurcia({weatherLoader,openWeatherLoader,mode:state.mode,date:state.date,filterMoment:state.moment,startHour,endHour});
    state.results=ranked;renderRanking();
    $('recommended-status').textContent=`${ranked.length} localizaciones`;
    renderOpportunities(ranked,item=>selectItem(item));
    if(ranked[0]){selectItem(ranked[0]);}else{renderBest(null);}
    setStatus('Recomendaciones actualizadas');
  }catch(error){setStatus(`Error: ${error.message}`,'error');$('recommended-status').textContent='Error';$('recommended-ranking').innerHTML=`<div class="empty">${error.message}</div>`;}
}

$('recommended-date').value=state.date;$('recommended-mode').value=state.mode;$('recommended-moment').value=state.moment;
$('recommended-moment').addEventListener('change',()=>{
  state.moment=$('recommended-moment').value;
  const visible=state.moment==='custom';
  $('session-start').disabled=!visible;
  $('session-end').disabled=!visible;
});
$('recommended-run').addEventListener('click',run);
$('recommended-date').addEventListener('change',()=>{ state.date=$('recommended-date').value || state.date; updateLinks(); });
$('recommended-mode').addEventListener('change',()=>{ state.mode=$('recommended-mode').value; updateLinks(); });
['session-start','session-end'].forEach(id=>$(id).addEventListener('change',()=>{ updateLinks(); }));
$('session-start').disabled=true;$('session-end').disabled=true;
initMap(({latitude,longitude})=>{setLocation(latitude,longitude,{label:'Coordenadas seleccionadas'});}, 'recommended-map');
fitMurcia();
setStatus('Selecciona los parámetros y pulsa «Buscar oportunidades».');
