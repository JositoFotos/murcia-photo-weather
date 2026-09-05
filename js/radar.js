import { CONFIG } from './config.js';
import { getOpenWeatherForecast, getOpenWeatherForDate } from './openweather.js';

const NETLIFY_RADAR_FUNCTION = 'https://murcia-photo-weather.netlify.app/.netlify/functions/radar';
const MURCIA_CENTER = [37.99224, -1.13065];
const MURCIA_ZOOM = 9;
const RADAR_CENTER = [38.17924102, -1.12301552];
const RADAR_RADIUS_KM = 240;
const MAX_FRAMES = 6;
const OBSERVED_REFRESH_MS = 5 * 60 * 1000;
const FRAME_RETENTION_MS = 4 * 60 * 1000;

const state = {
  mode: 'observed',
  observedFrames: [],
  observedIndex: 0,
  observedTimer: null,
  playing: false,
  forecastPoints: [],
  forecastIndex: 0,
  forecastMarker: null,
  forecastCircle: null,
  location: null
};

function kmToLat(km) { return km / 111.32; }
function kmToLon(km, lat) { return km / (111.32 * Math.cos(lat * Math.PI / 180)); }
function getRadarBounds() {
  const [lat, lon] = RADAR_CENTER;
  const dLat = kmToLat(RADAR_RADIUS_KM);
  const dLon = kmToLon(RADAR_RADIUS_KM, lat);
  return [[lat - dLat, lon - dLon], [lat + dLat, lon + dLon]];
}
function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[ch]));
}
function setStatus(text, stateName = 'idle') {
  const el = document.getElementById('radar-status');
  if (el) { el.textContent = text; el.dataset.state = stateName; }
}
function formatLocalHour(timestamp) {
  if (!Number.isFinite(timestamp)) return 'N/D';
  return new Intl.DateTimeFormat('es-ES', { timeZone: CONFIG.DEFAULT_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(timestamp));
}
function formatLocalDateTime(timestamp) {
  if (!Number.isFinite(timestamp)) return 'N/D';
  return new Intl.DateTimeFormat('es-ES', { timeZone: CONFIG.DEFAULT_TIME_ZONE, dateStyle: 'short', timeStyle: 'short' }).format(new Date(timestamp));
}
function getContextFromUrl() {
  const p = new URLSearchParams(location.search);
  const lat = Number(p.get('lat'));
  const lon = Number(p.get('lon'));
  const name = p.get('name');
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon, name } : null;
}
function radarFunctionUrl() {
  if (location.hostname.endsWith('.netlify.app') || location.hostname === 'netlify.app') return `${location.origin}/.netlify/functions/radar`;
  return NETLIFY_RADAR_FUNCTION;
}
async function resolveRadarImageUrl() {
  const endpoint = `${radarFunctionUrl()}?radar=mu&t=${Date.now()}`;
  let response;
  try { response = await fetch(endpoint, { headers: { Accept: 'application/json' }, cache: 'no-store' }); }
  catch { throw new Error('No se puede acceder al servicio de radar de Netlify.'); }
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* handled below */ }
  if (!response.ok) throw new Error(data?.error || `Radar AEMET: HTTP ${response.status}`);
  if (!data) throw new Error('La Function de radar no devolvió JSON válido.');
  const imageUrl = data.imageUrl || data.datos;
  if (!imageUrl) throw new Error('AEMET no devolvió una URL de imagen de radar.');
  return { imageUrl, fetchedAt: Date.now() };
}
function renderObservedFrame(map, overlay, frame) {
  overlay.setUrl(frame.imageUrl).setBounds(getRadarBounds());
  overlay.addTo(map);
  document.getElementById('radar-time').textContent = frame.capturedAt ? formatLocalDateTime(frame.capturedAt) : 'Actual';
  document.getElementById('radar-updated').textContent = frame.capturedAt ? formatLocalDateTime(frame.capturedAt) : 'N/D';
}
function refreshObservedControls() {
  const range = document.getElementById('radar-range');
  const count = state.observedFrames.length;
  range.max = String(Math.max(0, count - 1));
  range.value = String(state.observedIndex);
  document.getElementById('radar-frame-count').textContent = String(count);
  document.getElementById('radar-prev').disabled = count < 2;
  document.getElementById('radar-next').disabled = count < 2;
}
function addObservedFrame(frame) {
  const last = state.observedFrames[state.observedFrames.length - 1];
  if (last && last.imageUrl === frame.imageUrl) return false;
  const cutoff = Date.now() - FRAME_RETENTION_MS;
  state.observedFrames = [...state.observedFrames.filter(f => f.capturedAt >= cutoff), frame].slice(-MAX_FRAMES);
  state.observedIndex = state.observedFrames.length - 1;
  refreshObservedControls();
  return true;
}
async function updateObserved(map, overlay) {
  setStatus('Actualizando radar…', 'loading');
  const frame = await resolveRadarImageUrl();
  addObservedFrame(frame);
  renderObservedFrame(map, overlay, state.observedFrames[state.observedIndex]);
  setStatus('Radar actualizado', 'success');
}
function startObservedTimer(map, overlay) {
  clearInterval(state.observedTimer);
  state.observedTimer = setInterval(() => updateObserved(map, overlay).catch(err => setStatus(err.message, 'error')), OBSERVED_REFRESH_MS);
}
function setObservedIndex(map, overlay, index) {
  if (!state.observedFrames.length) return;
  state.observedIndex = Math.max(0, Math.min(index, state.observedFrames.length - 1));
  refreshObservedControls();
  renderObservedFrame(map, overlay, state.observedFrames[state.observedIndex]);
}
async function loadForecast(context) {
  setStatus('Cargando previsión…', 'loading');
  const lat = context?.lat ?? MURCIA_CENTER[0];
  const lon = context?.lon ?? MURCIA_CENTER[1];
  const date = context?.date ?? null;
  const raw = await getOpenWeatherForecast(lat, lon, { force: false });
  let points = raw.points ?? [];
  if (date) points = getOpenWeatherForDate(raw, date);
  if (!points.length) points = raw.points?.slice(0, 8) ?? [];
  state.forecastPoints = points.slice(0, 8);
  state.forecastIndex = 0;
  refreshForecastControls();
  setStatus('Previsión cargada', 'success');
}
function refreshForecastControls() {
  const range = document.getElementById('forecast-range');
  const count = state.forecastPoints.length;
  range.max = String(Math.max(0, count - 1));
  range.value = String(state.forecastIndex);
  document.getElementById('forecast-prev').disabled = count < 2;
  document.getElementById('forecast-next').disabled = count < 2;
}
function renderForecast(map) {
  const point = state.forecastPoints[state.forecastIndex];
  const overlay = document.getElementById('forecast-overlay');
  if (!point) {
    overlay.hidden = false;
    overlay.innerHTML = `<div class="forecast-panel"><strong>No hay previsión disponible para este tramo.</strong></div>`;
    document.getElementById('forecast-time').textContent = 'N/D';
    return;
  }
  const context = state.location;
  const lat = context?.lat ?? MURCIA_CENTER[0];
  const lon = context?.lon ?? MURCIA_CENTER[1];
  if (!state.forecastMarker) state.forecastMarker = L.circleMarker([lat, lon], { radius: 8, color: '#6ea8ff', weight: 2, fillOpacity: .9 }).addTo(map);
  else state.forecastMarker.setLatLng([lat, lon]);
  const rain = Number.isFinite(point.precipitationProbability) ? Math.round(point.precipitationProbability) : null;
  const cloud = Number.isFinite(point.cloudiness) ? Math.round(point.cloudiness) : null;
  const visibility = Number.isFinite(point.visibility) ? `${point.visibility.toFixed(1)} km` : 'N/D';
  const wind = Number.isFinite(point.wind?.speed) ? `${point.wind.speed.toFixed(0)} km/h` : 'N/D';
  const temp = Number.isFinite(point.temperature) ? `${point.temperature.toFixed(0)} °C` : 'N/D';
  const gust = Number.isFinite(point.wind?.gust) ? `${point.wind.gust.toFixed(0)} km/h` : 'N/D';
  const hour = Number.isFinite(point.timestamp) ? formatLocalHour(point.timestamp) : (Number.isFinite(point.hour) ? `${String(point.hour).padStart(2,'0')} h` : 'N/D');
  document.getElementById('forecast-time').textContent = hour;
  document.getElementById('forecast-main').textContent = temp;
  document.getElementById('forecast-description').textContent = point.weather?.description ?? 'N/D';
  overlay.innerHTML = `<div class="forecast-panel">
    <div class="forecast-title"><strong>☁️ Previsión ${escapeHtml(hour)}</strong><span>${escapeHtml(context?.name || 'Murcia')}</span></div>
    <div class="forecast-grid">
      <div class="highlight"><span>Nubosidad</span><strong>${cloud === null ? 'N/D' : `${cloud} %`}</strong></div>
      <div><span>Prob. lluvia</span><strong>${rain === null ? 'N/D' : `${rain} %`}</strong></div>
      <div><span>Lluvia</span><strong>${Number.isFinite(point.rain3h) ? `${point.rain3h.toFixed(1)} mm` : 'N/D'}</strong></div>
      <div><span>Visibilidad</span><strong>${visibility}</strong></div>
      <div><span>Viento</span><strong>${wind}</strong></div>
      <div><span>Racha</span><strong>${gust}</strong></div>
    </div>
  </div>`;
  overlay.hidden = false;
}
function switchMode(mode, map, overlay) {
  state.mode = mode;
  const observed = mode === 'observed';
  document.getElementById('mode-observed').classList.toggle('active', observed);
  document.getElementById('mode-observed').setAttribute('aria-selected', String(observed));
  document.getElementById('mode-forecast').classList.toggle('active', !observed);
  document.getElementById('mode-forecast').setAttribute('aria-selected', String(!observed));
  document.getElementById('radar-controls-observed').hidden = !observed;
  document.getElementById('radar-controls-forecast').hidden = observed;
  if (state.forecastMarker) state.forecastMarker.setStyle({ opacity: observed ? 0 : 1, fillOpacity: observed ? 0 : .9 });
  if (overlay) overlay.hidden = observed;
  if (observed) {
    if (state.observedFrames[state.observedIndex]) renderObservedFrame(map, overlay, state.observedFrames[state.observedIndex]);
    setStatus('Radar AEMET', 'success');
  } else {
    renderForecast(map);
  }
}
function setupNavigation(map, overlay) {
  document.getElementById('mode-observed').addEventListener('click', () => switchMode('observed', map, overlay));
  document.getElementById('mode-forecast').addEventListener('click', async () => {
    switchMode('forecast', map, overlay);
    try { if (!state.forecastPoints.length) await loadForecast(state.location); renderForecast(map); }
    catch (error) { setStatus(error.message, 'error'); }
  });
  document.getElementById('radar-range').addEventListener('input', e => setObservedIndex(map, overlay, Number(e.target.value)));
  document.getElementById('radar-prev').addEventListener('click', () => setObservedIndex(map, overlay, state.observedIndex - 1));
  document.getElementById('radar-next').addEventListener('click', () => setObservedIndex(map, overlay, state.observedIndex + 1));
  document.getElementById('radar-play').addEventListener('click', () => {
    state.playing = !state.playing;
    document.getElementById('radar-play').textContent = state.playing ? '⏸ Pausar' : '▶ Animar';
    if (state.playing && state.observedFrames.length > 1) {
      const timer = setInterval(() => {
        if (!state.playing || state.mode !== 'observed') { clearInterval(timer); return; }
        setObservedIndex(map, overlay, (state.observedIndex + 1) % state.observedFrames.length);
      }, 900);
    }
  });
  document.getElementById('forecast-range').addEventListener('input', e => { state.forecastIndex = Number(e.target.value); renderForecast(map); });
  document.getElementById('forecast-prev').addEventListener('click', () => { state.forecastIndex = Math.max(0, state.forecastIndex - 1); refreshForecastControls(); renderForecast(map); });
  document.getElementById('forecast-next').addEventListener('click', () => { state.forecastIndex = Math.min(state.forecastPoints.length - 1, state.forecastIndex + 1); refreshForecastControls(); renderForecast(map); });
  document.getElementById('radar-refresh').addEventListener('click', async () => {
    try {
      if (state.mode === 'observed') await updateObserved(map, overlay);
      else { await loadForecast(state.location); renderForecast(map); }
    } catch (error) { setStatus(error.message, 'error'); }
  });
  document.getElementById('radar-center').addEventListener('click', () => map.setView(MURCIA_CENTER, MURCIA_ZOOM));
}
async function init() {
  state.location = getContextFromUrl();
  const map = L.map('radar-map', { zoomControl: true, fullscreenControl: true }).setView(state.location ? [state.location.lat, state.location.lon] : MURCIA_CENTER, state.location ? 9 : MURCIA_ZOOM);
  const base = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
  if (L.Control.Fullscreen) new L.Control.Fullscreen().addTo(map);
  const overlay = L.imageOverlay('', getRadarBounds(), { opacity: .75, interactive: false });
  const contextMarker = state.location ? L.marker([state.location.lat, state.location.lon]).addTo(map) : null;
  if (contextMarker) contextMarker.bindPopup(`<strong>${escapeHtml(state.location.name || 'Localización seleccionada')}</strong>`);
  L.control.layers({ OpenStreetMap: base }, { 'Radar AEMET': overlay }, { collapsed: false }).addTo(map);
  setupNavigation(map, overlay);
  try {
    await updateObserved(map, overlay);
    startObservedTimer(map, overlay);
    await loadForecast(state.location);
  } catch (error) {
    setStatus(error.message, 'error');
  }
  setTimeout(() => map.invalidateSize(), 0);
}

document.addEventListener('DOMContentLoaded', init);
