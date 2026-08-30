import { CONFIG } from './config.js';
import { MUNICIPALITIES } from '../data/municipalities.js';
import { PHOTO_LOCATIONS } from '../data/photo-locations.js';
import { getWeatherData, processAemetData } from './aemet.js';
import { findDay, getHourlyForDate, summarizeWeather, summarizeSkyConditions, sortForecastDates, conditionLabel } from './weather.js';
import { calculateSunTimes, formatTime, formatRange, getMoonData, calculateMilkyWay, calculateAstronomicalEvents } from './astronomy.js';
import { calculatePhotographyScore, calculateSpecificIndices, calculateBestPhotographyWindows } from './photography.js';
import { initMap, setLocation, renderPhotoLocations, renderOpportunities as renderOpportunityMarkers, fitMurcia } from './map.js';
import { searchLocation, nearestMunicipality, getMunicipalityById } from './locations.js';
import { loadWeatherCache, saveWeatherCache, saveHistory, loadHistory, deleteHistory, clearHistory, loadFavorites, saveFavorite, deleteFavorite } from './storage.js';
import { exportCSV, exportJSON, copySummary, generateShareUrl } from './export.js';
import { exploreMurcia, rankLocations } from './opportunities.js';

const state = { location:{...MUNICIPALITIES.find(x=>x.id==='30030')}, municipality:null, weather:null, date:localDateISO(), mode:'landscape', astronomy:null, currentScore:null, searchSelection:null };
const $ = id => document.getElementById(id);

function setStatus(kind,message) { const el=$('app-status'); el.dataset.state=kind; el.textContent=message; }
function fmt(v,suffix=''){ return Number.isFinite(Number(v)) ? `${Math.round(Number(v)*10)/10}${suffix}` : 'N/D'; }
function localDateISO(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function dateLabel(d){ return new Intl.DateTimeFormat('es-ES',{weekday:'short',day:'2-digit',month:'2-digit'}).format(new Date(`${d}T12:00:00`)); }
async function copyText(text){ if(navigator.clipboard?.writeText){ await navigator.clipboard.writeText(text); return; } const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }

function bindUI(){
  document.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>{ state.mode=btn.dataset.mode; document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b===btn)); refreshDashboard(); }));
  $('search-input').addEventListener('input', e=>renderSuggestions(searchLocation(e.target.value)));
  $('search-input').addEventListener('keydown', e=>{ if(e.key==='Enter'){ const first=document.querySelector('.suggestion'); if(first) first.click(); }});
  $('use-location').addEventListener('click', getUserLocation);
  $('refresh').addEventListener('click', ()=>refreshWeather(true));
  $('date-picker').addEventListener('change', e=>{ if(e.target.value){ state.date=e.target.value; renderDateTabs(state.weather?sortForecastDates(state.weather):[state.date]); if(state.weather) refreshDashboard(); } });
  $('explore').addEventListener('click', doExplore);
  $('share').addEventListener('click', async()=>{ try { const url=generateShareUrl(state.location,state.date); await copyText(url); toast('URL compartible copiada'); } catch { toast('No se pudo copiar la URL; puedes usarla desde el navegador.'); } });
  $('copy-summary').addEventListener('click', async()=>{ try { await copySummary(snapshot(), copyText); toast('Resumen copiado'); } catch { toast('No se pudo copiar el resumen.'); } });
  $('export-json').addEventListener('click',()=>exportJSON(snapshot()));
  $('export-csv').addEventListener('click',()=>exportCSV(snapshot()));
  $('add-favorite').addEventListener('click',()=>openFavoriteDialog());
  $('clear-history').addEventListener('click',()=>{ clearHistory(); renderHistory(); });
  $('history-list').addEventListener('click', e=>{ const i=e.target.dataset.historyIndex; if(i!==undefined){ const h=loadHistory()[Number(i)]; if(h?.municipalityId){ selectMunicipality(getMunicipalityById(h.municipalityId)); } } });
  $('favorite-list').addEventListener('click', e=>{ const id=e.target.dataset.favoriteId; if(id){ const f=loadFavorites().find(x=>x.id===id); if(f) selectCoordinate(f.latitude,f.longitude,f.name); }});
  window.addEventListener('mpwp:map-location', e=>selectCoordinate(e.detail.latitude,e.detail.longitude,'Coordenadas seleccionadas'));
}

function renderSuggestions(items){ const el=$('suggestions'); el.innerHTML=''; items.forEach(item=>{ const b=document.createElement('button'); b.className='suggestion'; b.textContent=item.label; b.addEventListener('click',()=>{ el.innerHTML=''; $('search-input').value=item.label; if(item.kind==='coordinates') selectCoordinate(item.latitude,item.longitude,item.label); else selectMunicipality(item.kind==='photo'?getMunicipalityById(item.municipalityId):item); }); el.appendChild(b); }); }

async function selectMunicipality(m){ if(!m) return; state.municipality=m; state.location={...m}; setLocation(m.latitude,m.longitude,{label:m.name}); await refreshWeather(); }
async function selectCoordinate(lat,lon,label='Coordenadas',load=true){ const m=nearestMunicipality(lat,lon); state.location={ id:`coord-${lat}-${lon}`, name:label, latitude:lat, longitude:lon, municipalityId:m?.id ?? null }; state.municipality=m; setLocation(lat,lon,{label}); if(load) await refreshWeather(); }

async function refreshWeather(force=false){
  if(!state.municipality){ setStatus('error','No se ha podido determinar un municipio de referencia para AEMET.'); return; }
  setStatus('loading','Cargando predicción de AEMET…');
  try {
    let normalized=force?null:loadWeatherCache(state.municipality.id,CONFIG.CACHE_DURATION);
    if(!normalized){ const raw=await getWeatherData(state.municipality.id); normalized=processAemetData(raw,state.municipality); saveWeatherCache(state.municipality.id,normalized); }
    state.weather=normalized;
    const dates=sortForecastDates(normalized); if(!dates.includes(state.date)) state.date=dates[0] ?? state.date;
    renderDateTabs(dates); refreshDashboard();
    saveHistory({ municipalityId:state.municipality.id, location:state.location, date:state.date, mode:state.mode, score:state.currentScore?.score ?? null });
    setStatus('ready',`Datos cargados · ${new Date(normalized.updatedAt).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}`);
  } catch(error){
    state.weather=null; renderEmpty(error.message); renderDateTabs([state.date]); const help=$('aemet-help'); help.hidden=false; help.textContent=error.code==='API_KEY_MISSING'?'AEMET no está configurado. Edita js/config.js y sustituye MI_API_KEY por tu clave de AEMET OpenData.':`AEMET: ${error.message}`; setStatus('error',help.textContent);
  }
}

function renderDateTabs(dates){ const valid=(dates||[]).filter(Boolean); const picker=$('date-picker'); picker.value=state.date; picker.disabled=false; picker.min=valid[0]??''; picker.max=valid.at(-1)??''; $('date-tabs').innerHTML=''; valid.forEach((d,i)=>{ const b=document.createElement('button'); b.className='date-tab'; b.classList.toggle('active',d===state.date); b.textContent=i===0?'Hoy':i===1?'Mañana':`+${i}`; b.title=d; b.addEventListener('click',()=>{ state.date=d; picker.value=d; renderDateTabs(valid); picker.blur(); refreshDashboard(); }); $('date-tabs').appendChild(b); }); if(!valid.length){ const b=document.createElement('span'); b.className='date-empty'; b.textContent='Sin fechas de AEMET'; $('date-tabs').appendChild(b); } }

function aggregateForScore(){
  const hourly=getHourlyForDate(state.weather,state.date); const s=summarizeWeather(state.weather,state.date);
  return { rain: Math.max(...hourly.map(x=>x.precipitation).filter(Number.isFinite),NaN), rainProbability:s.rainProbability, stormProbability:s.stormProbability, wind:s.wind.mean, temperature:(s.temperature.max+s.temperature.min)/2, humidity:s.humidity.mean, hourly };
}

function refreshDashboard(){
  if(!state.weather){ renderEmpty('Sin datos meteorológicos todavía. Configura AEMET y pulsa Actualizar.'); return; }
  $('aemet-help').hidden=true;
  const date=state.date; const location=state.location; const summary=summarizeWeather(state.weather,date); state.astronomy=calculateSunTimes(date,location.latitude,location.longitude); const score=calculatePhotographyScore(aggregateForScore(), state.mode==='sunriseSunset'?'sunriseSunset':state.mode); state.currentScore=score; const indices=calculateSpecificIndices(aggregateForScore());
  $('location-name').textContent=location.name; $('coordinates').textContent=`${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`; $('municipality').textContent=state.municipality?.name ?? '—'; $('score').textContent=`${score.score}/100`; $('score-label').textContent=score.category.toUpperCase(); $('temperature').textContent=`${fmt(summary.temperature.current ?? summary.temperature.max,' °C')}`; $('temp-range').textContent=`${fmt(summary.temperature.min,' °C')} – ${fmt(summary.temperature.max,' °C')}`; $('rain-prob').textContent=fmt(summary.rainProbability,' %'); $('wind').textContent=fmt(summary.wind.mean,' km/h'); $('storm').textContent=conditionLabel(summary.stormProbability); $('humidity').textContent=fmt(summary.humidity.mean,' %');
  $('sunrise').textContent=formatTime(state.astronomy.sunrise); $('sunset').textContent=formatTime(state.astronomy.sunset); $('golden-morning').textContent=formatRange(state.astronomy.goldenMorning,CONFIG.DEFAULT_TIME_ZONE); $('golden-evening').textContent=formatRange(state.astronomy.goldenEvening,CONFIG.DEFAULT_TIME_ZONE); $('blue-morning').textContent=formatRange(state.astronomy.blueMorning,CONFIG.DEFAULT_TIME_ZONE); $('blue-evening').textContent=formatRange(state.astronomy.blueEvening,CONFIG.DEFAULT_TIME_ZONE); $('day-length').textContent=state.astronomy.dayLengthMs ? `${Math.floor(state.astronomy.dayLengthMs/3600000)}h ${Math.round((state.astronomy.dayLengthMs%3600000)/60000)}m` : 'N/D';
  $('indice-grid').innerHTML=[['🌅 Amanecer',indices.sunrise],['☀️ Día',indices.day],['🌇 Atardecer',indices.sunset],['🌌 Noche',indices.night]].map(([l,v])=>`<div class="index-mini"><span>${l}</span><strong>${v}/100</strong></div>`).join('');
  state.moon=getMoonData(date,location.latitude,location.longitude,CONFIG.DEFAULT_TIME_ZONE);
  state.milkyWay=calculateMilkyWay(date,location.latitude,location.longitude,state.astronomy,state.moon);
  state.astroEvents=calculateAstronomicalEvents(date,location.latitude,location.longitude,CONFIG.DEFAULT_TIME_ZONE);
  renderSkyConditions(getHourlyForDate(state.weather,date));
  renderAstronomyPanels();
  $('positives').innerHTML=score.positives.map(x=>`<li>✓ ${x}</li>`).join('') || '<li>Sin factores positivos identificados.</li>'; $('negatives').innerHTML=score.negatives.map(x=>`<li>⚠ ${x}</li>`).join('') || '<li>Sin factores negativos identificados.</li>';
  $('recommendation').textContent=score.score>=81?'Excelente oportunidad fotográfica.':score.score>=61?'Buenas condiciones: la ventana merece consideración.':score.score>=41?'Condiciones aceptables, con factores a vigilar.':'Condiciones poco favorables para este modo.';
  $('source-note').textContent=`Datos meteorológicos: AEMET. Índices fotográficos: cálculo propio. Fecha ${dateLabel(date)}.`;
  renderMeteogram(); renderWindows(); renderHistory(); renderFavorites(); renderPhotoLocations(PHOTO_LOCATIONS);
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

function renderSkyConditions(hourly){
  const el=$('sky-conditions');
  if(!el) return;
  const info=summarizeSkyConditions(hourly);
  if(!info.available){
    el.innerHTML='<div class="empty">AEMET no proporciona un estado del cielo horario utilizable para esta fecha.</div>';
    return;
  }
  const sequence=info.sequence.map(item=>`<div class="sky-hour" title="${item.description ?? item.label}"><span>${String(item.hour).padStart(2,'0')}h</span><strong>${item.icon}</strong><small>${item.label}</small></div>`).join('');
  el.innerHTML=`
    <div class="sky-summary">
      <div class="sky-main"><span class="sky-icon">${info.dominantIcon}</span><div><span class="sky-kicker">Predominio del cielo</span><strong>${info.dominant}</strong></div></div>
      <div class="sky-interest"><span>Interés fotográfico del cielo</span><b>${info.photoInterest}</b></div>
    </div>
    <div class="sky-badges">
      <span class="sky-badge">☁️ Estado del cielo: AEMET</span>
      ${info.hasHighCloud?'<span class="sky-badge accent">🌥️ Nubes altas detectadas</span>':''}
      ${info.hasPartlyCloudy?'<span class="sky-badge accent">⛅ Nubosidad variable</span>':''}
    </div>
    <div class="sky-timeline">${sequence}</div>
    <p class="sky-note">El servicio municipal de AEMET proporciona <strong>estado del cielo</strong>; no se muestran porcentajes separados de nube baja, media y alta porque este dato no está disponible en este endpoint.</p>`;
}

function renderWindows(){ const windows=calculateBestPhotographyWindows(getHourlyForDate(state.weather,state.date),state.astronomy,state.mode); $('windows').innerHTML=windows.length?windows.map(w=>`<div class="window-row"><strong>${formatTime(w.start)}</strong><span>${w.label}</span><b>${w.score}/100</b></div>`).join(''):'<div class="empty">No hay datos horarios suficientes para construir ventanas.</div>'; }
function renderMeteogram(){
  const canvas=$('weather-chart');
  if(state._chart) state._chart.destroy();
  const hourly=getHourlyForDate(state.weather,state.date).slice(0,24);
  if(!hourly.length) return;

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
        {label:'Temperatura',data:hourly.map(x=>x.temperature),yAxisID:'yTemp',borderWidth:2.5,pointRadius:3,tension:.25,spanGaps:true},
        {label:'Prob. lluvia',data:hourly.map(x=>x.rainProbability),yAxisID:'yPercent',borderWidth:2,pointRadius:2,tension:.25,spanGaps:true},
        {label:'Viento',data:hourly.map(x=>x.wind?.speed),yAxisID:'yWind',borderWidth:2,pointRadius:2,tension:.25,spanGaps:true}
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      layout:{padding:{bottom:12,left:4,right:4}},
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:true,position:'top',labels:{usePointStyle:true,padding:16}},
        tooltip:{callbacks:{
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
          title:{display:true,text:'Hora local (h)',padding:{top:10}},
          ticks:{display:true,autoSkip:true,maxTicksLimit:12,maxRotation:0,minRotation:0,padding:8,
            callback:(value,index)=>labels[index] ?? ''},
          grid:{display:false}
        },
        yTemp:{position:'left',title:{display:true,text:'Temperatura (°C)'},suggestedMin:Math.floor(Math.min(...hourly.map(x=>x.temperature).filter(Number.isFinite),10))-2,suggestedMax:Math.ceil(Math.max(...hourly.map(x=>x.temperature).filter(Number.isFinite),30))+2},
        yPercent:{position:'right',min:0,max:100,title:{display:true,text:'Probabilidad de lluvia (%)'},grid:{drawOnChartArea:false}},
        yWind:{position:'right',min:0,suggestedMax:Math.max(20,Math.ceil(Math.max(...hourly.map(x=>x.wind?.speed).filter(Number.isFinite),20)/10)*10),title:{display:true,text:'Viento (km/h)'},grid:{drawOnChartArea:false},display:false}
      }
    }
  });
}

function renderEmpty(message){ $('location-name').textContent=state.location.name; if($('moon-info')) $('moon-info').innerHTML='<div class="empty">Sin datos astronómicos.</div>'; if($('milky-way-info')) $('milky-way-info').innerHTML='<div class="empty">Sin datos astronómicos.</div>'; if($('astro-events')) $('astro-events').innerHTML='<div class="empty">Sin datos astronómicos.</div>';  ['temperature','rain-prob','wind','storm','humidity','sunrise','sunset','golden-morning','golden-evening','blue-morning','blue-evening','day-length'].forEach(id=>$(id).textContent='N/D'); $('score').textContent='—'; $('score-label').textContent='SIN DATOS'; $('windows').innerHTML=`<div class="empty">${message}</div>`; $('positives').innerHTML=''; $('negatives').innerHTML=''; }

async function getUserLocation(){ if(!navigator.geolocation){ toast('Geolocalización no disponible'); return; } navigator.geolocation.getCurrentPosition(p=>selectCoordinate(p.coords.latitude,p.coords.longitude,'Mi ubicación'),()=>toast('Permiso de ubicación denegado o no disponible'),{enableHighAccuracy:true,timeout:10000,maximumAge:300000}); }

async function doExplore(){
  setStatus('loading','Analizando localizaciones de Murcia…');
  $('ranking').innerHTML='<div class="empty">Consultando predicciones y calculando oportunidades…</div>';
  try {
    const ranked = await exploreMurcia({ weatherLoader:getWeatherForMunicipality, mode:state.mode==='sunriseSunset'?'sunriseSunset':state.mode, date:state.date });
    renderOpportunities(ranked);
    $('ranking').innerHTML=ranked.slice(0,6).map((x,i)=>`<button class="ranking-row" data-rank-id="${x.location.id}"><span>${['🥇','🥈','🥉'][i]??`${i+1}.`} ${x.location.name}</span><strong>${x.score}/100</strong></button>`).join('') || '<div class="empty">No se han podido obtener predicciones para las localizaciones seleccionadas.</div>';
    $('ranking').querySelectorAll('[data-rank-id]').forEach(b=>b.addEventListener('click',()=>{const item=ranked.find(x=>x.location.id===b.dataset.rankId); if(item) selectCoordinate(item.location.latitude,item.location.longitude,item.location.name);}));
    const failed = PHOTO_LOCATIONS.length - ranked.length;
    setStatus('ready', failed ? `Exploración completada · ${ranked.length}/${PHOTO_LOCATIONS.length} localizaciones con datos` : 'Exploración completada.');
  } catch(e){
    setStatus('error',`Error al explorar Murcia: ${e.message}`);
    $('ranking').innerHTML=`<div class="empty">${e.message}</div>`;
  }
}
function renderOpportunities(ranked){ const scoreMap=new Map(ranked.map(x=>[x.location.id,x.score])); renderPhotoLocations(PHOTO_LOCATIONS,scoreMap); renderOpportunitiesMap(ranked); }
function renderOpportunitiesMap(ranked){ renderOpportunityMarkers(ranked.map(x=>({location:x.location,score:x.score})),loc=>selectCoordinate(loc.latitude,loc.longitude,loc.name)); }
async function getWeatherForMunicipality(m){ const cached=loadWeatherCache(m.id,CONFIG.CACHE_DURATION); if(cached)return cached; const normalized=processAemetData(await getWeatherData(m.id),m); saveWeatherCache(m.id,normalized); return normalized; }

function snapshot(){ const summary=summarizeWeather(state.weather,state.date); return { location:state.location, municipality:state.municipality, date:state.date, mode:state.mode, weather:state.weather, astronomy:state.astronomy, moon:state.moon ?? null, milkyWay:state.milkyWay ?? null, astroEvents:state.astroEvents ?? [], indices:calculateSpecificIndices(aggregateForScore()), summary, recommendation:$('recommendation').textContent }; }
function renderHistory(){ $('history-list').innerHTML=loadHistory().slice(0,10).map((h,i)=>`<button class="history-row" data-history-index="${i}"><span>${h.location?.name??h.municipalityId}<small>${h.date} · ${h.mode}</small></span><b>${Number.isFinite(h.score)?h.score+'/100':'—'}</b></button>`).join('') || '<div class="empty">Sin consultas guardadas.</div>'; }
function renderFavorites(){ $('favorite-list').innerHTML=loadFavorites().map(f=>`<button class="history-row" data-favorite-id="${f.id}"><span>${f.name}<small>${f.latitude.toFixed(4)}, ${f.longitude.toFixed(4)}</small></span><b>→</b></button>`).join('') || '<div class="empty">Sin favoritos.</div>'; }
function openFavoriteDialog(){ const name=prompt('Nombre de la localización'); if(!name)return; const category=prompt('Categoría (paisaje, costa, naturaleza, arquitectura, nocturna)')??''; const notes=prompt('Notas')??''; saveFavorite({name,latitude:state.location.latitude,longitude:state.location.longitude,category,notes}); renderFavorites(); toast('Favorito guardado'); }
function toast(text){ $('toast').textContent=text; $('toast').classList.add('show'); setTimeout(()=>$('toast').classList.remove('show'),2200); }

async function boot(){
  initMap(({latitude,longitude})=>selectCoordinate(latitude,longitude));
  fitMurcia();
  bindUI();
  $('date-picker').value=state.date;
  renderFavorites();
  renderHistory();
  const params=new URLSearchParams(location.search);
  const lat=Number(params.get('lat'));
  const lon=Number(params.get('lon'));
  const sharedDate=params.get('date');
  if(Number.isFinite(lat)&&Number.isFinite(lon)){
    if(sharedDate) state.date=sharedDate;
    await selectCoordinate(lat,lon,'Ubicación compartida');
    return;
  }
  state.municipality=state.location;
  renderDateTabs([state.date]);
  await selectMunicipality(state.municipality);
}
boot().catch(error=>setStatus('error',`Error de inicialización: ${error.message}`));
