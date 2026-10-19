// Shared, lightweight location context across the static pages.
// URL parameters are authoritative; sessionStorage is a same-tab fallback when
// an internal link is opened without the expected query string.
const STORAGE_KEY = 'mpwp_navigation_context_v1';
const VALID_MODES = ['landscape', 'sunriseSunset', 'coast', 'nature', 'architecture', 'nocturnal'];

function validCoordinates(latitude, longitude) {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

function normalizeContext(value) {
  if (!value || typeof value !== 'object') return null;
  const latitude = Number(value.latitude ?? value.lat);
  const longitude = Number(value.longitude ?? value.lon);
  if (!validCoordinates(latitude, longitude)) return null;
  const date = typeof value.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.date) ? value.date : null;
  return {
    latitude,
    longitude,
    name: String(value.name || 'Ubicación seleccionada'),
    date,
    mode: VALID_MODES.includes(value.mode) ? value.mode : null,
    moment: typeof value.moment === 'string' ? value.moment : null
  };
}

export function getNavigationContextFromUrl(search = window.location.search) {
  const params = new URLSearchParams(search);
  const lat = params.get('lat');
  const lon = params.get('lon');
  // Do not coerce missing query parameters to 0, which would mean (0, 0).
  if (lat === null || lon === null || lat.trim() === '' || lon.trim() === '') return null;
  return normalizeContext({
    latitude: Number(lat),
    longitude: Number(lon),
    name: params.get('name'),
    date: params.get('date'),
    mode: params.get('mode'),
    moment: params.get('moment')
  });
}

export function getSavedNavigationContext() {
  try {
    return normalizeContext(JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null'));
  } catch {
    return null;
  }
}

export function saveNavigationContext(value) {
  const context = normalizeContext(value);
  if (!context) return false;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...context, savedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}
