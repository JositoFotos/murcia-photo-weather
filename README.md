# Murcia Photo Weather Planner

Aplicación web local y sin proceso de compilación para planificar sesiones fotográficas en la Región de Murcia combinando predicción oficial de AEMET, cálculo solar con SunCalc y un índice fotográfico propio.

## Despliegue público con GitHub Pages + Netlify

La versión pública puede usar GitHub Pages como interfaz y Netlify para las Functions de AEMET y OpenWeather. Las API Keys reales **no deben guardarse en GitHub**.

1. En Netlify, crea una variable de entorno de tipo secret llamada `AEMET_API_KEY` con tu clave de AEMET.
2. Netlify debe desplegar `netlify/functions/aemet.js` y `netlify/functions/openweather.js`.
3. En Netlify crea los secretos `AEMET_API_KEY` y `OPENWEATHER_API`.
4. `js/config.js` mantiene vacíos los secretos y contiene solo las URL públicas de las Functions.
5. La interfaz llama a las Functions; las Functions hablan con AEMET y OpenWeather sin exponer las claves al navegador.
6. No publiques ni pegues ninguna API Key en archivos del repositorio.

## 1. Instalación

1. Descarga o descomprime el proyecto.
2. Para uso local directo puedes introducir temporalmente una API Key en `js/config.js`. Para la publicación pública, deja `AEMET_API_KEY` vacío y utiliza la Netlify Function descrita arriba.

## 2. Cómo ejecutar

La aplicación no necesita compilación ni `npm install`. Para evitar restricciones de seguridad del navegador con módulos ES y peticiones externas, se recomienda servir la carpeta con un servidor HTTP local, por ejemplo:

```bash
python3 -m http.server 8000
```

Después abre `http://localhost:8000/`.

Abrir `index.html` directamente con `file://` puede impedir el uso de módulos ES o peticiones CORS en algunos navegadores.

## 3. AEMET OpenData

El flujo implementado en `js/aemet.js` es deliberadamente de dos pasos:

1. petición al endpoint de predicción;
2. recepción del sobre con `estado`, `descripcion` y `datos`;
3. segunda petición contra la URL de `datos`;
4. validación y normalización;
5. uso de los datos normalizados en la interfaz.

Endpoints usados:

- `/api/prediccion/especifica/municipio/diaria/{municipio}`
- `/api/prediccion/especifica/municipio/horaria/{municipio}`

La horaria se limita a las horas que AEMET facilita; no se extrapolan horas futuras como si fueran datos oficiales.

## 4. Datos meteorológicos

`js/aemet.js` conserva también `raw` para facilitar inspección. Los campos que se consumen corresponden a las estructuras de predicción municipal conocidas de AEMET (`temperatura`, `humedadRelativa`, `probPrecipitacion`, `estadoCielo`, `viento`, `rachaMax`, y en horaria `probTormenta`, `precipitacion`, `vientoAndRachaMax`, etc.). Cuando no existe un dato, la interfaz muestra `N/D`.

## 5. Índice fotográfico

El índice de `js/photography.js` es propio de la aplicación. No es un producto o predicción oficial de AEMET.

Pondera:

- lluvia y probabilidad de lluvia;
- nubosidad baja/media/alta;
- tormentas;
- viento;
- temperatura;
- humedad;
- visibilidad cuando se dispone de ese dato.

Los modos de fotografía aplican conjuntos de pesos distintos. Para amanecer/atardecer se premia una nubosidad media/alta moderada en vez de asumir que un cielo completamente despejado siempre es mejor.

## 6. Cálculo astronómico

`js/astronomy.js` utiliza SunCalc por CDN. Calcula amanecer, atardecer, hora dorada, hora azul, mediodía solar y duración del día. La pantalla fuerza el formato a `Europe/Madrid`.

SunCalc permite añadir tiempos solares personalizados mediante `addTime`; la aplicación usa ángulos aproximados de -4° y -8° para delimitar la hora azul.

## 7. Astronomía fotográfica ampliada

La pantalla de astronomía utiliza SunCalc por CDN para calcular la fase, iluminación, salida, puesta y posición de la Luna en la localización seleccionada. SunCalc documenta `getMoonIllumination()`, `getMoonTimes()` y `getMoonPosition()` para estas magnitudes.

La sección de Vía Láctea calcula una oportunidad aproximada del centro galáctico combinando su coordenada ecuatorial conocida, tiempo sidéreo local, altura sobre el horizonte, oscuridad astronómica y la iluminación lunar. No se presenta como una predicción oficial ni como una simulación de nubosidad.

Los eventos muestran salida/puesta de la Luna, fases lunares cercanas y marcadores estacionales de referencia. No se presentan eclipses ni fenómenos que SunCalc no calcule directamente.



Leaflet 1.9.4 + OpenStreetMap.

El mapa soporta:

- zoom y desplazamiento;
- pantalla completa mediante `leaflet.fullscreen`;
- clic para seleccionar coordenadas;
- marcador arrastrable;
- geolocalización;
- localizaciones fotográficas;
- mapa de oportunidades;
- leyenda de capas.

## 8. OpenWeather como fuente complementaria

La aplicación utiliza, sin One Call, el endpoint gratuito **5 Day / 3 Hour Forecast** de OpenWeather. La función `netlify/functions/openweather.js` recibe únicamente latitud y longitud, añade el secreto `OPENWEATHER_API` en servidor y devuelve la respuesta al navegador.

Se aprovechan estas variables:

- visibilidad (km), con máximo documentado de 10 km;
- nubosidad total (`clouds.all`);
- probabilidad de precipitación (`pop`);
- precipitación de las últimas 3 horas (`rain.3h`);
- velocidad y dirección del viento;
- rachas (`wind.gust`) cuando existen.

La tarjeta **OpenWeather** se presenta como información complementaria. No sustituye los datos oficiales de AEMET ni se inventan valores cuando falta una variable. El producto gratuito utilizado proporciona previsión cada 3 horas durante 5 días.

Las capas raster de Weather Maps de OpenWeather no se activan todavía en esta versión para mantener la API key fuera del cliente; se podrán añadir posteriormente mediante un proxy específico.

## 9. Meteograma

Se usa Chart.js por CDN. Se muestran, cuando AEMET los proporciona, temperatura, probabilidad de lluvia y viento por hora.

## 10. Localizaciones fotográficas

`data/photo-locations.js` contiene una colección inicial de 15 localizaciones representativas y apunta a un municipio AEMET cercano. Puedes añadir nuevas entradas sin modificar la lógica.

Formato recomendado:

```js
{
  id,
  name,
  latitude,
  longitude,
  type: ['landscape', 'coast'],
  description,
  notes,
  municipalityId
}
```

## 11. Modos fotográficos

Los modos y pesos están centralizados en `js/config.js`. Para añadir uno nuevo:

1. añade una entrada a `PHOTO_MODES`;
2. añade su conjunto de pesos a `PHOTOGRAPHY_SCORE_WEIGHTS`;
3. crea el botón correspondiente en `index.html`.

## 12. Historial, favoritos y caché

`js/storage.js` usa `localStorage`.

- Historial: máximo 50 consultas.
- Favoritos: localizaciones personalizadas.
- Caché: predicciones por municipio con caducidad configurable.

## 13. Exportación

`js/export.js` permite:

- CSV de las horas meteorológicas normalizadas;
- JSON del informe completo;
- copiar un resumen textual;
- impresión del dashboard como PDF desde el navegador.

## 14. URL compartible

La aplicación acepta:

```text
index.html?lat=37.6&lon=-0.98&date=2026-08-27
```

Al cargar, intenta usar esas coordenadas y fecha.

## 15. Estructura

```text
murcia-photo-weather/
├── index.html
├── css/styles.css
├── js/
│   ├── app.js
│   ├── config.js
│   ├── aemet.js
│   ├── weather.js
│   ├── photography.js
│   ├── astronomy.js
│   ├── map.js
│   ├── opportunities.js
│   ├── storage.js
│   ├── export.js
│   └── locations.js
├── data/
│   ├── municipalities.js
│   └── photo-locations.js
└── README.md
```

## 16. Límites deliberados

- AEMET no proporciona una predicción específica para cada punto arbitrario del mapa: la app usa el municipio como referencia meteorológica y mantiene la coordenada fotográfica por separado.
- El mapa no inventa meteorología por píxel.
- Si AEMET no entrega un campo, la aplicación muestra `N/D`.
- Los resultados del índice fotográfico no deben interpretarse como predicciones oficiales.

## Corrección de la interfaz de fechas y AEMET

La aplicación separa el selector de fecha de la carga meteorológica: el campo de fecha HTML permanece disponible aunque AEMET no esté configurado o falle temporalmente. Al cargar una respuesta de AEMET se normalizan las fechas a `YYYY-MM-DD`, que es el formato utilizado por el selector nativo.

La respuesta de datos de AEMET se recibe como una colección JSON que contiene `prediccion.dia`; el módulo `js/aemet.js` desempaqueta esa estructura antes de normalizarla. Se mantienen los datos oficiales que existan y se muestra `N/D` cuando una variable no está disponible.

Para utilizar datos reales, sustituye `MI_API_KEY` en `js/config.js` por tu API Key de AEMET OpenData y abre la aplicación mediante un servidor local (por ejemplo, Live Server en VS Code).
