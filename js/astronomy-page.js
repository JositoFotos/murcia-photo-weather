import { calculateSunTimes, formatTime, getMoonData, calculateMilkyWay, calculateAstronomicalEvents, calculateLunarCalendar, calculateNightConditions } from './astronomy.js';
import { getOpenWeatherForecast, getOpenWeatherForDate } from './openweather.js';
import { CONFIG } from './config.js';
import { getLightPollution } from './light-pollution.js';
import { initLightPollutionMap, updateLightPollutionMap } from './light-pollution-map.js';
import { getNavigationContextFromUrl, getSavedNavigationContext, saveNavigationContext } from './navigation-context.js';

const $=id=>document.getElementById(id);
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
const localDateISO=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const params=new URLSearchParams(location.search);
const urlContext=getNavigationContextFromUrl();
const savedContext=getSavedNavigationContext();
const initialContext=urlContext||savedContext;
const state={
  lat:initialContext?.latitude ?? 37.983,
  lon:initialContext?.longitude ?? -1.129,
  name:params.get('name') || urlContext?.name || savedContext?.name || 'Murcia',
  date:params.get('date')||urlContext?.date||savedContext?.date||localDateISO(),
  mode:params.get('mode')||urlContext?.mode||savedContext?.mode||'landscape',
  moon:null,milkyWay:null,events:[],sun:null,openWeather:null,openWeatherLoading:true,openWeatherError:null,night:null,lightPollution:null,lightPollutionLoading:true,lightPollutionError:null
};
let astronomyRequestId=0;

function updateLinks(){
  saveNavigationContext({latitude:state.lat,longitude:state.lon,date:state.date,name:state.name,mode:state.mode});
  const q=new URLSearchParams({lat:String(state.lat),lon:String(state.lon),date:state.date,name:state.name,mode:state.mode});
  $('photo-link').href=`index.html?${q}`;
  $('back-photo').href=`index.html?${q}`;
  $('back-recommended').href=`recomendados.html?${q}`;
  $('recommended-link').href=`recomendados.html?${q}`;
  const nextUrl = `${location.pathname}?${q.toString()}`;
  if (`${location.pathname}${location.search}` !== nextUrl) history.replaceState(null, '', nextUrl);
}

function describeLightPollution(index, mpsas) {
  const ratio = Number(index);
  if (!Number.isFinite(ratio)) {
    return {
      title: 'No hay una valoración disponible',
      level: 3,
      explanation: 'No se ha podido interpretar el valor del atlas para este punto.',
      effect: 'No podemos estimar cómo influye el brillo artificial en el contraste de la sesión.',
      advice: 'Comprueba las coordenadas o vuelve a consultar el atlas.'
    };
  }

  const ratioText = ratio.toLocaleString('es-ES', { maximumFractionDigits: ratio < 0.1 ? 3 : 2 });
  if (ratio < 0.11) {
    return {
      title: 'Cielo muy poco afectado por luz artificial', level: 1,
      explanation: `El atlas estima que el componente artificial equivale a ${ratioText} veces el brillo natural de referencia: su contribución es pequeña.`,
      effect: 'Es un entorno favorable para conservar el contraste de estrellas débiles y estructuras tenues de la Vía Láctea, siempre que la Luna, la nubosidad y la transparencia acompañen.',
      advice: 'Prioriza una noche sin Luna y un cielo despejado; revisa también el resplandor del horizonte, que puede ser mayor que el del cenit.'
    };
  }
  if (ratio < 0.33) {
    return {
      title: 'Cielo oscuro con poca influencia artificial', level: 2,
      explanation: `La aportación artificial estimada es ${ratioText} veces el brillo natural de referencia. La luz artificial añade algo de resplandor, pero sigue siendo relativamente baja.`,
      effect: 'Buena base para fotografía de estrellas y Vía Láctea. Las estructuras más tenues pueden perder algo de contraste, especialmente hacia el horizonte de núcleos poblados.',
      advice: 'Busca un encuadre cuyo horizonte mire en dirección contraria a pueblos, carreteras o instalaciones iluminadas.'
    };
  }
  if (ratio < 1) {
    return {
      title: 'La contaminación lumínica ya puede notarse', level: 3,
      explanation: `El atlas estima una contribución artificial de ${ratioText} veces el brillo natural de referencia. En este rango, la luz artificial todavía es menor que la componente natural de referencia, pero ya puede elevar el fondo del cielo.`,
      effect: 'Las estrellas brillantes seguirán siendo fotografiables, pero el contraste de las partes débiles de la Vía Láctea puede reducirse; el horizonte puede mostrar más resplandor.',
      advice: 'Prueba una composición amplia, evita orientar la cámara hacia zonas urbanas y considera desplazarte a un lugar más oscuro si buscas detalle fino en las nubes de polvo.'
    };
  }
  if (ratio < 3) {
    return {
      title: 'La luz artificial tiene una influencia importante', level: 4,
      explanation: `La contribución artificial estimada es ${ratioText} veces el brillo natural de referencia; según el índice del atlas, ya supera esa referencia natural.`,
      effect: 'El fondo del cielo tenderá a verse más claro y habrá menos contraste para estructuras tenues. La Vía Láctea puede captarse en condiciones favorables, pero los detalles débiles serán más difíciles de registrar y procesar.',
      advice: 'Para fotografiar la Vía Láctea con más detalle, merece la pena buscar un emplazamiento más oscuro. Si te quedas aquí, evita el horizonte iluminado y ajusta la sesión a una noche sin Luna y con poca nubosidad.'
    };
  }
  return {
    title: 'Cielo muy afectado por luz artificial', level: 5,
    explanation: `La contribución artificial estimada es ${ratioText} veces el brillo natural de referencia. El resplandor artificial domina claramente en el modelo del atlas.`,
    effect: 'El fondo del cielo puede quedar muy luminoso y el contraste de la Vía Láctea tenue y de otros detalles débiles se reduce de forma considerable.',
    advice: 'Para astrofotografía de cielo profundo o una Vía Láctea con detalle, busca otra localización más oscura. Este punto puede seguir sirviendo para escenas nocturnas que incorporen elementos urbanos o estrellas brillantes.'
  };
}

function renderLightPollutionCard(){
  const host=$('light-pollution-info');
  if(!host) return;
  host.setAttribute('aria-busy',String(state.lightPollutionLoading));
  if(state.lightPollutionLoading){
    host.innerHTML='<div class="lp-loading"><span class="skeleton lg"></span><span>Consultando el atlas de contaminación lumínica…</span></div>';
    return;
  }
  if(state.lightPollutionError || !state.lightPollution){
    const message=state.lightPollutionError||'No hay datos del atlas para estas coordenadas.';
    host.innerHTML=`<div class="lp-error"><strong>No se pudo cargar el dato</strong><p>${escapeHtml(message)}</p><button type="button" id="lp-retry" class="primary">Reintentar</button></div>`;
    $('lp-retry')?.addEventListener('click',()=>loadLightPollution(true));
    return;
  }
  const lp=state.lightPollution;
  const index=Number(lp.lpIndex);
  const mpsas=Number(lp.mpsas);
  const narrative=describeLightPollution(index,mpsas);
  const impact=lp.impact||{label:'N/D',level:narrative.level,description:''};
  const level=Math.max(1,Math.min(5,Number(narrative.level)||Number(impact.level)||3));
  const fmt=(n,d=2)=>Number(n).toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d});
  const indexDisplay=Number.isFinite(index)?`${fmt(index,index<0.1?3:2)}×`:'N/D';
  const mpsasDisplay=Number.isFinite(mpsas)?fmt(mpsas,2):'N/D';
  host.innerHTML=`
    <section class="lp-story lp-level-${level}">
      <div class="lp-story-top"><span class="lp-story-kicker">Qué significa para tu sesión</span><span class="lp-impact-pill lp-level-${level}">${escapeHtml(impact.label||'Impacto orientativo')}</span></div>
      <h3 class="lp-story-title">${escapeHtml(narrative.title)}</h3>
      <p class="lp-story-explanation">${escapeHtml(narrative.explanation)}</p>
      <div class="lp-story-effect"><strong>🌌 ¿Qué puedes esperar en tus fotos?</strong><p>${escapeHtml(narrative.effect)}</p></div>
      <div class="lp-story-advice"><strong>📸 Recomendación práctica</strong><p>${escapeHtml(narrative.advice)}</p></div>
      <div class="lp-meter" role="img" aria-label="Nivel orientativo de influencia de la contaminación lumínica: ${level} de 5"><span class="lp-meter-fill lp-level-${level}" style="width:${Math.round((level/5)*100)}%"></span></div>
      <div class="lp-meter-labels"><span>Menor influencia</span><span>Mayor influencia</span></div>
    </section>
    <details class="lp-technical"><summary>Ver los datos numéricos del atlas y qué significan</summary>
      <div class="lp-primary-values">
        <div class="lp-stat lp-index-stat"><span>Índice LP</span><strong>${indexDisplay}</strong><small>Relación entre brillo artificial estimado y brillo natural de referencia. Por encima de 1×, la componente artificial supera esa referencia.</small></div>
        <div class="lp-stat"><span>Brillo estimado del cielo en el cenit</span><strong>${mpsasDisplay}</strong><small>mag/arcsec². En esta escala, un número mayor representa un cielo más oscuro. Es un valor modelizado, no una medición local.</small></div>
        <div class="lp-stat"><span>Zona del atlas</span><strong>${escapeHtml(lp.lpZone||'N/D')}</strong><small>Categoría propia del atlas; no equivale a una clase Bortle.</small></div>
      </div>
    </details>
    <p class="lp-note">El atlas estima el brillo artificial del cielo en el cenit usando un modelo basado en datos satelitales. No mide las condiciones exactas sobre el terreno ni representa por sí solo todo el horizonte. La Luna, las nubes y la transparencia atmosférica influyen por separado en la sesión real.</p>`;
}

let lpRequestId=0;
async function loadLightPollution(force=false){
  const requestId=++lpRequestId;
  const lat=state.lat, lon=state.lon;
  state.lightPollutionLoading=true;
  state.lightPollutionError=null;
  renderLightPollutionCard();
  try{
    const result=await getLightPollution(lat,lon,{force});
    if(requestId!==lpRequestId || lat!==state.lat || lon!==state.lon) return;
    state.lightPollution=result;
    state.lightPollutionLoading=false;
    state.lightPollutionError=null;
  }catch(error){
    if(requestId!==lpRequestId || lat!==state.lat || lon!==state.lon) return;
    state.lightPollution=null;
    state.lightPollutionLoading=false;
    state.lightPollutionError=error?.message||'Error de red al consultar el atlas.';
  }
  renderLightPollutionCard();
  updateLightPollutionMap(lat, lon, state.name, state.lightPollution, { pan: false });
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

  const nightHost=$('night-conditions');
  if(state.openWeatherLoading){
    nightHost.setAttribute('aria-busy','true');
    nightHost.innerHTML='<div class="panel-skeleton" role="status" aria-live="polite"><span>Consultando previsión para calcular las condiciones nocturnas…</span><span class="skeleton md"></span><span class="skeleton lg"></span></div>';
  } else if(state.openWeatherError){
    nightHost.setAttribute('aria-busy','false');
    nightHost.innerHTML=`<div class="api-error" role="alert"><strong>No se pudo cargar la previsión complementaria</strong><p>${escapeHtml(state.openWeatherError)}</p><button type="button" id="retry-astro-openweather" class="primary">Reintentar OpenWeather</button></div><p class="astro-note">La Luna, la Vía Láctea y los eventos astronómicos se calculan localmente; las condiciones nocturnas requieren la previsión meteorológica.</p>`;
    $('retry-astro-openweather')?.addEventListener('click',()=>renderAll({forceOpenWeather:true}));
  } else {
    nightHost.setAttribute('aria-busy','false');
    const n=state.night;
    nightHost.innerHTML=`<div class="night-score"><div><span>Índice nocturno</span><strong>${n.score}/100</strong></div><span class="night-score-label">${n.score>=81?'Excelente':n.score>=61?'Favorable':n.score>=41?'Moderado':'Limitado'}</span></div><div class="night-grid"><div><span>☁️ Nubosidad entrada noche</span><strong>${Number.isFinite(n.cloudiness)?Math.round(n.cloudiness)+' %':'N/D'}</strong></div><div><span>🌙 Iluminación lunar</span><strong>${m.illuminationPercent} %</strong></div><div><span>🌧 Prob. lluvia</span><strong>${Number.isFinite(n.rainProbability)?Math.round(n.rainProbability)+' %':'N/D'}</strong></div><div><span>👁 Visibilidad</span><strong>${Number.isFinite(n.visibility)?n.visibility.toLocaleString('es-ES',{maximumFractionDigits:1})+' km':'N/D'}</strong></div></div><p class="astro-note">Se pondera especialmente la nubosidad de 20–21 h, la luz lunar, la lluvia y la visibilidad para el inicio de una sesión nocturna.</p>`;
  }

  const calendar=calculateLunarCalendar(state.date,CONFIG.DEFAULT_TIME_ZONE);
  $('lunar-calendar').innerHTML=calendar.map(day=>{const dayISO=`${state.date.slice(0,7)}-${String(day.day).padStart(2,'0')}`;return `<button type="button" class="lunar-day ${day.selected?'selected':''}" data-lunar-date="${dayISO}" aria-label="${day.day} ${day.label}: ${day.name}, ${day.illuminationPercent}% iluminada" title="${day.name} · ${day.illuminationPercent}% iluminada"><span>${day.label.slice(0,2)}</span><strong>${day.day}</strong><b aria-hidden="true">${day.icon}</b><small>${day.illuminationPercent}%</small></button>`;}).join('');
  $('lunar-calendar').querySelectorAll('[data-lunar-date]').forEach(btn=>btn.addEventListener('click',()=>{state.date=btn.dataset.lunarDate;renderAll();}));

  $('astro-events').innerHTML=state.events.length?state.events.map(evt=>`<div class="astro-event"><span class="astro-event-icon">${evt.icon}</span><div><strong>${evt.title}</strong><span>${evt.detail}</span></div></div>`).join(''):'<div class="empty">No hay eventos destacados calculados para esta fecha.</div>';
  renderLightPollutionCard();
  updateLightPollutionMap(state.lat, state.lon, state.name, state.lightPollution, { pan: true });
  ['moon-info','milky-way-info','lunar-calendar','astro-events'].forEach(id=>$(id)?.setAttribute('aria-busy','false'));
  document.body.classList.remove('app-starting');
  document.querySelector('.astro-content')?.setAttribute('aria-busy','false');
  $('astro-status').textContent=state.openWeatherLoading?`Cálculos astronómicos listos · consultando previsión complementaria…`:`Actualizado · ${state.name} · ${state.date}`;
  updateLinks();
}

function showAstronomyError(error){
  const message=error?.message||'No se han podido calcular los datos astronómicos.';
  const ids=['moon-info','milky-way-info','night-conditions','astro-events','lunar-calendar'];
  ids.forEach((id,index)=>{
    const el=$(id);
    if(!el) return;
    el.setAttribute('aria-busy','false');
    const retry=index===0?'<button type="button" class="secondary" id="retry-astro-library">Recargar cálculos</button>':'';
    el.innerHTML=`<div class="component-error" role="alert"><strong>No se pudieron calcular estos datos</strong><p>${escapeHtml(message)} Comprueba que las librerías astronómicas se hayan cargado y recarga la página.</p>${retry}</div>`;
  });
  $('retry-astro-library')?.addEventListener('click',()=>location.reload());
  document.body.classList.remove('app-starting');
  document.querySelector('.astro-content')?.setAttribute('aria-busy','false');
  $('astro-status').textContent=`Error en los cálculos astronómicos: ${message}`;
}

function friendlyOpenWeatherError(error){
  if(error?.status===429) return 'OpenWeather ha limitado temporalmente las consultas (HTTP 429). Espera un poco y vuelve a intentarlo.';
  if(error?.status===401 || error?.status===403) return 'OpenWeather ha rechazado la credencial. Revisa el secreto OPENWEATHER_API en Netlify.';
  if(error?.status>=500) return `OpenWeather no está respondiendo correctamente (HTTP ${error.status}). Prueba más tarde.`;
  return error?.message||'No se ha podido obtener la previsión de OpenWeather.';
}

async function renderAll(options={}){
  const requestId=++astronomyRequestId;
  const dateValue=$('astro-date').value||state.date;
  const nameValue=$('astro-location').value.trim()||'Localización seleccionada';
  const latText=$('astro-lat').value;
  const lonText=$('astro-lon').value;
  const lat=latText===''?NaN:Number(latText);
  const lon=lonText===''?NaN:Number(lonText);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180){
    const message='Revisa los campos: introduce una fecha válida, una latitud entre −90 y 90 y una longitud entre −180 y 180.';
    state.openWeatherLoading=false; state.openWeatherError=null;
    showAstronomyError(new Error(message));
    if(Number.isFinite(lat) && lat>=-90 && lat<=90 && Number.isFinite(lon) && lon>=-180 && lon<=180) { state.lat=lat; state.lon=lon; state.name=nameValue; loadLightPollution(false); }
    else {state.lightPollutionLoading=false;state.lightPollutionError='Introduce coordenadas válidas para consultar el atlas.';renderLightPollutionCard();}
    return;
  }
  state.date=dateValue; state.name=nameValue; state.lat=lat; state.lon=lon;
  state.openWeather=null; state.openWeatherLoading=true; state.openWeatherError=null;
  $('astro-status').textContent='Calculando Luna, Vía Láctea y eventos…';
  document.querySelector('.astro-content')?.setAttribute('aria-busy','true');
  ['moon-info','milky-way-info','lunar-calendar','astro-events'].forEach(id=>$(id)?.setAttribute('aria-busy','true'));
  loadLightPollution(Boolean(options.forceLightPollution));

  // Render local SunCalc calculations immediately; do not make the astronomy page
  // wait for a remote weather service before showing Moon and event information.
  let astronomyCalculationError=null;
  try { render(); }
  catch(error) { astronomyCalculationError=error; showAstronomyError(error); }
  if(requestId!==astronomyRequestId) return;

  try {
    const forecast=await getOpenWeatherForecast(lat,lon,{force:Boolean(options.forceOpenWeather)});
    if(requestId!==astronomyRequestId) return;
    state.openWeather=forecast; state.openWeatherError=null;
  } catch(error) {
    if(requestId!==astronomyRequestId) return;
    state.openWeather=null; state.openWeatherError=friendlyOpenWeatherError(error);
  } finally {
    if(requestId===astronomyRequestId) state.openWeatherLoading=false;
  }
  if(requestId!==astronomyRequestId) return;
  try { render(); }
  catch(error) { astronomyCalculationError=error; showAstronomyError(error); }
  document.body.classList.remove('app-starting');
  if(astronomyCalculationError) $('astro-status').textContent=`Cálculos astronómicos no disponibles: ${astronomyCalculationError.message}`;
  else if(!state.openWeatherError) $('astro-status').textContent=`Actualizado · ${state.name} · ${state.date}`;
  else $('astro-status').textContent='Astronomía calculada · previsión meteorológica no disponible';
}

$('astro-update').addEventListener('click',()=>renderAll({forceOpenWeather:true,forceLightPollution:true}));
$('astro-date').addEventListener('change',()=>renderAll());
['astro-location','astro-lat','astro-lon'].forEach(id=>$(id).addEventListener('change',()=>renderAll()));
$('astro-date').value=state.date;$('astro-location').value=state.name;$('astro-lat').value=state.lat;$('astro-lon').value=state.lon;
try {
const pollutionMap=initLightPollutionMap({
  latitude: state.lat,
  longitude: state.lon,
  name: state.name,
  usePoint: async ({ latitude, longitude, data }) => {
    state.lat = Number(latitude);
    state.lon = Number(longitude);
    state.name = `Punto del atlas (${state.lat.toFixed(3)}, ${state.lon.toFixed(3)})`;
    state.lightPollution = data || null;
    saveNavigationContext({ latitude: state.lat, longitude: state.lon, name: state.name, date: state.date, mode: state.mode });
    $('astro-location').value = state.name;
    $('astro-lat').value = state.lat;
    $('astro-lon').value = state.lon;
    updateLightPollutionMap(state.lat, state.lon, state.name, state.lightPollution, { pan: true });
    await renderAll();
  }
});
if(!pollutionMap && !window.L){const mapHost=$('lp-atlas-map');if(mapHost)mapHost.innerHTML='<div class="component-error" role="alert">El mapa del atlas no se ha podido cargar porque Leaflet no está disponible. Comprueba la conexión y recarga la página.</div>'; }
} catch(error) {
  const map = $('lp-atlas-map'); if(map) map.innerHTML = `<div class="component-error">No se pudo iniciar el mapa del atlas. Comprueba la conexión a Leaflet. ${escapeHtml(error.message)}</div>`;
}
renderAll();
