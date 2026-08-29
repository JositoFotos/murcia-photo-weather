const HISTORY_KEY = 'mpwp_history_v1';
const FAVORITES_KEY = 'mpwp_favorites_v1';
const CACHE_PREFIX = 'mpwp_cache_v1_';

function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback)); } catch { return fallback; } }
function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

export function saveHistory(entry) {
  const history = readJson(HISTORY_KEY, []);
  history.unshift({ ...entry, timestamp: new Date().toISOString() });
  writeJson(HISTORY_KEY, history.slice(0, 50));
}
export function loadHistory() { return readJson(HISTORY_KEY, []); }
export function deleteHistory(index) { const h = loadHistory(); h.splice(index,1); writeJson(HISTORY_KEY,h); }
export function clearHistory() { localStorage.removeItem(HISTORY_KEY); }

export function saveFavorite(favorite) {
  const all = loadFavorites();
  const id = favorite.id ?? crypto.randomUUID();
  const next = { ...favorite, id, updatedAt: new Date().toISOString() };
  const idx = all.findIndex(x => x.id === id);
  if (idx >= 0) all[idx] = next; else all.unshift(next);
  writeJson(FAVORITES_KEY, all);
  return next;
}
export function loadFavorites() { return readJson(FAVORITES_KEY, []); }
export function deleteFavorite(id) { writeJson(FAVORITES_KEY, loadFavorites().filter(x => x.id !== id)); }

export function cacheKey(municipalityId) { return `${CACHE_PREFIX}${municipalityId}`; }
export function saveWeatherCache(municipalityId, data) { writeJson(cacheKey(municipalityId), { timestamp: Date.now(), data }); }
export function loadWeatherCache(municipalityId, maxAgeMs) {
  const item = readJson(cacheKey(municipalityId), null);
  if (!item || Date.now() - item.timestamp > maxAgeMs) return null;
  return item.data;
}
export function clearCache() { Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX)).forEach(k => localStorage.removeItem(k)); }
