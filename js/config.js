export const CONFIG = {
  // Sustituye MI_API_KEY por tu clave real de AEMET OpenData.
  AEMET_API_KEY: '',
  // Public deployment: Netlify Function keeps the real AEMET key server-side.
  AEMET_PROXY_URL: 'https://murcia-photo-weather.netlify.app/.netlify/functions/aemet',
  AEMET_BASE_URL: 'https://opendata.aemet.es/opendata/api',
  CACHE_DURATION: 15 * 60 * 1000,
  DEFAULT_MAP_CENTER: [37.75, -1.15],
  DEFAULT_ZOOM: 9,
  DEFAULT_TIME_ZONE: 'Europe/Madrid',
  // La clave se guarda como secreto OPENWEATHER_API en Netlify; nunca se publica aquí.
  OPENWEATHER_PROXY_URL: 'https://murcia-photo-weather.netlify.app/.netlify/functions/openweather',
  MAP_LAYERS: {
    precipitation: 'precipitation_new',
    clouds: 'clouds_new',
    temperature: 'temp_new',
    wind: 'wind_new'
  },
  PHOTOGRAPHY_SCORE_WEIGHTS: {
    general: { rain: 0.18, rainProbability: 0.14, lowCloud: 0.09, midCloud: 0.08, highCloud: 0.10, storms: 0.15, wind: 0.08, temperature: 0.04, humidity: 0.04, visibility: 0.10 },
    landscape: { rain: 0.18, rainProbability: 0.12, lowCloud: 0.08, midCloud: 0.10, highCloud: 0.12, storms: 0.14, wind: 0.07, temperature: 0.05, humidity: 0.03, visibility: 0.11 },
    sunriseSunset: { rain: 0.18, rainProbability: 0.12, lowCloud: 0.07, midCloud: 0.13, highCloud: 0.16, storms: 0.12, wind: 0.06, temperature: 0.04, humidity: 0.03, visibility: 0.09 },
    coast: { rain: 0.19, rainProbability: 0.12, lowCloud: 0.07, midCloud: 0.09, highCloud: 0.12, storms: 0.15, wind: 0.08, temperature: 0.05, humidity: 0.03, visibility: 0.10 },
    nature: { rain: 0.18, rainProbability: 0.12, lowCloud: 0.09, midCloud: 0.10, highCloud: 0.10, storms: 0.15, wind: 0.07, temperature: 0.05, humidity: 0.05, visibility: 0.09 },
    architecture: { rain: 0.20, rainProbability: 0.13, lowCloud: 0.08, midCloud: 0.08, highCloud: 0.10, storms: 0.16, wind: 0.08, temperature: 0.04, humidity: 0.03, visibility: 0.10 },
    nocturnal: { rain: 0.22, rainProbability: 0.14, lowCloud: 0.08, midCloud: 0.07, highCloud: 0.04, storms: 0.16, wind: 0.07, temperature: 0.06, humidity: 0.06, visibility: 0.10 }
  },
  PHOTO_MODES: {
    landscape: { label: 'Paisaje', icon: '📷', weightSet: 'landscape' },
    sunriseSunset: { label: 'Amanecer / Atardecer', icon: '🌅', weightSet: 'sunriseSunset' },
    coast: { label: 'Costa', icon: '🌊', weightSet: 'coast' },
    nature: { label: 'Naturaleza', icon: '🌿', weightSet: 'nature' },
    architecture: { label: 'Arquitectura', icon: '🏛', weightSet: 'architecture' },
    nocturnal: { label: 'Nocturna', icon: '🌌', weightSet: 'nocturnal' }
  }
};
