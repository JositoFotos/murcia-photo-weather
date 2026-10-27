## v35 — Mapa de potencial de arrebol (Candilazo)

- Se elimina la tarjeta de predicción de arrebol de la página Fotografía; el mapa independiente pasa a ser el punto de acceso principal.
- El mapa lee la ubicación y fecha compartidas desde los parámetros URL o el contexto de navegación de la sesión.
- Añade el punto exacto seleccionado a la malla meteorológica, lo destaca en el mapa y abre su detalle al cargar.
- Título de página y panel actualizado a “Mapa de potencial de arrebol (Candilazo)”.

# Murcia Photo Weather Planner

## ¿Qué es?

**Murcia Photo Weather Planner** es una herramienta web gratuita pensada para fotógrafos que quieren responder rápidamente a una pregunta muy concreta:

> **¿Dónde y cuándo tengo mejores condiciones para hacer fotografías en la Región de Murcia?**

La aplicación combina predicción meteorológica oficial de **AEMET**, información solar y lunar, cálculos astronómicos y un sistema propio de valoración fotográfica para convertir los datos meteorológicos en recomendaciones prácticas.

No es una aplicación meteorológica genérica. Está orientada a la **planificación de sesiones fotográficas**, tanto diurnas como nocturnas.

La aplicación es web y no requiere instalación por parte del usuario. Puede utilizarse desde ordenador, tablet o teléfono móvil.

## Diseño visual

La interfaz utiliza un diseño claro inspirado en dashboards fotográficos: cabecera azul suave, tarjetas blancas, tipografía Inter, puntuación destacada, controles compactos y un layout responsive. Inter se carga desde Google Fonts; Leaflet, SunCalc y Chart.js mantienen sus CDN gratuitos.

En escritorio, Fotografía presenta mapa, índice y un resumen lateral de meteorología con accesos a Astronomía y Recomendados. En móvil, los paneles se apilan para mantener textos y controles legibles.

---

## ¿Qué puedo hacer con la aplicación?

### 1. Elegir una localización

Puedes trabajar con una localización de varias formas:

- Buscar un municipio o localidad.
- Seleccionar una localización fotográfica del catálogo.
- Introducir unas coordenadas.
- Hacer clic directamente sobre el mapa.
- Arrastrar el marcador para ajustar la posición.
- Utilizar **📍 Usar mi ubicación** para obtener tu posición mediante la geolocalización del dispositivo.

Al cambiar la ubicación, la aplicación actualiza las coordenadas, la meteorología y los cálculos fotográficos y astronómicos correspondientes.

### 2. Elegir la fecha

La aplicación permite consultar las fechas disponibles para la predicción y adaptar el análisis a la fecha seleccionada.

La fecha afecta simultáneamente a la predicción, las horas solares, la Luna, la Vía Láctea, los eventos astronómicos y las mejores ventanas fotográficas.

### 3. Elegir el tipo de fotografía

Puedes cambiar entre distintos modos fotográficos:

- 📷 **Paisaje**
- 🌅 **Amanecer / Atardecer**
- 🌊 **Costa**
- 🌿 **Naturaleza**
- 🏛 **Arquitectura**
- 🌌 **Nocturna**

Cada modo modifica los criterios y pesos utilizados en el índice fotográfico. De esta manera, una situación que puede ser interesante para paisaje no tiene por qué ser igualmente buena para fotografía nocturna.

---

## Índice fotográfico

La aplicación calcula un **Índice fotográfico de 0 a 100**. Es un cálculo propio de la aplicación y **no es una predicción oficial de AEMET**.

Las categorías son:

| Puntuación | Valoración |
|---:|---|
| 0–20 | Muy desfavorable |
| 21–40 | Desfavorable |
| 41–60 | Aceptable |
| 61–80 | Bueno |
| 81–100 | Excelente |

El índice puede tener en cuenta, entre otros factores disponibles, lluvia, probabilidad de precipitación, nubosidad, tormentas, viento, temperatura, humedad y visibilidad.

La aplicación no asume que un cielo completamente despejado sea siempre lo mejor para fotografiar. Para amaneceres y atardeceres puede valorar favorablemente determinados escenarios de nubosidad que tengan potencial para generar textura, contraste y color.

También se muestran factores positivos y negativos para explicar por qué una situación obtiene una determinada valoración.

---

## El cielo y la nubosidad

La tarjeta **Datos complementarios · OpenWeather** muestra la evolución de nubosidad total en intervalos de tres horas, y la aplicación utiliza ese dato como complemento de la previsión oficial de AEMET para orientar la valoración fotográfica.

OpenWeather aporta nubosidad total porcentual, no una separación directa entre nubes bajas, medias y altas en el producto de previsión gratuito que utiliza esta aplicación. Por ello, la interfaz no inventa porcentajes por capas.

---

## Diagnóstico de errores de AEMET

Las respuestas de error de AEMET pueden incluir un estado dentro del JSON aunque la respuesta HTTP exterior sea 200. La función de Netlify normaliza ahora esos estados para que la aplicación distinga correctamente entre credenciales rechazadas, límite de peticiones, falta de datos y una respuesta con formato inesperado. No se muestran claves ni secretos en el navegador.

## Meteorología

Los datos meteorológicos proceden de **AEMET** y pueden incluir, cuando están disponibles:

- Temperatura.
- Temperatura máxima y mínima.
- Probabilidad de precipitación.
- Precipitación.
- Estado del cielo.
- Viento y dirección.
- Rachas.
- Probabilidad de tormenta.
- Humedad.
- Visibilidad y otras variables disponibles.

Cuando AEMET no proporciona un dato, la aplicación muestra **N/D** en lugar de inventar un valor.

---

## Meteograma

El meteograma permite observar la evolución temporal de las principales variables meteorológicas.

Incluye información como:

- Temperatura (°C).
- Probabilidad de lluvia (%).
- Viento (km/h).

Las horas del eje temporal corresponden a los periodos horarios de la predicción y se muestran como horas locales. Al pasar el cursor sobre el gráfico se pueden consultar los valores correspondientes a cada hora.

---

## Luz: amanecer, hora azul y hora dorada

La aplicación calcula las principales referencias solares para la coordenada y fecha seleccionadas:

- Amanecer.
- Hora azul de la mañana.
- Hora dorada de la mañana.
- Mediodía solar.
- Hora dorada de la tarde.
- Hora azul de la tarde.
- Atardecer.
- Duración del día.

Estas referencias se combinan con la meteorología para identificar las franjas con mayor interés fotográfico.

El objetivo no es mostrar simplemente la hora del amanecer o del atardecer, sino responder a preguntas como:

- ¿Habrá nubes interesantes durante la puesta de sol?
- ¿Hay lluvia prevista durante la hora dorada?
- ¿El viento será razonable para la sesión?

---

## 🌙 Luna

La aplicación utiliza cálculos astronómicos locales para mostrar información útil para fotografía lunar y nocturna.

Entre los datos disponibles pueden encontrarse:

- Fase lunar.
- Porcentaje iluminado.
- Luna creciente o menguante.
- Hora de salida.
- Hora de puesta.
- Altura sobre el horizonte.
- Posición de la Luna para la localización y fecha seleccionadas.
- Distancia aproximada a la Luna.

La información lunar es especialmente útil al combinarla con el modo **🌌 Nocturna** y con el análisis de la Vía Láctea.

---

## 🌌 Vía Láctea

La aplicación incluye un análisis orientado a fotografía nocturna de la **Vía Láctea**.

El objetivo es identificar cuándo existe una ventana razonable para observar el centro galáctico desde la localización elegida, teniendo en cuenta factores astronómicos y la iluminación lunar.

La información puede incluir:

- Visibilidad estimada del centro galáctico.
- Ventana temporal favorable.
- Momento de máxima altura.
- Altura aproximada.
- Azimut aproximado.
- Influencia de la Luna.
- Condiciones de oscuridad.
- Índice orientativo de interés para fotografía de Vía Láctea.

Este indicador es una **estimación fotográfica propia** y no debe interpretarse como una observación astronómica oficial o una garantía de visibilidad.

---

## 🔭 Eventos astronómicos

La aplicación puede mostrar eventos astronómicos relevantes asociados a la fecha consultada, especialmente aquellos útiles para planificación fotográfica, como:

- Luna nueva.
- Cuarto creciente.
- Luna llena.
- Cuarto menguante.
- Referencias estacionales como equinoccios y solsticios.

La salida y puesta de la Luna se consultan en la tarjeta **Luna**, para evitar duplicar la misma información.

Los eventos que requieren fuentes astronómicas específicas adicionales se incorporarán únicamente cuando puedan calcularse o verificarse de forma fiable.

---

## 🗺️ Mapa de oportunidades

En la pestaña **⭐ Recomendados**, el **Mapa de oportunidades** analiza las localizaciones fotográficas disponibles y las representa según su interés fotográfico para la fecha, momento y modo seleccionados.

La escala utilizada es:

| Puntuación | Oportunidad |
|---:|---|
| 80–100 | 🟢 Excelente |
| 65–79 | 🟢 Muy buena |
| 50–64 | 🟡 Buena |
| 30–49 | 🟠 Regular |
| 0–29 | 🔴 Desfavorable |

El objetivo es facilitar una lectura rápida del territorio y detectar dónde puede merecer más la pena desplazarse.

---

## 🔎 Recomendados y planificación de sesión

La pestaña **⭐ Recomendados** permite analizar automáticamente varias localizaciones fotográficas y ordenarlas según su interés. La búsqueda solo se ejecuta al pulsar **Buscar oportunidades**, para que puedas cambiar fecha, modo o franja horaria antes de consultar.

El sistema:

1. analiza las localizaciones disponibles;
2. obtiene las predicciones necesarias;
3. calcula los índices fotográficos;
4. calcula los índices de amanecer y atardecer;
5. tiene en cuenta el modo fotográfico seleccionado;
6. ordena las localizaciones;
7. actualiza el mapa;
8. muestra un ranking.

De esta manera puedes pasar de la pregunta **“¿qué tiempo hará?”** a **“¿dónde me interesa ir a fotografiar?”**.

---

## 🏆 Ranking y comparador

El ranking destaca las mejores localizaciones y ofrece una explicación de los principales motivos de su valoración.

También es posible comparar varias localizaciones teniendo en cuenta variables como:

- Índice fotográfico.
- Nubosidad total y su evolución.
- Lluvia.
- Viento.
- Tormentas.
- Amanecer.
- Atardecer.

---

## 📍 Localizaciones fotográficas

La aplicación incluye una colección inicial de localizaciones representativas de la Región de Murcia, además de soporte para ampliar el catálogo.

El sistema está preparado para trabajar con localizaciones de paisaje, costa, naturaleza, arquitectura y otros tipos de fotografía.

También puede utilizarse el mapa para analizar coordenadas concretas que no formen parte del catálogo.

---

## ⭐ Favoritos y localizaciones personalizadas

Las localizaciones personalizadas pueden guardarse localmente en el navegador con información como:

- Nombre.
- Coordenadas.
- Categoría.
- Notas.

Los favoritos son útiles para guardar miradores, playas, puntos de paisaje o localizaciones propias que quieras consultar con frecuencia.

---

## 🕘 Historial

Las consultas realizadas pueden guardarse localmente en el dispositivo. El historial permite recuperar consultas anteriores y eliminar registros cuando sea necesario.

El almacenamiento es local: no es necesario crear una cuenta para utilizar estas funciones.

---

## 📤 Exportación y compartir

La aplicación permite trabajar con los resultados fuera de la web mediante distintas opciones de exportación: 

- **CSV** para datos meteorológicos.
- **JSON** para guardar una consulta completa y sus datos.
- **Imprimir / PDF** mediante la vista de impresión del navegador.
- **Copiar resumen** al portapapeles.
- **URL compartible** con ubicación y fecha.

Una URL compartible puede seguir este esquema:

```text
index.html?lat=37.6&lon=-0.98&date=2026-08-27
```

---

## 🚀 Cómo utilizarla

No necesitas instalar ningún programa ni crear una cuenta.

1. Abre la web.
2. Selecciona una localización o utiliza tu ubicación.
3. Elige la fecha.
4. Selecciona el tipo de fotografía.
5. Consulta el índice fotográfico.
6. Consulta la tarjeta **Mejor momento** para el modo elegido.
7. Revisa la nubosidad, los datos complementarios y el meteograma.
8. Consulta Luna, Vía Láctea y eventos astronómicos cuando sea relevante.
9. Abre **Recomendados** para comparar localizaciones y definir una franja horaria.
10. Selecciona una oportunidad para reutilizar sus coordenadas en las demás pestañas.

---

## ⏳ Carga de datos y errores temporales

Al consultar datos de servicios externos, la aplicación muestra indicadores de carga mientras la petición está en curso. Si un servicio no responde, la interfaz explica qué fuente ha fallado y presenta una opción para reintentar cuando corresponda.

- **AEMET** es la fuente principal de predicción meteorológica. Puede limitar temporalmente las peticiones; si hay una previsión guardada, la aplicación puede mostrarla indicando que procede de caché.
- **OpenWeather** aporta variables meteorológicas complementarias, con previsión en tramos de tres horas. Si el servicio no está disponible, la tarjeta muestra el error sin bloquear el resto del dashboard.
- **Astronomía** (Sol y Luna) se calcula localmente con SunCalc. La previsión meteorológica que acompaña al análisis nocturno se carga por separado.
- **Contaminación lumínica** utiliza el World Atlas of Artificial Night Sky Brightness 2025 y dispone de una opción para volver a consultar el punto.

`N/D` significa que esa variable no está disponible para la localización, fecha o fuente consultada; no equivale necesariamente a un error de toda la aplicación.

## 📱 Uso en móvil

La interfaz está diseñada para utilizarse también sobre el terreno desde un teléfono móvil.

Se adapta a pantallas pequeñas, mantiene el mapa y los indicadores principales accesibles y permite consultar el ranking y las ventanas fotográficas sin necesidad de instalar una aplicación nativa.

La geolocalización requiere el permiso correspondiente del navegador y puede depender de la configuración del dispositivo.

---

## 🌐 Fuentes de información

### AEMET

Los datos meteorológicos proceden de la **API oficial de AEMET OpenData**. La aplicación utiliza los recursos de predicción disponibles y no sustituye a la información oficial de AEMET.

### OpenStreetMap / Leaflet

El mapa se basa en **Leaflet** y servicios de mapas compatibles con **OpenStreetMap**.

### SunCalc

Los cálculos de posición y fases del Sol y la Luna utilizan **SunCalc**.

### Cálculos propios

La interpretación fotográfica, los índices, la valoración de oportunidades, las mejores ventanas y la estimación específica de interés fotográfico son funcionalidades propias de la aplicación.

---

## ⚠️ Fiabilidad y limitaciones

La aplicación está pensada como herramienta de **planificación fotográfica**, no como sustituto de una previsión meteorológica oficial ni como garantía de que una sesión vaya a producir determinadas condiciones.

Los índices fotográficos son orientativos y dependen de los datos disponibles, la localización, la fecha y el modo fotográfico.

Cuando una variable no está disponible en la fuente de datos correspondiente, la aplicación evita inventarla y muestra **N/D** o una indicación equivalente.

Las condiciones meteorológicas pueden cambiar y siempre es recomendable consultar la información oficial más reciente antes de desplazarse.

---

## 💡 Filosofía de la aplicación

Murcia Photo Weather Planner intenta reducir la información meteorológica y astronómica a una decisión práctica:

```text
ELIJO FECHA
     ↓
ELIJO TIPO DE FOTOGRAFÍA
     ↓
ELIJO O ANALIZO UNA LOCALIZACIÓN
     ↓
EL SISTEMA COMBINA METEOROLOGÍA + LUZ + ASTRONOMÍA
     ↓
MAPA DE OPORTUNIDADES
     ↓
RANKING DE LOCALIZACIONES
     ↓
MEJOR HORA
     ↓
RECOMENDACIÓN FOTOGRÁFICA
```

La pregunta que guía la aplicación es siempre:

> **¿Dónde y cuándo tengo mejores condiciones para hacer fotografías?**

---

## 🔒 Privacidad

Las preferencias, favoritos e historial se almacenan localmente en el navegador cuando la funcionalidad correspondiente está disponible.

La aplicación no necesita una cuenta de usuario para su uso normal.

La geolocalización solamente se utiliza cuando el usuario la solicita y concede permiso al navegador.

---

## 📸 Uso recomendado

Para una sesión real se recomienda revisar conjuntamente:

- índice fotográfico;
- lluvia y tormentas;
- evolución del cielo y nubosidad;
- viento;
- ventana solar;
- Luna y oscuridad en fotografía nocturna;
- posición y visibilidad de la Vía Láctea;
- ranking de localizaciones.

La utilidad del programa está precisamente en **combinar todas estas piezas en una misma decisión fotográfica**.

---

## Estado del proyecto

Murcia Photo Weather Planner es un proyecto en evolución. Se irán incorporando mejoras y nuevas fuentes o cálculos astronómicos cuando aporten información útil y fiable para la planificación fotográfica en la Región de Murcia.



## Secciones principales

### 📸 Fotografía
Consulta una localización, fecha y modo fotográfico. Aquí se concentran AEMET, OpenWeather, la línea de luz solar, el meteograma, el índice fotográfico y el **mejor momento** para el modo seleccionado.

### 🌌 Astronomía
Planifica fotografía nocturna con Luna, Vía Láctea, condiciones nocturnas, calendario lunar y eventos astronómicos. La ubicación y fecha se conservan al navegar entre secciones.

### ⭐ Recomendados
Permite comparar localizaciones de Murcia en un mapa y en un ranking. Puedes seleccionar fecha, modo y momento del día o definir una franja personalizada para planificar una sesión.

### ☁️ Evolución de nubosidad
OpenWeather aporta la nubosidad total por intervalos de 3 horas. La aplicación la representa como evolución temporal y la utiliza como factor fotográfico: puede aportar valor a paisaje, amanecer/atardecer, costa, naturaleza y arquitectura, mientras que se penaliza especialmente en fotografía nocturna.

### Visibilidad fotográfica
La visibilidad de OpenWeather se expresa en kilómetros (hasta 10 km). El índice fotográfico la convierte en una puntuación creciente: a mayor visibilidad, mayor puntuación, evitando interpretar kilómetros como un porcentaje.

## Corrección de consistencia del índice

La versión v23 unifica el cálculo del índice fotográfico entre **Fotografía** y **Recomendados** y utiliza OpenWeather para las coordenadas exactas de cada localización, evitando discrepancias por agregaciones o posiciones diferentes.


## Contaminación lumínica en Astronomía

La pestaña **Astronomía** consulta el *World Atlas of Artificial Night Sky Brightness 2025* de **David Lorenz** para mostrar, en las coordenadas seleccionadas, el índice LP del atlas, la zona LP y el brillo del cielo en el cenit expresado en mag/arcsec². El valor se obtiene de las teselas numéricas del atlas mediante una función de Netlify; el navegador no descarga ni almacena el conjunto de datos completo.

**Atribución de la fuente:** David Lorenz, *World Atlas of Artificial Night Sky Brightness 2025*, https://djlorenz.github.io/astronomy/lp/. El autor autorizó por correo el uso en este sitio no comercial con la condición de citar su nombre y la fuente.

El atlas modeliza el brillo artificial en el cenit a partir de datos satelitales; **no es una medición in situ ni equivale a la escala Bortle**. La tarjeta prioriza una explicación práctica para el fotógrafo: cuánto puede elevarse el fondo del cielo, cómo puede afectar al contraste de la Vía Láctea y qué decisiones pueden ayudar en esa localización. Las cifras técnicas permanecen en un apartado desplegable.

El **índice LP** expresa la relación entre brillo artificial estimado y brillo natural de referencia: 1× indica que ambos componentes son iguales; por encima de 1×, la contribución artificial estimada supera la referencia natural. El brillo del cielo expresado en **mag/arcsec²** utiliza una escala inversa: valores más altos representan un cielo más oscuro. Estas interpretaciones se basan en la explicación de métricas publicada por David Lorenz: https://djlorenz.github.io/astronomy/lp/colors.html. La valoración de impacto, el efecto fotográfico y las recomendaciones son orientativos y propios de la aplicación; no constituyen una medición local ni una clasificación oficial del atlas. La contaminación lumínica se muestra como información separada y todavía no modifica el índice nocturno general.

## Mapa de contaminación lumínica

La pestaña **Astronomía** incorpora un mapa interactivo con la capa raster del *World Atlas of Artificial Night Sky Brightness 2025*, de David Lorenz, superpuesta sobre OpenStreetMap. La atribución se muestra en el propio mapa y en la tarjeta de contaminación lumínica.

- El mapa se centra en las coordenadas seleccionadas.
- Los tonos más oscuros del atlas suelen representar menor brillo artificial estimado; los tonos más claros, mayor brillo artificial.
- Puedes desplazarte, acercar y pulsar sobre cualquier punto dentro de la cobertura del atlas para consultar la estimación numérica.
- El punto consultado muestra la zona del atlas, el índice LP y el brillo estimado del cielo. El botón **Usar este punto en Astronomía** actualiza la localización, la Luna, la Vía Láctea, las condiciones nocturnas y las demás tarjetas para esas coordenadas.
- El mapa permite comparar visualmente zonas cercanas antes de decidir dónde realizar una sesión.

**Importante:** el atlas modeliza brillo artificial del cielo en el cenit; no es una medición local y no equivale a la escala Bortle. Las condiciones reales también dependen de la Luna, nubosidad, transparencia atmosférica y del resplandor cerca del horizonte. El mapa carga las teselas públicas del atlas de David Lorenz de forma remota y consulta los valores puntuales mediante la función Netlify `light-pollution`.

Fuente y atribución: David Lorenz, [World Atlas of Artificial Night Sky Brightness 2025](https://djlorenz.github.io/astronomy/lp/). Uso autorizado por el autor para este sitio no comercial.


## Corrección de inicialización astronómica (v28)

Se ha eliminado una declaración duplicada de `escapeHtml` en `js/astronomy-page.js` que impedía cargar el módulo como JavaScript ES module en el navegador. Esa excepción evitaba que se inicializara la página, por lo que permanecían los skeletons y el estado «Preparando cálculos astronómicos…». También se sincronizan los enlaces hacia Astronomía y Recomendados justo antes de navegar para transmitir siempre la fecha, el modo y la ubicación más recientes.


## Persistencia del punto seleccionado (v29)

La localización elegida en el mapa del atlas de contaminación lumínica se guarda como contexto de navegación al pulsar **Usar este punto en Astronomía**. Al abrir Recomendados, aunque todavía no se ejecute una búsqueda, los enlaces a Fotografía y Astronomía conservan las coordenadas, el nombre, la fecha y el modo fotográfico. El contexto se transmite mediante los parámetros de URL y se conserva además en `sessionStorage` como respaldo dentro de la misma pestaña. Si no hay coordenadas válidas, la aplicación nunca las convierte accidentalmente en `0,0`.


## v33 — Azul Mediterráneo · calendario lunar y candilazo experimental

- Calendario lunar: iconos separados para gibosa creciente, luna llena y gibosa menguante; el disco lleno usa 🌕. Las fechas del calendario se construyen al mediodía de `Europe/Madrid` para evitar desajustes de día por la zona horaria del navegador y cambios de horario estacional.
- Fotografía: nueva tarjeta **Predicción de arrebol (Candilazo)** con datos horarios de Open-Meteo, nubosidad por capas, visibilidad y precipitación. La puntuación es una heurística experimental de 0–100, no una probabilidad validada; la confianza de datos se presenta por separado.
- Créditos: se añaden agradecimientos a Pepe Baleriola y al autor jositofotos, además de las atribuciones de las fuentes de datos.
- Open-Meteo: la API gratuita está limitada a usos no comerciales, con límites de frecuencia y atribución CC BY 4.0. Revisa sus condiciones vigentes antes de usarla en un sitio comercial: https://open-meteo.com/en/terms.

Pruebas de esta entrega: sintaxis de los módulos JavaScript, parseo HTML y pruebas aisladas de las fases lunares y de la heurística con datos simulados. No se ha verificado la API meteorológica real ni se ha desplegado el sitio.


## v34 — Mapa regional de arrebol (experimental)

Se añade `arrebol.html`, una página independiente con un mapa regional del potencial experimental de candilazo. La malla de puntos se consulta en una única petición multicoordenada a Open-Meteo, se calcula el índice por punto a partir de nubosidad por capas, visibilidad y precipitación alrededor del ocaso y se muestra la confianza de forma separada. Los resultados se almacenan temporalmente en `sessionStorage` para reducir peticiones repetidas. La capa es orientativa y no representa una probabilidad validada ni precisión a escala local.

La página incluye atribución a Open-Meteo (CC BY 4.0) y OpenStreetMap. El mapa requiere conexión a Internet para cargar cartografía y previsiones. No se han realizado cambios ni despliegues en el sitio publicado al preparar esta versión.
