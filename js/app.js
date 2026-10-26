import { CONFIG } from './config.js';
import { MUNICIPALITIES } from '../data/municipalities.js';
import { PHOTO_LOCATIONS } from '../data/photo-locations.js';
import { getWeatherData, processAemetData } from './aemet.js';
import { findDay, getHourlyForDate, summarizeWeather, summarizeSkyConditions, sortForecastDates, conditionLabel } from './weather.js';
import { calculateSunTimes, formatTime, formatRange, getMoonData, calculateMilkyWay, calculateAstronomicalEvents } from './astronomy.js';
import { calculatePhotographyScore, calculateSpecificIndices, calculateBestPhotographyWindows, calculateBestPhotographyMoment, buildPhotographyScoreData } from './photography.js';
import { initMap, setLocation, renderPhotoLocations, renderOpportunities as renderOpportunityMarkers, fitMurcia } from './map.js';
import { searchLocation, nearestMunicipality, getMunicipalityById } from './locations.js';
import { loadWeatherCache, saveWeatherCache, saveHistory, loadHistory, deleteHistory, clearHistory, loadFavorites, saveFavorite, deleteFavorite } from './storage.js';
import { exportCSV, exportJSON, copySummary, generateShareUrl } from './export.js';
import { exploreMurcia, rankLocations } from './opportunities.js';
import { getOpenWeatherForecast, getOpenWeatherForDate, summarizeOpenWeather } from './openweather.js';
import { getNavigationContextFromUrl, getSavedNavigationContext, saveNavigationContext } from './navigation-context.js';
import { getCandilazoForecast } from './candilazo.js';

const state = { location:{...MUNICIPALITIES.find(x=>x.id==='30030')}, municipality:null, weather:null, openWeather:null, openWeatherSummary:null, openWeatherLoading:true, openWeatherError:null, astronomyError:null, chartError:null, date:localDateISO(), mode:'landscape', astronomy:null, currentScore:null, searchSelection:null, bestMoment:null, selectedOpportunityScore:null, candilazoRequestId:0 };
const $ = id => document.getElementById(id);
let weatherRequestId=0;
let openWeatherRequestId=0;

function setStatus(kind,message) { const el=$('app-status'); if(!el) return; el.dataset.state=kind; el.textContent=message; el.setAttribute('aria-live', 'polite'); }
function setLoadingState(isLoading){ document.body.classList.toggle('is-loading', isLoading); document.body.classList.remove('app-starting'); document.querySelector('.score-card')?.setAttribute('aria-busy', String(isLoading)); document.querySelector('.location-card')?.setAttribute('aria-busy', String(isLoading)); }
function escapeHtml(value){ return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function friendlyOpenWeatherError(error){
  if(/OPENWEATHER_API|secreto.*OpenWeather|secreto.*OPENWEATHER/i.test(error?.message||'')) return 'El secreto OPENWEATHER_API no está configurado correctamente en Netlify.';
  if(error?.status===429) return 'OpenWeather ha limitado temporalmente las peticiones (HTTP 429). Espera un momento y pulsa Reintentar.';
  if(error?.status===401 || error?.status===403) return 'OpenWeather ha rechazado la credencial. Revisa el secreto OPENWEATHER_API en Netlify.';
  if(error?.status>=500) return `OpenWeather no responde correctamente (HTTP ${error.status}). Prueba de nuevo más tarde.`;
  return error?.message || 'No se han podido obtener los datos complementarios de OpenWeather.';
}
function friendlyAemetError(error){
  if(/AEMET_API_KEY|secreto.*AEMET/i.test(error?.message||'')) return 'El secreto AEMET_API_KEY no está configurado correctamente en Netlify.';
  if(error?.code==='API_KEY_MISSING') return 'El servicio AEMET no tiene configurada la credencial en Netlify. Revisa la variable secreta AEMET_API_KEY.';
  if(error?.code==='API_KEY_FORMAT') return 'La clave de AEMET no tiene un formato válido. Revisa la configuración del servicio.';
  if(error?.status===429) return 'AEMET ha limitado temporalmente las peticiones (HTTP 429). Espera un poco y vuelve a intentarlo; el resto de la interfaz seguirá disponible.';
  if(error?.status===401 || error?.status===403) return 'AEMET ha rechazado la credencial de acceso. Comprueba la variable secreta AEMET_API_KEY en Netlify.';
  if(error?.status>=500) return `El servicio de AEMET no está respondiendo correctamente (HTTP ${error.status}). Prueba de nuevo más tarde.`;
  return error?.message || 'No se han podido obtener los datos meteorológicos de AEMET en este momento.';
}
function showAemetError(error){
  const help=$('aemet-help'); if(!help) return;
  help.hidden=false; help.replaceChildren();
  const message=document.createElement('p'); message.textContent=friendlyAemetError(error);
  const retry=document.createElement('button'); retry.type='button'; retry.className='primary'; retry.textContent='Reintentar AEMET'; retry.addEventListener('click',()=>refreshWeather(true));
  help.append(message,retry);
}
function fmt(v,suffix=''){ return Number.isFinite(Number(v)) ? `${Math.round(Number(v)*10)/10}${suffix}` : 'N/D'; }
function localDateISO(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function dateLabel(d){ return new Intl.DateTimeFormat('es-ES',{weekday:'short',day:'2-digit',month:'2-digit'}).format(new Date(`${d}T12:00:00`)); }
async function copyText(text){ if(navigator.clipboard?.writeText){ await navigator.clipboard.writeText(text); return; } const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }

function bindUI(){
  document.querySelectorAll('[data-mode]').forEach(btn=>{btn.setAttribute('aria-pressed',String(btn.classList.contains('active')));btn.addEventListener('click',()=>{ state.mode=btn.dataset.mode; state.selectedOpportunityScore=null; document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b===btn);b.setAttribute('aria-pressed',String(b===btn));}); refreshDashboard(); });});
  $('search-input').addEventListener('input', e=>renderSuggestions(searchLocation(e.target.value)));
  $('search-input').addEventListener('keydown', e=>{ if(e.key==='Enter'){ const first=document.querySelector('.suggestion'); if(first) first.click(); } else if(e.key==='ArrowDown'){const first=document.querySelector('.suggestion'); if(first){e.preventDefault();first.focus();}} else if(e.key==='Escape'){$('suggestions').innerHTML='';$('search-input').setAttribute('aria-expanded','false');} });
  $('use-location').addEventListener('click', getUserLocation);
  $('refresh').addEventListener('click', ()=>refreshWeather(true));
  $('date-picker').addEventListener('change', async e=>{ if(e.target.value){ state.date=e.target.value; state.selectedOpportunityScore=null; state.openWeatherSummary=null; state.openWeatherLoading=true; state.openWeatherError=null; renderDateTabs(state.weather?sortForecastDates(state.weather):[state.date]); refreshSolarDisplay(); if(state.weather){ refreshDashboard(); await refreshOpenWeather(false); } else { refreshSolarDisplay(); } } });
  if ($('explore')) $('explore').addEventListener('click', doExplore);
  $('share').addEventListener('click', async()=>{ try { const url=generateShareUrl(state.location,state.date); await copyText(url); toast('URL compartible copiada'); } catch { toast('No se pudo copiar la URL; puedes usarla desde el navegador.'); } });
  $('copy-summary').addEventListener('click', async()=>{ try { await copySummary(snapshot(), copyText); toast('Resumen copiado'); } catch { toast('No se pudo copiar el resumen.'); } });
  $('export-json').addEventListener('click',()=>exportJSON(snapshot()));
  $('export-csv').addEventListener('click',()=>exportCSV(snapshot()));
  $('add-favorite').addEventListener('click',()=>openFavoriteDialog());
  $('clear-history').addEventListener('click',()=>{ clearHistory(); renderHistory(); });
  $('history-list').addEventListener('click', e=>{ const i=e.target.dataset.historyIndex; if(i!==undefined){ const h=loadHistory()[Number(i)]; if(h?.municipalityId){ selectMunicipality(getMunicipalityById(h.municipalityId)); } } });
  $('favorite-list').addEventListener('click', e=>{ const id=e.target.dataset.favoriteId; if(id){ const f=loadFavorites().find(x=>x.id===id); if(f) selectCoordinate(f.latitude,f.longitude,f.name); }});
  window.addEventListener('mpwp:map-location', e=>selectCoordinate(e.detail.latitude,e.detail.longitude,'Coordenadas seleccionadas'));
  // Refresh the share-context immediately before navigation so date/mode/location
  // selected on Photography are transferred even if a weather request is still pending.
  ['astronomy-link','open-astronomy','recommended-link','open-recommended'].forEach(id=>{
    $(id)?.addEventListener('click',()=>updateAstronomyLink());
  });
}

function renderSuggestions(items){ const el=$('suggestions'); const input=$('search-input'); el.innerHTML=''; const results=Array.isArray(items)?items:[]; input.setAttribute('aria-expanded',String(results.length>0)); results.forEach((item,index)=>{ const b=document.createElement('button'); b.type='button'; b.className='suggestion'; b.id=`location-option-${index}`; b.setAttribute('role','option'); b.setAttribute('aria-selected','false'); b.textContent=item.label; b.addEventListener('click',()=>{ el.innerHTML=''; input.setAttribute('aria-expanded','false'); input.value=item.label; if(item.kind==='coordinates') selectCoordinate(item.latitude,item.longitude,item.label); else selectMunicipality(item.kind==='photo'?getMunicipalityById(item.municipalityId):item); }); el.appendChild(b); }); }

async function selectMunicipality(m){ if(!m) return; state.municipality=m; state.location={...m}; saveNavigationContext({latitude:m.latitude,longitude:m.longitude,name:m.name,date:state.date,mode:state.mode}); setLocation(m.latitude,m.longitude,{label:m.name}); refreshSolarDisplay(); await refreshWeather(); }
async function selectCoordinate(lat,lon,label='Coordenadas',load=true){ state.selectedOpportunityScore=null; const m=nearestMunicipality(lat,lon); state.location={ id:`coord-${lat}-${lon}`, name:label, latitude:lat, longitude:lon, municipalityId:m?.id ?? null }; state.municipality=m; saveNavigationContext({latitude:lat,longitude:lon,name:label,date:state.date,mode:state.mode}); setLocation(lat,lon,{label}); refreshSolarDisplay(); if(load) await refreshWeather(); }

async function refreshWeather(force=false){
  const requestId=++weatherRequestId;
  setLoadingState(true);
  const help=$('aemet-help'); if(help) help.hidden=true;
  state.openWeather=null; state.openWeatherSummary=null; state.openWeatherLoading=true; state.openWeatherError=null;
  renderOpenWeather();
  let normalized;
  try {
    if(!state.municipality) throw new Error('No se ha podido determinar un municipio de referencia para AEMET.');
    setStatus('loading','Cargando predicción de AEMET…');
    normalized=force?null:loadWeatherCache(state.municipality.id,CONFIG.CACHE_DURATION);
    if(!normalized){ const raw=await getWeatherData(state.municipality.id); normalized=processAemetData(raw,state.municipality); saveWeatherCache(state.municipality.id,normalized); }
    if(requestId!==weatherRequestId) return;
    state.weather=normalized;
    const dates=sortForecastDates(normalized); if(!dates.includes(state.date)) state.date=dates[0] ?? state.date;
    renderDateTabs(dates); refreshDashboard(); updateAstronomyLink();
  } catch(error){
    if(requestId!==weatherRequestId) return;
    const stale=state.municipality ? loadWeatherCache(state.municipality.id, Number.POSITIVE_INFINITY) : null;
    const canUseStale=Boolean(stale?.hourly?.length) && (error?.status===429 || error?.status>=500 || error?.code==='NETWORK' || error?.code==='TIMEOUT');
    if(canUseStale){
      state.weather=stale;
      const dates=sortForecastDates(stale); if(!dates.includes(state.date)) state.date=dates[0] ?? state.date;
      renderDateTabs(dates); refreshDashboard(); showAemetError(error);
      const cachedNotice=document.createElement('p'); const cachedAt=stale.updatedAt && !Number.isNaN(new Date(stale.updatedAt).getTime()) ? new Date(stale.updatedAt).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'}) : 'fecha no registrada'; cachedNotice.textContent=`Se muestran los últimos datos guardados (${cachedAt}) porque AEMET no ha respondido.`;
      $('aemet-help')?.prepend(cachedNotice);
      setStatus('warning',`AEMET no disponible; mostrando datos guardados. ${friendlyAemetError(error)}`);
      state.openWeatherLoading=true; state.openWeatherError=null; state.openWeatherSummary=null;
      setLoadingState(false);
      await refreshOpenWeather(false, requestId);
      return;
    }
    state.weather=null; state.openWeatherLoading=false; state.openWeatherError='AEMET aún no se ha cargado; vuelve a intentarlo cuando se restablezca el servicio.';
    renderEmpty(friendlyAemetError(error)); renderDateTabs([state.date]); showAemetError(error); setStatus('error',friendlyAemetError(error));
    renderOpenWeather();
    return;
  } finally {
    if(requestId===weatherRequestId) setLoadingState(false);
  }
  if(requestId!==weatherRequestId) return;
  setStatus('loading','AEMET cargado · consultando datos complementarios de OpenWeather…');
  await refreshOpenWeather(force, requestId);
  if(requestId!==weatherRequestId) return;
  saveHistory({ municipalityId:state.municipality.id, location:state.location, date:state.date, mode:state.mode, score:state.currentScore?.score ?? null });
  const warnings=[];
  if(state.openWeatherError) warnings.push(`OpenWeather: ${state.openWeatherError}`);
  if(state.astronomyError) warnings.push(`Astronomía: ${state.astronomyError}`);
  if(state.chartError) warnings.push(`Meteograma: ${state.chartError}`);
  if(warnings.length) setStatus('warning',`AEMET actualizado con incidencias · ${warnings.join(' · ')}`);
  else setStatus('ready',`Datos cargados · ${new Date(normalized.updatedAt).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}`);
}

function renderDateTabs(dates){ const valid=(dates||[]).filter(Boolean); const picker=$('date-picker'); picker.value=state.date; picker.disabled=false; picker.min=valid[0]??''; picker.max=valid.at(-1)??''; $('date-tabs').innerHTML=''; valid.forEach((d,i)=>{ const b=document.createElement('button'); b.className='date-tab'; b.classList.toggle('active',d===state.date); b.setAttribute('aria-pressed',String(d===state.date)); b.textContent=valid.length===1 && d!==localDateISO()?dateLabel(d):(i===0?'Hoy':i===1?'Mañana':`+${i}`); b.title=d; b.addEventListener('click',async()=>{ state.date=d; state.selectedOpportunityScore=null; state.openWeatherSummary=null; state.openWeatherLoading=true; state.openWeatherError=null; picker.value=d; renderDateTabs(valid); picker.blur(); refreshSolarDisplay(); refreshDashboard(); await refreshOpenWeather(false); }); $('date-tabs').appendChild(b); }); if(!valid.length){ const b=document.createElement('span'); b.className='date-empty'; b.textContent='Sin fechas de AEMET'; $('date-tabs').appendChild(b); } }

function aggregateForScore(){
  const hourly=getHourlyForDate(state.weather,state.date);
  const openWeatherPoints=state.openWeather ? getOpenWeatherForDate(state.openWeather,state.date) : [];
  return buildPhotographyScoreData(hourly, openWeatherPoints);
}

function renderSunTimeline(){
  const el = $('sun-timeline');
  const t = state.astronomy;
  if(!el || !t) return;
  const valid = value => value instanceof Date && !Number.isNaN(value.getTime());
  const start = new Date(`${state.date}T00:00:00`);
  const end = new Date(start.getTime() + 24*60*60*1000);
  const pct = d => Math.max(0, Math.min(100, ((d.getTime()-start.getTime())/(end.getTime()-start.getTime()))*100));
  const segment = (cls, a, b) => valid(a) && valid(b) && b > a ? `<div class="sun-segment ${cls}" style="left:${pct(a)}%;width:${pct(b)-pct(a)}%"></div>` : '';
  const marker = (cls,label,d) => valid(d) ? `<div class="sun-marker ${cls}" style="left:${pct(d)}%"><span>${label} ${formatTime(d, CONFIG.DEFAULT_TIME_ZONE)}</span></div>` : '';
  const goldenMorning = t.goldenMorning || [];
  const goldenEvening = t.goldenEvening || [];
  const blueMorning = t.blueMorning || [];
  const blueEvening = t.blueEvening || [];
  el.setAttribute('aria-busy','false');
  el.innerHTML = `
    <div class="sun-timeline-track">
      <div class="sun-segment night" style="left:0%;width:100%"></div>
      ${segment('day', t.sunrise, t.sunset)}
      ${segment('blue', blueMorning[0], blueMorning[1])}
      ${segment('blue', blueEvening[0], blueEvening[1])}
      ${segment('golden', goldenMorning[0], goldenMorning[1])}
      ${segment('golden', goldenEvening[0], goldenEvening[1])}
      ${marker('', 'Amanecer', t.sunrise)}
      ${marker('', 'Atardecer', t.sunset)}
    </div>
    <div class="sun-timeline-axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
    <div class="sun-timeline-legend">
      <span><i class="legend-swatch night"></i>Noche</span>
      <span><i class="legend-swatch day"></i>Día</span>
      <span><i class="legend-swatch golden"></i>Hora dorada</span>
      <span><i class="legend-swatch blue"></i>Hora azul</span>
    </div>`;
}

async function refreshCandilazo(){
  const host=$('candilazo-info'); if(!host) return;
  const requestId=++state.candilazoRequestId;
  host.setAttribute('aria-busy','true');
  host.innerHTML='<div class="candilazo-loading" role="status">Calculando potencial de arrebol con Open-Meteo…</div>';
  try {
    if(!state.astronomy?.sunset) throw new Error('No se ha podido calcular el ocaso para esta ubicación y fecha.');
    const result=await getCandilazoForecast({latitude:state.location.latitude,longitude:state.location.longitude,date:state.date,sunset:state.astronomy.sunset});
    if(requestId!==state.candilazoRequestId) return;
    if(result.status!=='ok') { host.innerHTML=`<div class="candilazo-empty" role="status">${escapeHtml(result.message)}</div>`; return; }
    const pct=v=>Number.isFinite(v)?`${Math.round(v)} %`:'N/D';
    const time=d=>formatTime(d,CONFIG.DEFAULT_TIME_ZONE);
    const factorList=items=>items.map(x=>`<li>${escapeHtml(x)}</li>`).join('');
    host.innerHTML=`<div class="candilazo-score-row"><div><span class="candilazo-kicker">Potencial estimado</span><strong class="candilazo-score">${result.score}<small>/100</small></strong></div><div class="candilazo-confidence"><span>Confianza de datos</span><strong>${result.confidence}/100</strong><small>${result.sampleCount} muestras horarias</small></div></div><div class="candilazo-window"><span>🌇 Franja orientativa</span><strong>${time(result.windowStart)}–${time(result.windowEnd)}</strong><small>Ocaso ${time(result.sunset)} · el modelo horario no resuelve cambios minuto a minuto.</small></div><div class="candilazo-factors"><div><h3>Factores favorables</h3><ul>${factorList(result.favorable)}</ul></div><div><h3>Factores desfavorables / cautelas</h3><ul>${factorList(result.unfavorable)}</ul></div></div><div class="candilazo-data-grid"><span>Nubes altas <b>${pct(result.factors.high)}</b></span><span>Nubes medias <b>${pct(result.factors.mid)}</b></span><span>Nubes bajas <b>${pct(result.factors.low)}</b></span><span>Visibilidad <b>${Number.isFinite(result.factors.visibility)?`${(result.factors.visibility/1000).toFixed(1)} km`:'N/D'}</b></span><span>Prob. precipitación <b>${pct(result.factors.precip)}</b></span></div><p class="candilazo-disclaimer">Heurística experimental, no probabilidad validada ni garantía de candilazo. La orientación del horizonte, la transparencia real y la evolución de las nubes pueden cambiar el resultado. Datos: <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>; cálculo derivado y modificado).</p>`;
  } catch(error) {
    if(requestId!==state.candilazoRequestId) return;
    host.innerHTML=`<div class="candilazo-empty" role="alert"><strong>No se pudo calcular la predicción.</strong><p>${escapeHtml(error?.message||'Error desconocido')}</p><button type="button" class="secondary" id="retry-candilazo">Reintentar</button></div>`;
    $('retry-candilazo')?.addEventListener('click',refreshCandilazo);
  } finally { if(requestId===state.candilazoRequestId) host.setAttribute('aria-busy','false'); }
}

function refreshSolarDisplay(){
  const date=state.date;
  const location=state.location;
  try {
    state.astronomyError=null;
    state.astronomy=calculateSunTimes(date,location.latitude,location.longitude);
    state.moon=getMoonData(date,location.latitude,location.longitude,CONFIG.DEFAULT_TIME_ZONE);
    state.milkyWay=calculateMilkyWay(date,location.latitude,location.longitude,state.astronomy,state.moon);
    state.astroEvents=calculateAstronomicalEvents(date,location.latitude,location.longitude,CONFIG.DEFAULT_TIME_ZONE);
    renderSunTimeline();
    $('sunrise').textContent=formatTime(state.astronomy.sunrise);
    $('sunset').textContent=formatTime(state.astronomy.sunset);
    $('day-length').textContent=state.astronomy.dayLengthMs ? `${Math.floor(state.astronomy.dayLengthMs/3600000)}h ${Math.round((state.astronomy.dayLengthMs%3600000)/60000)}m` : 'N/D';
    renderAstronomyPanels();
    refreshCandilazo();
    return true;
  } catch(error) {
    state.astronomyError=error?.message||'Biblioteca astronómica no disponible';
    state.astronomy=null; state.moon=null; state.milkyWay=null; state.astroEvents=[];
    $('sun-timeline').setAttribute('aria-busy','false');
    $('sun-timeline').innerHTML=`<div class="component-error" role="alert"><strong>No se pudieron calcular los datos solares.</strong><p>${escapeHtml(error.message)} Comprueba la conexión a la librería astronómica. Recargar la página volverá a intentar cargarla.</p><button type="button" class="secondary" id="retry-astronomy-local">Recargar cálculos</button></div>`;
    ['sunrise','sunset','day-length'].forEach(id=>$(id).textContent='N/D');
    ['moon-info','milky-way-info','astro-events'].forEach(id=>{ if($(id)) $(id).innerHTML=`<div class="component-error" role="status">Datos astronómicos no disponibles: ${escapeHtml(error.message)}</div>`; });
    $('retry-astronomy-local')?.addEventListener('click',()=>location.reload());
    refreshCandilazo();
    return false;
  }
}

function refreshDashboard(){
  if(!state.weather){ renderEmpty('Sin datos meteorológicos disponibles. Comprueba el mensaje de estado y pulsa Actualizar para reintentar.'); return; }
  const date=state.date; const location=state.location; const summary=summarizeWeather(state.weather,date);
  const scoreOverride = state.selectedOpportunityScore && state.selectedOpportunityScore.locationId === location.id && state.selectedOpportunityScore.date === date && state.selectedOpportunityScore.mode === state.mode ? state.selectedOpportunityScore.scoreData : null;
  const normalizedMode = state.mode==='sunriseSunset'?'sunriseSunset':state.mode;
  const aggregated = aggregateForScore();
  const score = scoreOverride ?? calculatePhotographyScore(aggregated, normalizedMode);
  state.currentScore=score; const indices=calculateSpecificIndices(aggregated);
  $('location-name').textContent=location.name; $('coordinates').textContent=`${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`; $('municipality').textContent=state.municipality?.name ?? '—'; $('score').textContent=`${score.score}/100`; $('score-label').textContent=score.category.toUpperCase();
  $('temperature').textContent=`${fmt(summary.temperature.current ?? summary.temperature.max,' °C')}`; $('temp-range').textContent=`${fmt(summary.temperature.min,' °C')} – ${fmt(summary.temperature.max,' °C')}`; $('rain-prob').textContent=fmt(summary.rainProbability,' %'); $('wind').textContent=fmt(summary.wind.mean,' km/h'); $('storm').textContent=conditionLabel(summary.stormProbability); $('humidity').textContent=fmt(summary.humidity.mean,' %');
  $('indice-grid').innerHTML=[['🌅 Amanecer',indices.sunrise],['☀️ Día',indices.day],['🌇 Atardecer',indices.sunset],['🌌 Noche',indices.night]].map(([l,v])=>`<div class="index-mini"><span>${l}</span><strong>${v}/100</strong></div>`).join('');

  // Recalcula el sol localmente, de forma independiente del resultado AEMET.
  refreshSolarDisplay();
  try { state.bestMoment = calculateBestPhotographyMoment({ hourly: aggregated.hourly, openWeatherPoints: aggregated.openWeatherPoints, astronomy: state.astronomy, mode: normalizedMode }); }
  catch { state.bestMoment=null; }
  renderOpenWeather(); renderBestMoment();
  $('positives').innerHTML=score.positives.map(x=>`<li>✓ ${x}</li>`).join('') || '<li>Sin factores positivos identificados.</li>';
  $('negatives').innerHTML=score.negatives.map(x=>`<li>⚠ ${x}</li>`).join('') || '<li>Sin factores negativos identificados.</li>';
  $('recommendation').textContent=score.score>=81?'Excelente oportunidad fotográfica.':score.score>=61?'Buenas condiciones: la ventana merece consideración.':score.score>=41?'Condiciones aceptables, con factores a vigilar.':'Condiciones poco favorables para este modo.';
  $('source-note').textContent=`Datos meteorológicos: AEMET. Índices fotográficos: cálculo propio. Fecha ${dateLabel(date)}.`;
  try { state.chartError=null; renderMeteogram(); }
  catch(error) { state.chartError=error?.message||'Chart.js no disponible'; const loading=$('chart-loading'); if(loading){ loading.hidden=false; loading.innerHTML=`<div class="component-error" role="alert">No se pudo construir el meteograma: ${escapeHtml(error.message)}<p>Comprueba la conexión y recarga la página para volver a cargar Chart.js.</p><button type="button" class="secondary" id="retry-chart-library">Recargar meteograma</button></div>`; } $('retry-chart-library')?.addEventListener('click',()=>location.reload()); $('chart-loading')?.parentElement?.setAttribute('aria-busy','false'); }
  renderHistory(); renderFavorites(); renderPhotoLocations(PHOTO_LOCATIONS); updateAstronomyLink();
}

function renderAstronomyPanels(){
  const moonEl=$('moon-info');
  const mwEl=$('milky-way-info');
  const eventsEl=$('astro-events');
  if(moonEl && state.moon){
    const m=state.moon;
    const visibility = m.rise && m.set ? `Visible aprox. ${formatTime(m.rise,CONFIG.DEFAULT_TIME_ZONE)}–${formatTime(m.set,CONFIG.DEFAULT_TIME_ZONE)}` : m.alwaysUp ? 'Por encima del horizonte toda la jornada' : m.alwaysDown ? 'Por debajo del horizonte toda la jornada' : 'Horario no disponible';
    moonEl.innerHTML=`
      <div class="astro-main"><span class="astro-icon moon">${m.icon}</span><div><span class="astro-kicker">Fase lunar</span><strong>${m.name}</strong><span class="astro-muted">${m.illuminationPercent}% iluminada · ${m.waxing?'creciente':'menguante'}</span></div></div>
      <div class="astro-stats">
        <div><span>Salida</span><strong>${m.rise?formatTime(m.rise,CONFIG.DEFAULT_TIME_ZONE):'N/D'}</strong></div>
        <div><span>Puesta</span><strong>${m.set?formatTime(m.set,CONFIG.DEFAULT_TIME_ZONE):'N/D'}</strong></div>
        <div><span>Distancia</span><strong>${Number.isFinite(m.distance)?`${Math.round(m.distance).toLocaleString('es-ES')} km`:'N/D'}</strong></div>
        <div><span>Altura · 12h</span><strong>${Number.isFinite(m.altitude)?`${Math.round(m.altitude*180/Math.PI)}°`:'N/D'}</strong></div>
      </div>
      <p class="astro-note">${visibility}. La posición y fase se calculan con SunCalc.</p>`;
  }
  if(mwEl && state.milkyWay){
    const m=state.milkyWay;
    mwEl.innerHTML=`
      <div class="astro-main"><span class="astro-icon">🌌</span><div><span class="astro-kicker">Centro galáctico</span><strong>${m.visible?'Ventana nocturna favorable':'No favorable en esta fecha'}</strong><span class="astro-muted">Índice de Vía Láctea: ${m.score}/100</span></div></div>
      <div class="astro-stats">
        <div><span>Máxima altura</span><strong>${Number.isFinite(m.bestAltitude)?`${Math.round(m.bestAltitude)}°`:'N/D'}</strong></div>
        <div><span>Mejor momento</span><strong>${m.bestTime?formatTime(m.bestTime,CONFIG.DEFAULT_TIME_ZONE):'N/D'}</strong></div>
        <div><span>Azimut aprox.</span><strong>${Number.isFinite(m.centerAzimuth)?`${Math.round(m.centerAzimuth)}°`:'N/D'}</strong></div>
        <div><span>Luz lunar</span><strong>${state.moon?`${state.moon.illuminationPercent}%`:'N/D'}</strong></div>
      </div>
      <p class="astro-note">${m.darkStart&&m.darkEnd?`Noche astronómica aprox.: ${formatTime(m.darkStart,CONFIG.DEFAULT_TIME_ZONE)}–${formatTime(m.darkEnd,CONFIG.DEFAULT_TIME_ZONE)}.`:'La ventana se estima combinando oscuridad, posición del centro galáctico y fase lunar.'}</p>`;
  }
  if(eventsEl){
    if(!state.astroEvents?.length){ eventsEl.innerHTML='<div class="empty">No hay eventos astronómicos próximos para esta fecha.</div>'; return; }
    eventsEl.innerHTML=state.astroEvents.map(evt=>`<div class="astro-event"><span class="astro-event-icon">${evt.icon}</span><div><strong>${evt.title}</strong><span>${evt.detail}</span></div></div>`).join('');
  }
}

function openWeatherSkeleton(){
  const el=$('openweather-info'); if(!el) return;
  el.setAttribute('aria-busy','true');
  el.innerHTML=`<div class="ow-loading" role="status" aria-live="polite"><span class="sr-only">Consultando previsión complementaria de OpenWeather…</span><div class="skeleton ow-skeleton-head"></div><div class="ow-skeleton-grid">${Array.from({length:4},()=>'<div class="ow-skeleton-card"><span class="skeleton md"></span><span class="skeleton sm"></span><span class="skeleton sm"></span><span class="skeleton sm"></span></div>').join('')}</div></div>`;
}

async function refreshOpenWeather(force=false, parentWeatherRequest=null){
  const el=$('openweather-info');
  if(!el) return;
  const requestId=++openWeatherRequestId;
  state.openWeatherLoading=true; state.openWeatherError=null; state.openWeatherSummary=null;
  openWeatherSkeleton();
  try {
    const forecast=await getOpenWeatherForecast(state.location.latitude,state.location.longitude,{force});
    if(requestId!==openWeatherRequestId || (parentWeatherRequest!==null && parentWeatherRequest!==weatherRequestId)) return;
    state.openWeather=forecast;
    const points=getOpenWeatherForDate(state.openWeather,state.date);
    state.openWeatherSummary=summarizeOpenWeather(points);
    state.openWeatherError=null;
  } catch(error) {
    if(requestId!==openWeatherRequestId || (parentWeatherRequest!==null && parentWeatherRequest!==weatherRequestId)) return;
    state.openWeather=null; state.openWeatherSummary=null;
    state.openWeatherError=friendlyOpenWeatherError(error);
  } finally {
    if(requestId===openWeatherRequestId && (parentWeatherRequest===null || parentWeatherRequest===weatherRequestId)) {
      state.openWeatherLoading=false;
      renderOpenWeather();
      if(state.weather) refreshDashboard();
    }
  }
}

function renderOpenWeather(){
  const el=$('openweather-info');
  if(!el) return;
  if(state.openWeatherLoading){ openWeatherSkeleton(); return; }
  el.setAttribute('aria-busy','false');
  if(state.openWeatherError){
    el.innerHTML=`<div class="api-error" role="alert"><strong>Datos complementarios no disponibles</strong><p>${escapeHtml(state.openWeatherError)}</p><button type="button" class="primary" id="retry-openweather">Reintentar OpenWeather</button></div>`;
    $('retry-openweather')?.addEventListener('click',()=>state.weather ? refreshOpenWeather(true) : refreshWeather(true));
    return;
  }
  const s=state.openWeatherSummary;
  if(!s || !s.points.length){
    el.innerHTML='<div class="empty" role="status">No hay tramos de OpenWeather para esta fecha. El pronóstico gratuito ofrece intervalos de 3 horas para aproximadamente 5 días; selecciona otra fecha o actualiza más tarde.</div>';
    return;
  }

  const points=[...s.points].sort((a,b)=>(a.timestamp??0)-(b.timestamp??0));
  const formatHour = point => {
    if(Number.isFinite(point.hour)) return `${String(point.hour).padStart(2,'0')}h`;
    if(point.timestamp){
      const parts=new Intl.DateTimeFormat('es-ES',{timeZone:CONFIG.DEFAULT_TIME_ZONE,hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(point.timestamp));
      return `${parts.find(x=>x.type==='hour')?.value ?? '--'}h`;
    }
    return '--h';
  };
  const fmtValue = (value, suffix='') => Number.isFinite(value) ? `${Number(value).toLocaleString('es-ES',{maximumFractionDigits:1})}${suffix}` : 'N/D';
  const windDirection = deg => Number.isFinite(deg) ? `${Math.round(deg)}°` : 'N/D';
  const weatherLabel = point => point.weather?.description ? escapeHtml(point.weather.description.charAt(0).toUpperCase()+point.weather.description.slice(1)) : 'Condición no disponible';

  const cards=points.map(point=>`<article class="openweather-slot">
    <div class="openweather-slot-head"><strong>${formatHour(point)}</strong><span>+3 h</span></div>
    <div class="openweather-condition">${weatherLabel(point)}</div>
    <div class="openweather-slot-grid">
      <div class="ow-cloudiness"><span>☁️ Nubosidad</span><b>${fmtValue(point.cloudiness,' %')}</b></div>
      <div><span>🌡 Temperatura</span><b>${fmtValue(point.temperature,' °C')}</b></div>
      <div><span>👁 Visibilidad</span><b>${fmtValue(point.visibility,' km')}</b></div>
      <div><span>🌧 Prob. lluvia</span><b>${fmtValue(point.precipitationProbability,' %')}</b></div>
      <div><span>🌧 Lluvia</span><b>${fmtValue(point.rain3h,' mm')}</b></div>
      <div><span>💨 Viento</span><b>${fmtValue(point.wind?.speed,' km/h')}</b></div>
      <div><span>↗ Dirección</span><b>${windDirection(point.wind?.direction)}</b></div>
      <div><span>💨 Racha</span><b>${fmtValue(point.wind?.gust,' km/h')}</b></div>
    </div>
  </article>`).join('');

  const maxCloud = Math.max(...points.map(p=>Number.isFinite(p.cloudiness)?p.cloudiness:0),100);
  const bars = points.map(point=>{ const cloud=Number.isFinite(point.cloudiness)?point.cloudiness:0; const h=Math.max(4,Math.round((cloud/100)*76)); return `<div class="cloud-evolution-item"><div class="cloud-evolution-bar-wrap"><div class="cloud-evolution-bar" style="height:${h}px"></div></div><strong>${Number.isFinite(point.cloudiness)?Math.round(point.cloudiness)+'%':'N/D'}</strong><span>${formatHour(point)}</span></div>`; }).join('');
  el.innerHTML=`<div class="cloud-evolution"><div class="cloud-evolution-head"><div><strong>☁️ Evolución de nubosidad</strong><span>Previsión OpenWeather · 3 h</span></div></div><div class="cloud-evolution-chart" aria-label="Evolución de nubosidad por horas">${bars}</div></div><div class="openweather-slots" aria-label="Previsión de OpenWeather por intervalos de 3 horas">${cards}</div>`;
}

function renderBestMoment(){
  const title=$('best-moment-title'); const subtitle=$('best-moment-subtitle'); const score=$('best-moment-score'); const details=$('best-moment-details');
  if(!title||!subtitle||!score||!details) return;
  const m=state.bestMoment;
  if(!m){ title.textContent='Sin ventana clara'; subtitle.textContent='No hay suficientes datos horarios para identificar un momento destacado.'; score.textContent='—'; details.innerHTML=''; return; }
  title.textContent=`${m.timeLabel} · ${m.label}`;
  subtitle.textContent=m.reason || 'Ventana con la mejor combinación de condiciones del modo seleccionado.';
  score.textContent=`${m.score}/100`;
  const chips=[];
  if(Number.isFinite(m.cloudiness)) chips.push(`☁️ ${Math.round(m.cloudiness)} % nubosidad`);
  if(Number.isFinite(m.row?.rainProbability)) chips.push(`🌧 ${Math.round(m.row.rainProbability)} % lluvia`);
  if(Number.isFinite(m.row?.wind?.speed)) chips.push(`💨 ${Math.round(m.row.wind.speed)} km/h`);
  details.innerHTML=chips.map(x=>`<span>${x}</span>`).join('');
}

function renderMeteogram(){
  const canvas=$('weather-chart');
  const loading=$('chart-loading');
  if(state._chart) state._chart.destroy();
  if(!window.Chart) throw new Error('Chart.js no está disponible. Comprueba la conexión y recarga la página.');
  const hourly=getHourlyForDate(state.weather,state.date).slice(0,24);
  if(!hourly.length){ if(loading){loading.hidden=false;loading.innerHTML='<div class="empty" role="status">No hay datos horarios de AEMET para esta fecha.</div>'; } canvas?.parentElement?.setAttribute('aria-busy','false'); return; }

  const parseHour = (raw) => {
    if(raw === null || raw === undefined || raw === '') return null;
    const text=String(raw).trim();
    const iso=text.match(/T(\d{2})(?::\d{2})?/);
    if(iso) return Number(iso[1]);
    const range=text.match(/^(\d{1,2})(?:[-/]\d{1,2})?$/);
    if(range) { const h=Number(range[1]); return h>=0 && h<=23 ? h : null; }
    const compact=text.match(/^(\d{4})$/);
    if(compact) { const h=Number(compact[1].slice(0,2)); return h>=0 && h<=23 ? h : null; }
    const match=text.match(/(?:^|[^0-9])(\d{1,2})(?::\d{2})?/);
    if(match) { const h=Number(match[1]); return h>=0 && h<=23 ? h : null; }
    return null;
  };

  const extracted=hourly.map(x=>parseHour(x?.period ?? x?.hour ?? x?.time));
  const validCount=extracted.filter(Number.isInteger).length;
  const allSame=validCount>1 && new Set(extracted.filter(Number.isInteger)).size===1;
  const firstHour=validCount ? extracted.find(Number.isInteger) : 0;

  // Prefer the hour carried by AEMET. If a malformed payload repeats the same
  // hour for every point, use the ordered hourly sequence rather than drawing
  // twenty-four misleading "00" labels.
  const hours=hourly.map((x,i)=>{
    const direct=extracted[i];
    if(Number.isInteger(direct) && !allSame) return direct;
    return (firstHour + i) % 24;
  });
  const labels=hours.map(h=>String(h).padStart(2,'0'));

  state._chart=new Chart(canvas,{
    type:'line',
    data:{
      labels,
      datasets:[
        {label:'Temperatura',data:hourly.map(x=>x.temperature),yAxisID:'yTemp',borderColor:'#38BDF8',backgroundColor:'rgba(56,189,248,.12)',pointBackgroundColor:'#38BDF8',pointBorderColor:'#0F172A',borderWidth:2.5,pointRadius:3,tension:.25,spanGaps:true},
        {label:'Prob. lluvia',data:hourly.map(x=>x.rainProbability),yAxisID:'yPercent',borderColor:'#34D399',backgroundColor:'rgba(52,211,153,.10)',pointBackgroundColor:'#34D399',pointBorderColor:'#0F172A',borderWidth:2,pointRadius:2,tension:.25,spanGaps:true},
        {label:'Viento',data:hourly.map(x=>x.wind?.speed),yAxisID:'yWind',borderColor:'#A78BFA',backgroundColor:'rgba(167,139,250,.10)',pointBackgroundColor:'#A78BFA',pointBorderColor:'#0F172A',borderWidth:2,pointRadius:2,tension:.25,spanGaps:true}
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      layout:{padding:{bottom:12,left:4,right:4}},
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:true,position:'top',labels:{usePointStyle:true,padding:16,color:'#CBD5E1'}},
        tooltip:{backgroundColor:'#1E293B',titleColor:'#F8FAFC',bodyColor:'#E2E8F0',borderColor:'#475569',borderWidth:1,callbacks:{
          title:(items)=>items.length?`Hora ${items[0].label} h`:'',
          label:(ctx)=>{
            const v=ctx.parsed.y;
            if(v===null||v===undefined) return `${ctx.dataset.label}: N/D`;
            const unit=ctx.dataset.yAxisID==='yTemp'?' °C':ctx.dataset.yAxisID==='yPercent'?' %':' km/h';
            return `${ctx.dataset.label}: ${Number(v).toLocaleString('es-ES',{maximumFractionDigits:1})}${unit}`;
          }
        }}
      },
      scales:{
        x:{
          type:'category',offset:true,
          title:{display:true,text:'Hora local (h)',color:'#CBD5E1',padding:{top:10}},
          ticks:{color:'#94A3B8',display:true,autoSkip:true,maxTicksLimit:12,maxRotation:0,minRotation:0,padding:8,
            callback:(value,index)=>labels[index] ?? ''},
          grid:{display:false}
        },
        yTemp:{position:'left',title:{display:true,text:'Temperatura (°C)',color:'#CBD5E1'},ticks:{color:'#94A3B8'},grid:{color:'rgba(148,163,184,.14)'},suggestedMin:Math.floor(Math.min(...hourly.map(x=>x.temperature).filter(Number.isFinite),10))-2,suggestedMax:Math.ceil(Math.max(...hourly.map(x=>x.temperature).filter(Number.isFinite),30))+2},
        yPercent:{position:'right',min:0,max:100,title:{display:true,text:'Probabilidad de lluvia (%)',color:'#CBD5E1'},ticks:{color:'#94A3B8'},grid:{drawOnChartArea:false}},
        yWind:{position:'right',min:0,suggestedMax:Math.max(20,Math.ceil(Math.max(...hourly.map(x=>x.wind?.speed).filter(Number.isFinite),20)/10)*10),title:{display:true,text:'Viento (km/h)',color:'#CBD5E1'},ticks:{color:'#94A3B8'},grid:{drawOnChartArea:false},display:false}
      }
    }
  });
  if(loading) loading.hidden=true;
  canvas?.parentElement?.setAttribute('aria-busy','false');
}

function renderEmpty(message){
  if(state._chart){state._chart.destroy();state._chart=null;}
  state.currentScore=null; state.bestMoment=null; state.chartError=null;
  $('location-name').textContent=state.location.name;
  if($('moon-info')) $('moon-info').innerHTML='<div class="empty">Los cálculos astronómicos se muestran cuando la biblioteca está disponible.</div>';
  if($('milky-way-info')) $('milky-way-info').innerHTML='<div class="empty">Los cálculos astronómicos se muestran cuando la biblioteca está disponible.</div>';
  if($('astro-events')) $('astro-events').innerHTML='<div class="empty">Sin datos astronómicos calculados.</div>';
  ['temperature','rain-prob','wind','storm','humidity','temp-range'].forEach(id=>{if($(id)) $(id).textContent='N/D';});
  $('score').textContent='—'; $('score-label').textContent='SIN DATOS';
  $('indice-grid').innerHTML='<div class="empty">El índice requiere datos meteorológicos de AEMET.</div>';
  $('positives').innerHTML=`<li class="empty">${escapeHtml(message||'No hay datos disponibles.')}</li>`;
  $('negatives').innerHTML='';
  $('recommendation').textContent=message||'No se puede generar una recomendación sin datos meteorológicos.';
  $('source-note').textContent='No se ha podido obtener una predicción meteorológica de AEMET para esta consulta.';
  $('best-moment-title').textContent='Mejor momento no disponible';
  $('best-moment-subtitle').textContent=message||'Se necesita una predicción meteorológica para identificar una ventana fotográfica.';
  $('best-moment-score').textContent='—';
  $('best-moment-details').innerHTML='';
  const chartLoading=$('chart-loading'); if(chartLoading){chartLoading.hidden=false;chartLoading.innerHTML=`<div class="component-error" role="status">${escapeHtml(message||'No hay datos para el meteograma.')}</div>`;}
  $('chart-loading')?.parentElement?.setAttribute('aria-busy','false');
  ['moon-info','milky-way-info','astro-events'].forEach(id=>$(id)?.setAttribute('aria-busy','false'));
  if($('openweather-info')) renderOpenWeather();
}

async function getUserLocation(){ if(!navigator.geolocation){ toast('Geolocalización no disponible'); return; } navigator.geolocation.getCurrentPosition(p=>selectCoordinate(p.coords.latitude,p.coords.longitude,'Mi ubicación'),()=>toast('Permiso de ubicación denegado o no disponible'),{enableHighAccuracy:true,timeout:10000,maximumAge:300000}); }

async function doExplore(){
  setStatus('loading','Analizando localizaciones de Murcia…');
  if (!$('ranking')) return;
  $('ranking').setAttribute('aria-busy','true');
  $('ranking').innerHTML='<div class="ranking-skeletons" role="status" aria-live="polite"><span class="sr-only">Analizando localizaciones…</span>'+Array.from({length:4},()=>'<div class="skeleton ranking-skeleton"></div>').join('')+'</div>'; 
  try {
    const ranked = await exploreMurcia({ weatherLoader:getWeatherForMunicipality, mode:state.mode==='sunriseSunset'?'sunriseSunset':state.mode, date:state.date });
    renderOpportunities(ranked);
    $('ranking').innerHTML=ranked.slice(0,6).map((x,i)=>`<button class="ranking-row" data-rank-id="${x.location.id}"><span>${['🥇','🥈','🥉'][i]??`${i+1}.`} ${x.location.name}</span><strong>${x.score}/100</strong></button>`).join('') || '<div class="empty">No se han podido obtener predicciones para las localizaciones seleccionadas.</div>';
    $('ranking').querySelectorAll('[data-rank-id]').forEach(b=>b.addEventListener('click',()=>{const item=ranked.find(x=>x.location.id===b.dataset.rankId); if(item) selectOpportunityResult(item);}));
    $('ranking').setAttribute('aria-busy','false');
    const failed = PHOTO_LOCATIONS.length - ranked.length;
    setStatus('ready', failed ? `Exploración completada · ${ranked.length}/${PHOTO_LOCATIONS.length} localizaciones con datos` : 'Exploración completada.');
  } catch(e){
    $('ranking').setAttribute('aria-busy','false');
    const message=e?.status===429?'AEMET ha limitado temporalmente las consultas (HTTP 429). Espera un momento y vuelve a buscar.':(e?.message||'No se pudieron consultar las localizaciones. Comprueba la conexión e inténtalo de nuevo.');
    setStatus('error',`Error al explorar Murcia: ${message}`);
    $('ranking').innerHTML=`<div class="api-error" role="alert"><p>${escapeHtml(message)}</p><button type="button" class="primary" id="retry-explore">Reintentar búsqueda</button></div>`;
    $('retry-explore')?.addEventListener('click',doExplore);
  }
}
function updateAstronomyLink(){
  document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active', b.dataset.mode===state.mode);b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode));});
  const astroLink=$('astronomy-link');
  const recommendedLink=$('recommended-link');
  const openLink=$('open-astronomy');
  const openRecommended=$('open-recommended');
  saveNavigationContext({ latitude:state.location.latitude, longitude:state.location.longitude, date:state.date, name:state.location.name || 'Ubicación seleccionada', mode:state.mode });
  const params=new URLSearchParams({
    lat:String(state.location.latitude),
    lon:String(state.location.longitude),
    date:state.date,
    name:state.location.name || 'Ubicación seleccionada',
    mode:state.mode
  });
  const href=`astronomia.html?${params.toString()}`;
  if(astroLink) astroLink.href=href;
  if(recommendedLink) recommendedLink.href=`recomendados.html?${params.toString()}`;
  if(openLink) openLink.href=href;
  if(openRecommended) openRecommended.href=`recomendados.html?${params.toString()}`;
}

function renderOpportunities(ranked){ const scoreMap=new Map(ranked.map(x=>[x.location.id,x.score])); renderPhotoLocations(PHOTO_LOCATIONS,scoreMap); renderOpportunitiesMap(ranked); }
function renderOpportunitiesMap(ranked){
  renderOpportunityMarkers(ranked, item => selectOpportunityResult(item));
}
async function selectOpportunityResult(item){
  if(!item?.location) return;
  const municipality=getMunicipalityById(item.location.municipalityId);
  state.location={ id:item.location.id, name:item.location.name, latitude:item.location.latitude, longitude:item.location.longitude, municipalityId:municipality?.id ?? null };
  state.municipality=municipality;
  state.weather=item.weather ?? null;
  state.selectedOpportunityScore = {
    locationId: item.location.id,
    date: state.date,
    mode: state.mode,
    scoreData: { score: item.score, category: item.category, factors: item.factors, positives: item.positives, negatives: item.negatives }
  };
  setLocation(item.location.latitude,item.location.longitude,{label:item.location.name});
  if(state.weather){
    const dates=sortForecastDates(state.weather);
    if(dates.includes(state.date)){
      renderDateTabs(dates);
    } else if(dates.length){
      state.date=dates[0];
      renderDateTabs(dates);
    }
    refreshDashboard();
    await refreshOpenWeather(false);
    saveHistory({ municipalityId:state.municipality?.id ?? null, location:state.location, date:state.date, mode:state.mode, score:state.currentScore?.score ?? null });
    return;
  }
  await selectCoordinate(item.location.latitude,item.location.longitude,item.location.name);
}
async function getWeatherForMunicipality(m){
  const cached=loadWeatherCache(m.id,CONFIG.CACHE_DURATION);
  if(cached)return cached;
  try {
    const normalized=processAemetData(await getWeatherData(m.id),m);
    saveWeatherCache(m.id,normalized);
    return normalized;
  } catch(error){
    if(error?.status===429){
      const stale=loadWeatherCache(m.id,Infinity);
      if(stale) return stale;
    }
    throw error;
  }
}

function snapshot(){ const summary=state.weather?summarizeWeather(state.weather,state.date):null; return { location:state.location, municipality:state.municipality, date:state.date, mode:state.mode, weather:state.weather, openWeather:state.openWeatherSummary ?? null, astronomy:state.astronomy, moon:state.moon ?? null, milkyWay:state.milkyWay ?? null, astroEvents:state.astroEvents ?? [], indices:state.weather?calculateSpecificIndices(aggregateForScore()):null, summary, recommendation:$('recommendation')?.textContent ?? 'Sin datos' }; }
function renderHistory(){ $('history-list').innerHTML=loadHistory().slice(0,3).map((h,i)=>`<button class="history-row" data-history-index="${i}"><span>${h.location?.name??h.municipalityId}<small>${h.date} · ${h.mode}</small></span><b>${Number.isFinite(h.score)?h.score+'/100':'—'}</b></button>`).join('') || '<div class="empty">Sin consultas guardadas.</div>'; }
function renderFavorites(){ $('favorite-list').innerHTML=loadFavorites().map(f=>`<button class="history-row" data-favorite-id="${f.id}"><span>${f.name}<small>${f.latitude.toFixed(4)}, ${f.longitude.toFixed(4)}</small></span><b>→</b></button>`).join('') || '<div class="empty">Sin favoritos.</div>'; }
function openFavoriteDialog(){ const name=prompt('Nombre de la localización'); if(!name)return; const category=prompt('Categoría (paisaje, costa, naturaleza, arquitectura, nocturna)')??''; const notes=prompt('Notas')??''; saveFavorite({name,latitude:state.location.latitude,longitude:state.location.longitude,category,notes}); renderFavorites(); toast('Favorito guardado'); }
function toast(text){ $('toast').textContent=text; $('toast').classList.add('show'); setTimeout(()=>$('toast').classList.remove('show'),2200); }

async function boot(){
  try { initMap(({latitude,longitude})=>selectCoordinate(latitude,longitude)); fitMurcia(); $('map')?.setAttribute('aria-busy','false'); }
  catch(error) { const mapHost=$('map'); if(mapHost){mapHost.setAttribute('aria-busy','false');mapHost.innerHTML=`<div class="component-error" role="alert">El mapa no está disponible. Puedes seguir usando el buscador de localizaciones. ${escapeHtml(error.message)}</div>`;} setStatus('warning','Mapa no disponible; el buscador sigue activo.'); }
  bindUI();
  $('date-picker').value=state.date;
  renderFavorites();
  renderHistory();
  const params=new URLSearchParams(location.search);
  const urlContext=getNavigationContextFromUrl();
  const savedContext=getSavedNavigationContext();
  const context=urlContext||savedContext;
  const sharedDate=params.get('date')||urlContext?.date||savedContext?.date;
  const sharedMode=params.get('mode')||urlContext?.mode||savedContext?.mode;
  const sharedName=params.get('name')||urlContext?.name||savedContext?.name||'Ubicación compartida';
  const validModes=['landscape','sunriseSunset','coast','nature','architecture','nocturnal'];
  if(sharedDate && /^\d{4}-\d{2}-\d{2}$/.test(sharedDate)) state.date=sharedDate;
  if(sharedMode && validModes.includes(sharedMode)) state.mode=sharedMode;
  $('date-picker').value=state.date;
  if(context && Number.isFinite(context.latitude) && Number.isFinite(context.longitude)){
    await selectCoordinate(context.latitude,context.longitude,sharedName);
    return;
  }
  state.municipality=state.location;
  renderDateTabs([state.date]);
  await selectMunicipality(state.municipality);
}
boot().catch(error=>{ setLoadingState(false); const message=`No se pudo iniciar el mapa o la interfaz: ${error?.message||'error inesperado'}. Comprueba la conexión y recarga la página.`; setStatus('error',message); showAemetError(new Error(message)); });
