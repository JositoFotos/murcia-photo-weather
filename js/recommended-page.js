import { CONFIG } from './config.js';
import { PHOTO_LOCATIONS } from '../data/photo-locations.js';
import { getHourlyForecast, processAemetData } from './aemet.js';
import { getMunicipalityById } from './locations.js';
import { getOpenWeatherForecast } from './openweather.js';
import { exploreMurcia } from './opportunities.js';
import { initMap, renderOpportunities, setLocation, fitMurcia } from './map.js';
import { loadWeatherCache, saveWeatherCache } from './storage.js';
import { getNavigationContextFromUrl, getSavedNavigationContext, saveNavigationContext } from './navigation-context.js';

const $=id=>document.getElementById(id);
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function describeSearchError(error){if(error?.status===429)return 'AEMET ha limitado temporalmente las peticiones (HTTP 429). Espera un momento y reintenta; la aplicación utiliza caché cuando hay datos previos.';if(error?.status===401||error?.status===403)return 'El servicio de AEMET ha rechazado la credencial configurada en Netlify.';if(error?.status>=500)return `El servicio meteorológico no responde (HTTP ${error.status}). Prueba más tarde.`;return error?.message||'No se pudieron obtener los datos. Comprueba la conexión y vuelve a intentarlo.';}
const params=new URLSearchParams(location.search);
const urlContext=getNavigationContextFromUrl();
const savedContext=getSavedNavigationContext();
const initialContext=urlContext||savedContext;
const localDateISO=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const validModes=['landscape','sunriseSunset','coast','nature','architecture','nocturnal'];
const state={date:params.get('date')||urlContext?.date||savedContext?.date||localDateISO(),mode:validModes.includes(params.get('mode'))?params.get('mode'):(urlContext?.mode||savedContext?.mode||'landscape'),moment:params.get('moment')||urlContext?.moment||savedContext?.moment||'all',results:[],selected:null,contextLocation:initialContext?{latitude:initialContext.latitude,longitude:initialContext.longitude,name:initialContext.name}:null};

function setStatus(message,kind='ready'){const el=$('recommended-app-status');el.dataset.state=kind;el.textContent=message;}
function timeToHour(value){if(!value)return null;const [h,m]=value.split(':').map(Number);return Number.isFinite(h)?h+(m||0)/60:null;}
function updateLinks(){
  const selectedLocation=state.selected?.location;
  const contextLocation=selectedLocation ? {latitude:selectedLocation.latitude,longitude:selectedLocation.longitude,name:selectedLocation.name} : state.contextLocation;
  const linkParams={date:state.date,mode:state.mode,moment:state.moment};
  if(contextLocation){
    linkParams.lat=String(contextLocation.latitude);
    linkParams.lon=String(contextLocation.longitude);
    linkParams.name=contextLocation.name || 'Ubicación seleccionada';
    saveNavigationContext({ ...contextLocation, date:state.date, mode:state.mode, moment:state.moment });
  }
  const q=new URLSearchParams(linkParams);
  $('photo-link').href=`index.html?${q}`;
  $('astronomy-link').href=`astronomia.html?${q}`;
}

const opportunityWeatherSessionCache = new Map();
const opportunityOpenWeatherSessionCache = new Map();
const RECOMMENDED_CACHE_PREFIX='mpwp_recommended_hourly_v1_';
const RECOMMENDED_CACHE_TTL=6*60*60*1000;
function readRecommendedCache(id){try{const item=JSON.parse(localStorage.getItem(`${RECOMMENDED_CACHE_PREFIX}${id}`)||'null');return item&&Date.now()-item.timestamp<RECOMMENDED_CACHE_TTL?item.data:null;}catch{return null;}}
function saveRecommendedCache(id,data){try{localStorage.setItem(`${RECOMMENDED_CACHE_PREFIX}${id}`,JSON.stringify({timestamp:Date.now(),data}));}catch{ /* La caché local es opcional. */ }}
async function weatherLoader(m){
  const cachedSession = opportunityWeatherSessionCache.get(m.id);
  if (cachedSession) return cachedSession;
  const cached = loadWeatherCache(m.id, CONFIG.CACHE_DURATION);
  if (cached?.hourly?.length) { opportunityWeatherSessionCache.set(m.id, cached); return cached; }
  const recommendedCached=readRecommendedCache(m.id);
  if(recommendedCached?.hourly?.length){opportunityWeatherSessionCache.set(m.id,recommendedCached);return recommendedCached;}
  try {
    const rawHourly = await getHourlyForecast(m.id);
    const normalized = processAemetData({ daily:null, hourly:rawHourly }, m);
    opportunityWeatherSessionCache.set(m.id, normalized);
    saveRecommendedCache(m.id, normalized);
    return normalized;
  } catch(error) {
    const stale=loadWeatherCache(m.id, Number.POSITIVE_INFINITY);
    if(stale?.hourly?.length && (!error?.status || error.status===429 || error.status>=500)) {
      opportunityWeatherSessionCache.set(m.id, stale);
      return stale;
    }
    throw error;
  }
}

async function openWeatherLoader(location){
  const cacheKey = `${Number(location.latitude).toFixed(4)}_${Number(location.longitude).toFixed(4)}`;
  const cached = opportunityOpenWeatherSessionCache.get(cacheKey);
  if (cached) return cached;
  const forecast = await getOpenWeatherForecast(location.latitude,location.longitude,{force:false});
  opportunityOpenWeatherSessionCache.set(cacheKey, forecast);
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
  state.contextLocation={latitude:item.location.latitude,longitude:item.location.longitude,name:item.location.name};
  saveNavigationContext({...state.contextLocation,date:state.date,mode:state.mode,moment:state.moment});
  setLocation(item.location.latitude,item.location.longitude,{label:item.location.name});
  renderBest(item);
  const q=new URLSearchParams({lat:item.location.latitude,lon:item.location.longitude,date:state.date,name:item.location.name,mode:state.mode,moment:state.moment});
  history.replaceState(null,'',`recomendados.html?${q}`);
  updateLinks();
}

async function run(){
  state.date=$('recommended-date').value||state.date;state.mode=$('recommended-mode').value;state.moment=$('recommended-moment').value;
  const {startHour,endHour}=parseMomentRange();
  $('recommended-status').textContent='Analizando…';$('recommended-ranking').setAttribute('aria-busy','true');$('recommended-ranking').innerHTML='<div class="ranking-skeletons" role="status" aria-live="polite"><span class="sr-only">Consultando AEMET y OpenWeather…</span>'+Array.from({length:5},()=>'<div class="skeleton ranking-skeleton"></div>').join('')+'</div>';
  setStatus('Analizando localizaciones…','loading');updateLinks();
  try{
    const ranked=await exploreMurcia({weatherLoader,openWeatherLoader,mode:state.mode,date:state.date,filterMoment:state.moment,startHour,endHour,onProgress:progress=>{const phase=progress.phase==='aemet'?'AEMET':'OpenWeather';$('recommended-status').textContent=`${phase} · ${progress.completed}/${progress.total} · ${progress.location}`;setStatus(`Consultando ${phase}: ${progress.completed} de ${progress.total} · ${progress.location}`,'loading');}});
    state.results=ranked;$('recommended-ranking').setAttribute('aria-busy','false');renderRanking();
    $('recommended-status').textContent=`${ranked.length} localizaciones`;
    renderOpportunities(ranked,item=>selectItem(item));
    if(ranked[0]){selectItem(ranked[0]);}else{renderBest(null);}
    if(!ranked.length){
      setStatus('No hay localizaciones con datos suficientes para la fecha o franja elegida. Prueba otra fecha o amplía el horario.','warning');
    } else if(ranked.errors?.length){
      const failedAemet=ranked.errors.filter(x=>x.service==='AEMET').length;
      const failedOW=ranked.errors.filter(x=>x.service==='OpenWeather').length;
      setStatus(`Resultados parciales: ${ranked.length} localizaciones · ${failedAemet} incidencias AEMET · ${failedOW} incidencias OpenWeather`,'warning');
      const note=document.createElement('p'); note.className='recommended-data-note'; note.setAttribute('role','status'); note.textContent='Algunas localizaciones no pudieron consultar todas las fuentes; sus índices pueden usar solo los datos disponibles.'; const containerNote=$('recommended-ranking'); containerNote.prepend(note);
    } else setStatus('Recomendaciones actualizadas');
  }catch(error){const message=describeSearchError(error);setStatus(`Error: ${message}`,'error');$('recommended-status').textContent='Error';$('recommended-ranking').setAttribute('aria-busy','false');$('recommended-ranking').innerHTML=`<div class="api-error" role="alert"><p>${escapeHtml(message)}</p><button type="button" class="primary" id="recommended-retry">Reintentar búsqueda</button></div>`;$('recommended-retry')?.addEventListener('click',run);}
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
try {
  initMap(({latitude,longitude})=>{
    state.selected=null;
    state.contextLocation={latitude,longitude,name:'Coordenadas seleccionadas'};
    setLocation(latitude,longitude,{label:state.contextLocation.name});
    updateLinks();
  }, 'recommended-map');
  if(state.contextLocation){
    setLocation(state.contextLocation.latitude,state.contextLocation.longitude,{label:state.contextLocation.name});
  } else { fitMurcia(); }
  $('recommended-map')?.setAttribute('aria-busy','false');
} catch(error) {
  const mapHost=$('recommended-map');
  if(mapHost){mapHost.setAttribute('aria-busy','false'); mapHost.innerHTML=`<div class="component-error" role="alert">No se pudo iniciar el mapa. Comprueba la conexión a Leaflet; el ranking puede seguir consultándose. ${escapeHtml(error.message)}</div>`;}
  setStatus('El mapa no está disponible; puedes seguir usando el ranking.','warning');
}
updateLinks();
if($('recommended-ranking')?.getAttribute('aria-busy')!=='true') setStatus('Selecciona los parámetros y pulsa «Buscar oportunidades».');
