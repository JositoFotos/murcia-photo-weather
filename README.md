# Murcia Photo Weather Planner

Aplicación web local y sin proceso de compilación para planificar sesiones fotográficas en la Región de Murcia combinando predicción oficial de AEMET, cálculo solar con SunCalc y un índice fotográfico propio.

## 1. AEMET OpenData

El flujo implementado en `js/aemet.js` es deliberadamente de dos pasos:

1. petición al endpoint de predicción;
2. recepción del sobre con `estado`, `descripcion` y `datos`;
3. segunda petición contra la URL de `datos`;
4. validación y normalización;
5. uso de los datos normalizados en la interfaz.

La horaria se limita a las horas que AEMET facilita; no se extrapolan horas futuras como si fueran datos oficiales.

## 2. Datos meteorológicosLos 

Campos que se consumen corresponden a las estructuras de predicción municipal conocidas de AEMET (`temperatura`, `humedadRelativa`, `probPrecipitacion`, `estadoCielo`, `viento`, `rachaMax`, y en horaria `probTormenta`, `precipitacion`, `vientoAndRachaMax`, etc.). Cuando no existe un dato, la interfaz muestra `N/D`.

## 3. Índice fotográfico

El índice es propio de la aplicación. No es un producto o predicción oficial de AEMET.

Pondera:

- lluvia y probabilidad de lluvia;
- nubosidad baja/media/alta;
- tormentas;
- viento;
- temperatura;
- humedad;
- visibilidad cuando se dispone de ese dato.

Los modos de fotografía aplican conjuntos de pesos distintos. Para amanecer/atardecer se premia una nubosidad media/alta moderada en vez de asumir que un cielo completamente despejado siempre es mejor.

## 4. Cálculo astronómico

Se utiliza SunCalc por CDN. Calcula amanecer, atardecer, hora dorada, hora azul, mediodía solar y duración del día. La pantalla fuerza el formato a `Europe/Madrid`.

SunCalc permite añadir tiempos solares personalizados mediante `addTime`; la aplicación usa ángulos aproximados de -4° y -8° para delimitar la hora azul.

## 5. Mapa

Leaflet 1.9.4 + OpenStreetMap.

El mapa soporta:

- zoom y desplazamiento;
- pantalla completa
- clic para seleccionar coordenadas;
- marcador arrastrable;
- geolocalización;
- localizaciones fotográficas;
- mapa de oportunidades;
- leyenda de capas.

## 6. Capas meteorológicas externas

AEMET es la fuente de los datos meteorológicos mostrados en el dashboard. Las capas raster meteorológicas del mapa se mantienen separadas y son opcionales.

Se usan las capas oficiales de Weather Maps de OpenWeather: precipitación, nubosidad, temperatura y viento.

## 7. Meteograma

Se usa Chart.js por CDN. Se muestran, cuando AEMET los proporciona, temperatura, probabilidad de lluvia y viento por hora.

## 8. Localizaciones fotográficas

Contiene una colección inicial de 15 localizaciones representativas y apunta a un municipio AEMET cercano. Puedes añadir nuevas entradas sin modificar la lógica.


## 9. Límites deliberados

- AEMET no proporciona una predicción específica para cada punto arbitrario del mapa: la app usa el municipio como referencia meteorológica y mantiene la coordenada fotográfica por separado.
- El mapa no inventa meteorología por píxel.
- Si AEMET no entrega un campo, la aplicación muestra `N/D`.
- Los resultados del índice fotográfico no deben interpretarse como predicciones oficiales.
