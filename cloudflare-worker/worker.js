const AEMET_BASE = "https://opendata.aemet.es/opendata/api";
const ALLOWED = new Set([
  /^\/prediccion\/especifica\/municipio\/diaria\/\d+$/,
  /^\/prediccion\/especifica\/municipio\/horaria\/\d+$/
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== "GET") return json({ error: "Método no permitido" }, 405);

    const url = new URL(request.url);
    if (url.pathname !== "/aemet") return json({ error: "Ruta no encontrada" }, 404);

    const path = url.searchParams.get("path") || "";
    if (!ALLOWED.has(path)) return json({ error: "Endpoint AEMET no permitido" }, 400);

    const apiKey = String(env.AEMET_API_KEY || "").trim();
    if (!apiKey) return json({ error: "AEMET_API_KEY no configurada en el Worker" }, 500);

    try {
      const first = await fetch(`${AEMET_BASE}${path}?api_key=${encodeURIComponent(apiKey)}`, {
        headers: { Accept: "application/json" }
      });
      const firstText = await first.text();
      let envelope;
      try { envelope = JSON.parse(firstText); }
      catch { return json({ error: "AEMET devolvió una respuesta no JSON", status: first.status }, 502); }

      if (!first.ok || Number(envelope?.estado) !== 200 || typeof envelope?.datos !== "string") {
        return json({ error: envelope?.descripcion || `AEMET HTTP ${first.status}`, status: Number(envelope?.estado || first.status) }, 502);
      }

      const second = await fetch(envelope.datos, { headers: { Accept: "application/json" } });
      const secondText = await second.text();
      if (!second.ok) return json({ error: `AEMET datos HTTP ${second.status}` }, 502);

      let data;
      try { data = JSON.parse(secondText); }
      catch { return json({ error: "La segunda respuesta de AEMET no es JSON válido" }, 502); }

      return json(data, 200);
    } catch (error) {
      return json({ error: `Error de conexión con AEMET: ${error.message}` }, 502);
    }
  }
};
