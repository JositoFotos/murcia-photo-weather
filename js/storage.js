const HISTORY_KEY = 'mpwp_history_v1';
const FAVORITES_KEY = 'mpwp_favorites_v1';
const CACHE_PREFIX = 'mpwp_cache_v1_';

function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback)); } catch { return fallback; } }
function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }

export function saveHistory(entry) {
  const history = readJson(HISTORY_KEY, []);
  history.unshift({ ...entry, timestamp: new Date().toISOString() });
  writeJson(HISTORY_KEY, history.slice(0, 3));
}
export function loadHistory() { const value=readJson(HISTORY_KEY, []); return Array.isArray(value)?value:[]; }
export function deleteHistory(index) { const h = loadHistory(); h.splice(index,1); writeJson(HISTORY_KEY,h); }
export function clearHistory() { try { localStorage.removeItem(HISTORY_KEY); } catch {} }

export function saveFavorite(favorite) {
  const all = loadFavorites();
  const id = favorite.id ?? (globalThis.crypto?.randomUUID?.() || `fav-${Date.now()}-${Math.random().toString(36).slice(2,9)}`);
  const next = { ...favorite, id, updatedAt: new Date().toISOString() };
  const idx = all.findIndex(x => x.id === id);
  if (idx >= 0) all[idx] = next; else all.unshift(next);
  writeJson(FAVORITES_KEY, all);
  return next;
}
export function loadFavorites() { const value=readJson(FAVORITES_KEY, []); return Array.isArray(value)?value:[]; }
export function deleteFavorite(id) { writeJson(FAVORITES_KEY, loadFavorites().filter(x => x.id !== id)); }

export function cacheKey(municipalityId) { return `${CACHE_PREFIX}${municipalityId}`; }
export function saveWeatherCache(municipalityId, data) { writeJson(cacheKey(municipalityId), { timestamp: Date.now(), data }); }
export function loadWeatherCache(municipalityId, maxAgeMs) {
  const item = readJson(cacheKey(municipalityId), null);
  if (!item || Date.now() - item.timestamp > maxAgeMs) return null;
  return item.data;
}
export function clearCache() { try { Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX)).forEach(k => localStorage.removeItem(k)); } catch {} }
