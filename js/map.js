import { CONFIG } from './config.js';

let map;
let selectedMarker;
let photoLayer;
let opportunityLayer;
let externalLayers = {};
let controls;

export function initMap(onSelect) {
  map = L.map('map', { zoomControl: true, fullscreenControl: true }).setView(CONFIG.DEFAULT_MAP_CENTER, CONFIG.DEFAULT_ZOOM);
  const base = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
  photoLayer = L.layerGroup().addTo(map);
  opportunityLayer = L.layerGroup().addTo(map);
  if (L.Control.Fullscreen) new L.Control.Fullscreen().addTo(map);
  map.on('click', e => onSelect({ latitude:e.latlng.lat, longitude:e.latlng.lng }));
  setupExternalLayers();
  controls = L.control.layers({ OpenStreetMap:base }, { Fotografías:photoLayer, Oportunidades:opportunityLayer, ...externalLayers }, { collapsed:false }).addTo(map);
  return map;
}

function setupExternalLayers() {
  if (!CONFIG.OPENWEATHER_API_KEY) return;
  for (const [key,label] of Object.entries({ precipitation:'Precipitación', clouds:'Nubosidad', temperature:'Temperatura', wind:'Viento' })) {
    const layerName = CONFIG.MAP_LAYERS[key];
    externalLayers[label] = L.tileLayer(`https://tile.openweathermap.org/map/${layerName}/{z}/{x}/{y}.png?appid=${encodeURIComponent(CONFIG.OPENWEATHER_API_KEY)}`, { opacity:0.55, attribution:'&copy; OpenWeather' });
  }
}

export function setLocation(lat, lon, { draggable=true, label='' }={}) {
  if (!map) return;
  map.setView([lat,lon], Math.max(map.getZoom(), 10));
  if (selectedMarker) selectedMarker.remove();
  selectedMarker = L.marker([lat,lon], { draggable }).addTo(map).bindPopup(label || `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
  selectedMarker.on('dragend', () => { const p = selectedMarker.getLatLng(); window.dispatchEvent(new CustomEvent('mpwp:map-location', { detail:{ latitude:p.lat, longitude:p.lng } })); });
}

export function renderPhotoLocations(locations, scoreLookup=new Map()) {
  photoLayer.clearLayers();
  locations.forEach(location => {
    const score = scoreLookup.get(location.id);
    const color = Number.isFinite(score) ? (score>=80?'#31c48d':score>=65?'#4da3ff':score>=50?'#eab308':score>=30?'#f97316':'#ef4444') : '#94a3b8';
    L.circleMarker([location.latitude, location.longitude], { radius:8, color, fillColor:color, fillOpacity:.8, weight:2 })
      .bindTooltip(`${location.name}${Number.isFinite(score) ? ` · ${score}/100` : ''}`)
      .addTo(photoLayer);
  });
}

export function renderOpportunities(items, onClick) {
  opportunityLayer.clearLayers();
  items.forEach(item => {
    const c = item.score>=80?'#31c48d':item.score>=65?'#4da3ff':item.score>=50?'#eab308':item.score>=30?'#f97316':'#ef4444';
    L.circleMarker([item.location.latitude,item.location.longitude], { radius:10, color:c, fillColor:c, fillOpacity:.9, weight:2 })
      .bindPopup(`<strong>${item.location.name}</strong><br>${item.score}/100<br><button data-location-id="${item.location.id}" class="map-details">Ver detalles</button>`)
      .on('popupopen', () => document.querySelector(`[data-location-id="${item.location.id}"]`)?.addEventListener('click', () => onClick(item)))
      .addTo(opportunityLayer);
  });
}

export function fitMurcia() { map?.fitBounds([[37.38,-2.05],[38.75,-0.55]], { padding:[20,20] }); }
export function getMap() { return map; }
