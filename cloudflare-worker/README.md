# Murcia Photo Weather — proxy AEMET

Worker de Cloudflare para ocultar la API Key de AEMET al publicar la aplicación en GitHub Pages.

## Despliegue rápido con Dashboard

1. Entra en Cloudflare Workers & Pages y crea un Worker.
2. Pega el contenido de `worker.js`.
3. Despliega.
4. En **Settings → Variables and Secrets**, añade un Secret llamado `AEMET_API_KEY` con tu clave real de AEMET.
5. Copia la URL `https://...workers.dev`.
6. En la web, pon esa URL en `js/config.js` como `AEMET_PROXY_URL`.

El Worker solo admite los endpoints municipales diarios y horarios utilizados por la aplicación.
