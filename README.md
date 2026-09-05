# Murcia Photo Weather Planner

## ¿Qué es?

**Murcia Photo Weather Planner** es una herramienta web gratuita pensada para fotógrafos que quieren responder rápidamente a una pregunta muy concreta:

> **¿Dónde y cuándo tengo mejores condiciones para hacer fotografías en la Región de Murcia?**

La aplicación combina predicción meteorológica oficial de **AEMET**, información solar y lunar, cálculos astronómicos y un sistema propio de valoración fotográfica para convertir los datos meteorológicos en recomendaciones prácticas.

No es una aplicación meteorológica genérica. Está orientada a la **planificación de sesiones fotográficas**, tanto diurnas como nocturnas.

La aplicación es web y no requiere instalación por parte del usuario. Puede utilizarse desde ordenador, tablet o teléfono móvil.

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

La sección **☁️ Posibilidad de nubes** utiliza la información de estado del cielo disponible en AEMET para mostrar la evolución prevista y aportar una interpretación orientada a fotografía.

La aplicación puede diferenciar descripciones como despejado, poco nuboso, intervalos nubosos, nuboso, muy nuboso, cubierto y otras descripciones proporcionadas por la fuente.

Cuando resulta apropiado, se añade una valoración fotográfica del cielo, especialmente útil alrededor del amanecer y el atardecer.

Importante: el endpoint municipal utilizado no proporciona directamente porcentajes independientes de **nubosidad baja, media y alta**, por lo que la aplicación no inventa esos valores.

---

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
- Salida y puesta de la Luna.
- Referencias estacionales como equinoccios y solsticios.

Los eventos que requieren fuentes astronómicas específicas adicionales se incorporarán únicamente cuando puedan calcularse o verificarse de forma fiable.

---

## 🗺️ Mapa de oportunidades

El **Mapa de oportunidades** analiza las localizaciones fotográficas disponibles y las representa según su interés fotográfico para la fecha, momento y modo seleccionados.

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

## 🔎 Explorar Murcia

La función **Explorar Murcia** permite analizar automáticamente varias localizaciones fotográficas y ordenarlas según su interés.

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
- Calidad del cielo.
- Lluvia.
- Nubosidad.
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
6. Revisa las mejores horas.
7. Comprueba la nubosidad y el meteograma.
8. Consulta Luna, Vía Láctea y eventos astronómicos cuando sea relevante.
9. Utiliza **Explorar Murcia** para comparar localizaciones.
10. Abre los detalles de la oportunidad que más te interese y planifica la sesión.

---

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


## Radar meteorológico

La aplicación incorpora una página independiente `radar.html` para consultar el radar regional de Murcia (Murcia–Fortuna) de AEMET. El radar se obtiene mediante una Netlify Function para mantener la API Key fuera del navegador. AEMET documenta el recurso regional con el código de radar `mu` y señala que las imágenes regionales cubren una zona definida por un círculo de 240 km de radio alrededor del radar. La imagen es un producto de observación de reflectividad, no una previsión.
