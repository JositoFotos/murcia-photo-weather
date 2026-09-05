const NETLIFY_FUNCTION_URL = 'https://murcia-photo-weather.netlify.app/.netlify/functions/radar';
const RADAR_CENTER = [38.17924102, -1.12301552]; // Radar regional Murcia–Fortuna
const MURCIA_CENTER = [37.99224, -1.13065];
const MURCIA_ZOOM = 9;
const RADAR_RADIUS_KM = 240;

function kmToLat(km) { return km / 111.32; }
function kmToLon(km, lat) { return km / (111.32 * Math.cos(lat * Math.PI / 180)); }

function getFunctionUrl() {
  const sameOrigin = `${location.origin}/.netlify/functions/radar`;
  // When the page is served by Netlify, use its same-origin Function.
  if (location.hostname.endsWith('.netlify.app') || location.hostname === 'netlify.app') {
    return sameOrigin;
  }
  // GitHub Pages and local static hosting use the public Netlify Function.
  return NETLIFY_FUNCTION_URL;
}

function formatUtc(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/D';
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short'
  }).format(date) + ' UTC';
}

function setStatus(text, state = 'idle') {
  const el = document.getElementById('radar-status');
  if (!el) return;
  el.textContent = text;
  el.dataset.state = state;
}

function getContextFromUrl() {
  const params = new URLSearchParams(location.search);
  const lat = Number(params.get('lat'));
  const lon = Number(params.get('lon'));
  const name = params.get('name');
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon, name } : null;
}

function getRadarBounds() {
  const [lat, lon] = RADAR_CENTER;
  const dLat = kmToLat(RADAR_RADIUS_KM);
  const dLon = kmToLon(RADAR_RADIUS_KM, lat);
  return [[lat - dLat, lon - dLon], [lat + dLat, lon + dLon]];
}

async function resolveRadarImageUrl() {
  const endpoint = getFunctionUrl();
  let response;
  try {
    response = await fetch(`${endpoint}?radar=mu&t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      mode: 'cors',
      headers: { Accept: 'application/json' }
    });
  } catch (error) {
    throw new Error(`No se puede acceder al servicio de radar (${endpoint}). Comprueba que Netlify haya desplegado la Function radar.`);
  }

  const contentType = response.headers.get('content-type') || '';
  const bodyText = await response.text();
  let data = null;
  try { data = JSON.parse(bodyText); } catch {}

  if (!response.ok) {
    const detail = data?.error || data?.descripcion || `HTTP ${response.status}`;
    throw new Error(`Radar AEMET: ${detail}`);
  }
  if (!contentType.includes('application/json') || !data) {
    throw new Error('La Function de radar no devolvió JSON válido. Comprueba el despliegue de Netlify.');
  }

  const imageUrl = data.imageUrl || data.datos;
  if (!imageUrl || typeof imageUrl !== 'string') {
    throw new Error(data?.error || 'AEMET no devolvió una URL de imagen de radar.');
  }
  return { ...data, imageUrl, endpoint };
}

async function loadRadar(map, layer, marker) {
  setStatus('Actualizando radar…', 'loading');
  const data = await resolveRadarImageUrl();
  layer.setUrl(data.imageUrl).setBounds(getRadarBounds()).addTo(map);
  document.getElementById('radar-updated').textContent = formatUtc(data.fetchedAt || Date.now());
  setStatus('Radar actualizado', 'success');
  const context = getContextFromUrl();
  if (context && marker) {
    marker.setLatLng([context.lat, context.lon]);
    marker.bindPopup(`<strong>${escapeHtml(context.name || 'Localización seleccionada')}</strong><br>${context.lat.toFixed(5)}, ${context.lon.toFixed(5)}`);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function init() {
  const map = L.map('radar-map', { zoomControl: true, fullscreenControl: true }).setView(MURCIA_CENTER, MURCIA_ZOOM);
  const base = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  if (L.Control.Fullscreen) new L.Control.Fullscreen().addTo(map);

  const layer = L.imageOverlay('', getRadarBounds(), {
    opacity: 0.75,
    interactive: false
  });

  const context = getContextFromUrl();
  let marker = context ? L.marker([context.lat, context.lon]).addTo(map) : null;
  if (marker) marker.bindPopup(`<strong>${escapeHtml(context.name || 'Localización seleccionada')}</strong><br>${context.lat.toFixed(5)}, ${context.lon.toFixed(5)}`);

  L.control.layers({ OpenStreetMap: base }, { 'Radar AEMET': layer }, { collapsed: false }).addTo(map);

  document.getElementById('radar-refresh').addEventListener('click', () => {
    loadRadar(map, layer, marker).catch(error => setStatus(error.message, 'error'));
  });
  document.getElementById('radar-center').addEventListener('click', () => map.setView(MURCIA_CENTER, MURCIA_ZOOM));

  if (context) map.setView([context.lat, context.lon], 9);
  else map.setView(MURCIA_CENTER, MURCIA_ZOOM);

  // Force Leaflet to recalculate its layout after the page has painted.
  setTimeout(() => map.invalidateSize(), 0);
  loadRadar(map, layer, marker).catch(error => setStatus(error.message, 'error'));
}

document.addEventListener('DOMContentLoaded', init);
