import { getLightPollution } from './light-pollution.js';

const ATLAS_TILES = 'https://djlorenz.github.io/astronomy/image_tiles/tiles2025/tile_{z}_{x}_{y}.png';
const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
let map = null;
let currentMarker = null;
let candidateMarker = null;
let onUsePoint = null;
let selected = { latitude: 37.983, longitude: -1.129, name: 'Murcia', data: null };
let clickRequestId = 0;

function $(id) { return document.getElementById(id); }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function fmt(value, digits = 2) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('es-ES', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : 'N/D';
}
function impactCopy(data) {
  const ratio = Number(data?.lpIndex);
  if (!Number.isFinite(ratio)) return 'No hay una estimación válida para este punto.';
  if (ratio < 0.11) return 'Muy poca contribución artificial estimada: favorable para conservar el contraste de estrellas débiles.';
  if (ratio < 0.33) return 'Baja influencia artificial estimada: buena zona para probar fotografía de estrellas y Vía Láctea.';
  if (ratio < 1) return 'La luz artificial puede empezar a levantar el fondo del cielo y reducir algo el contraste de las estructuras tenues.';
  if (ratio < 3) return 'La contribución artificial supera la referencia natural; es posible fotografiar estrellas, pero las estructuras débiles pueden perder contraste.';
  return 'Alta influencia artificial estimada: el fondo del cielo puede resultar luminoso y dificultar los detalles débiles de la Vía Láctea.';
}
function distanceKm(aLat, aLon, bLat, bLon) {
  const toRad = degrees => degrees * Math.PI / 180;
  const dLat = toRad(bLat - aLat), dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function initLightPollutionMap({ latitude, longitude, name = 'Localización seleccionada', usePoint } = {}) {
  const container = $('lp-atlas-map');
  if (!container || !window.L) {
    const info = $('lp-map-point-info');
    if (info) info.innerHTML = '<span class="lp-map-hint">No se ha podido inicializar el mapa. Comprueba la conexión y vuelve a cargar la página.</span>';
    return null;
  }
  if (map) return map;
  const lat = Number.isFinite(Number(latitude)) ? Number(latitude) : 37.983;
  const lon = Number.isFinite(Number(longitude)) ? Number(longitude) : -1.129;
  selected = { latitude: lat, longitude: lon, name, data: null };
  onUsePoint = typeof usePoint === 'function' ? usePoint : null;

  map = window.L.map(container, { zoomControl: true, preferCanvas: true }).setView([lat, lon], 8);
  const osm = window.L.tileLayer(OSM_TILES, {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
  }).addTo(map);
  const atlas = window.L.tileLayer(ATLAS_TILES, {
    minZoom: 2,
    maxNativeZoom: 8,
    maxZoom: 19,
    tileSize: 1024,
    zoomOffset: -2,
    opacity: 0.62,
    errorTileUrl: 'https://djlorenz.github.io/astronomy/image_tiles/tiles2025/black.png',
    attribution: '<a href="https://djlorenz.github.io/astronomy/lp/" target="_blank" rel="noopener noreferrer">World Atlas of Artificial Night Sky Brightness 2025 · David Lorenz</a>'
  }).addTo(map);
  window.L.control.layers({ 'OpenStreetMap': osm }, { 'Contaminación lumínica · Atlas 2025': atlas }, { collapsed: true }).addTo(map);
  window.L.control.scale({ imperial: false, maxWidth: 120 }).addTo(map);

  currentMarker = window.L.circleMarker([lat, lon], {
    radius: 8, color: '#0b1220', weight: 3, fillColor: '#F59E0B', fillOpacity: 1
  }).addTo(map).bindPopup(`<strong>${escapeHtml(name)}</strong><br>Ubicación actual`);

  const legend = window.L.control({ position: 'bottomright' });
  legend.onAdd = () => {
    const div = window.L.DomUtil.create('div', 'lp-atlas-map-mini-legend');
    div.innerHTML = '<strong>Atlas 2025</strong><span><i class="lp-zone-dark"></i> Más oscuro</span><span><i class="lp-zone-orange"></i> Más iluminado</span>';
    window.L.DomEvent.disableClickPropagation(div);
    return div;
  };
  legend.addTo(map);

  map.on('click', event => inspectPoint(event.latlng.lat, event.latlng.lng));
  $('lp-map-center')?.addEventListener('click', () => {
    map.setView([selected.latitude, selected.longitude], Math.max(map.getZoom(), 8), { animate: true });
    currentMarker?.openPopup();
  });
  // Some browsers calculate the map before the card's final layout is painted.
  requestAnimationFrame(() => map?.invalidateSize());
  return map;
}

export function updateLightPollutionMap(latitude, longitude, name = 'Localización seleccionada', data = null, { pan = true } = {}) {
  const lat = Number(latitude), lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  const moved = Math.abs(lat - selected.latitude) > 0.00001 || Math.abs(lon - selected.longitude) > 0.00001;
  selected = { latitude: lat, longitude: lon, name: name || 'Localización seleccionada', data: data || (moved ? null : selected.data) };
  if (!map || !window.L) return;
  if (candidateMarker && Math.abs(candidateMarker.getLatLng().lat - lat) < 0.00001 && Math.abs(candidateMarker.getLatLng().lng - lon) < 0.00001) {
    candidateMarker.remove();
    candidateMarker = null;
  }
  if (!currentMarker) {
    currentMarker = window.L.circleMarker([lat, lon], { radius: 8, color: '#0b1220', weight: 3, fillColor: '#F59E0B', fillOpacity: 1 }).addTo(map);
  } else currentMarker.setLatLng([lat, lon]);
  currentMarker.bindPopup(`<strong>${escapeHtml(selected.name)}</strong><br>${selected.data ? `Zona ${escapeHtml(selected.data.lpZone)} · LP ${fmt(selected.data.lpIndex, 2)}×` : 'Ubicación actual'}`);
  if (pan && moved) map.panTo([lat, lon], { animate: true });
  if (!selected.data) {
    const info = $('lp-map-point-info');
    if (info && !candidateMarker) info.innerHTML = '<span class="lp-map-hint">Haz clic sobre otra zona para comparar su oscuridad estimada.</span>';
  }
}

async function inspectPoint(latitude, longitude) {
  if (!map) return;
  const requestId = ++clickRequestId;
  const lat = Number(latitude), lon = Number(longitude);
  if (candidateMarker) candidateMarker.remove();
  candidateMarker = window.L.circleMarker([lat, lon], {
    radius: 7, color: '#06281f', weight: 2, fillColor: '#34d399', fillOpacity: 0.95
  }).addTo(map);
  candidateMarker.bindPopup('<strong>Consultando el atlas…</strong>').openPopup();
  const info = $('lp-map-point-info');
  if (info) info.innerHTML = '<div class="lp-map-query-loading"><span class="skeleton"></span><span>Consultando el punto seleccionado…</span></div>';
  try {
    const result = await getLightPollution(lat, lon);
    if (requestId !== clickRequestId) return;
    const km = distanceKm(selected.latitude, selected.longitude, lat, lon);
    const title = `Zona ${result.lpZone} · ${result.impact?.label || 'Impacto no clasificado'}`;
    const summary = impactCopy(result);
    candidateMarker.bindPopup(`<strong>${escapeHtml(title)}</strong><br>Índice LP: ${fmt(result.lpIndex, 2)}×<br><small>${fmt(km, 1)} km de la ubicación actual</small>`).openPopup();
    if (info) {
      info.innerHTML = `<div class="lp-map-candidate"><div class="lp-map-candidate-main"><span class="lp-map-candidate-kicker">Punto consultado · ${fmt(km, 1)} km</span><strong>Zona ${escapeHtml(result.lpZone)} · ${escapeHtml(result.impact?.label || 'N/D')}</strong><p>${escapeHtml(summary)}</p><small>LP ${fmt(result.lpIndex, 2)}× · ${fmt(result.mpsas, 2)} mag/arcsec²</small></div><button id="lp-map-use-point" class="primary" type="button">Usar este punto en Astronomía</button></div>`;
      $('lp-map-use-point')?.addEventListener('click', async () => {
        if (typeof onUsePoint === 'function') await onUsePoint({ latitude: lat, longitude: lon, data: result });
      });
    }
  } catch (error) {
    if (requestId !== clickRequestId) return;
    candidateMarker.bindPopup('<strong>No se pudo consultar este punto</strong><br><small>Comprueba la conexión e inténtalo de nuevo.</small>').openPopup();
    if (info) info.innerHTML = `<div class="lp-map-query-error"><strong>No se pudo consultar el punto</strong><p>${escapeHtml(error?.message || 'Error de consulta')}</p></div>`;
  }
}
