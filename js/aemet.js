import { CONFIG } from "./config.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assertApiConfigured() {
    if (
        !CONFIG.AEMET_API_KEY ||
        CONFIG.AEMET_API_KEY ===
            "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJqb3NlLXJhbW9uLm1hcnRpbmV6QHZlb2xpYS5jb20iLCJqdGkiOiIyZWFjMjk3NS1lOWVhLTQzZTktOTI5OS00YTc3ODM4M2ZjM2IiLCJpc3MiOiJBRU1FVCIsImlhdCI6MTcxNDYzNTQwNSwidXNlcklkIjoiMmVhYzI5NzUtZTllYS00M2U5LTkyOTktNGE3NzgzODNmYzNiIiwicm9sZSI6IiJ9.orPRM-rLltVMwuViWN8hF0n8cX-KuGk6uNBMQHnjqv8" ||
        CONFIG.AEMET_API_KEY ===
            "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJqb3NlLXJhbW9uLm1hcnRpbmV6QHZlb2xpYS5jb20iLCJqdGkiOiIyZWFjMjk3NS1lOWVhLTQzZTktOTI5OS00YTc3ODM4M2ZjM2IiLCJpc3MiOiJBRU1FVCIsImlhdCI6MTcxNDYzNTQwNSwidXNlcklkIjoiMmVhYzI5NzUtZTllYS00M2U5LTkyOTktNGE3NzgzODNmYzNiIiwicm9sZSI6IiJ9.orPRM-rLltVMwuViWN8hF0n8cX-KuGk6uNBMQHnjqv8"
    ) {
        const error = new Error("Configura AEMET_API_KEY en js/config.js.");
        error.code = "API_KEY_MISSING";
        throw error;
    }
}

async function fetchJson(url, { timeoutMs = 20000, retries = 1 } = {}) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: { Accept: "application/json" },
            });
            const text = await response.text();
            let payload;
            try {
                payload = text ? JSON.parse(text) : null;
            } catch {
                throw new Error(
                    "AEMET ha devuelto una respuesta que no es JSON válido.",
                );
            }
            if (!response.ok) {
                const error = new Error(
                    payload?.descripcion || `HTTP ${response.status}`,
                );
                error.status = response.status;
                throw error;
            }
            return payload;
        } catch (error) {
            lastError =
                error.name === "AbortError"
                    ? new Error("Tiempo de espera agotado al consultar AEMET.")
                    : error;
            if (attempt < retries) await sleep(600 * (attempt + 1));
        } finally {
            clearTimeout(timeout);
        }
    }
    throw lastError;
}

async function requestAemetEndpoint(path) {
    assertApiConfigured();
    const firstUrl = `${CONFIG.AEMET_BASE_URL}${path}?api_key=${encodeURIComponent(CONFIG.AEMET_API_KEY)}`;
    const envelope = await fetchJson(firstUrl);
    if (!envelope || typeof envelope !== "object")
        throw new Error("Respuesta inicial de AEMET inesperada.");
    if (Number(envelope.estado) !== 200 || typeof envelope.datos !== "string") {
        const error = new Error(
            envelope.descripcion ||
                "AEMET no ha devuelto una URL de datos válida.",
        );
        error.status = envelope.estado;
        throw error;
    }
    return fetchJson(envelope.datos);
}

export async function getDailyForecast(municipalityCode) {
    return requestAemetEndpoint(
        `/prediccion/especifica/municipio/diaria/${municipalityCode}`,
    );
}

export async function getHourlyForecast(municipalityCode) {
    return requestAemetEndpoint(
        `/prediccion/especifica/municipio/horaria/${municipalityCode}`,
    );
}

export async function getWeatherData(municipalityCode) {
    const [daily, hourly] = await Promise.allSettled([
        getDailyForecast(municipalityCode),
        getHourlyForecast(municipalityCode),
    ]);
    if (daily.status === "rejected" && hourly.status === "rejected")
        throw daily.reason;
    return {
        daily: daily.status === "fulfilled" ? daily.value : null,
        hourly: hourly.status === "fulfilled" ? hourly.value : null,
    };
}

function asNumber(value) {
    if (
        value === null ||
        value === undefined ||
        value === "" ||
        value === "N/D"
    )
        return null;
    const num = Number(String(value).replace(",", "."));
    return Number.isFinite(num) ? num : null;
}

function fieldNumber(value) {
    if (value && typeof value === "object" && "value" in value)
        return asNumber(value.value);
    return asNumber(value);
}

function dateOnly(value) {
    if (!value) return null;
    const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
}

function unwrap(payload) {
    if (Array.isArray(payload)) return payload[0] ?? null;
    return payload ?? null;
}

function normalizeSkyList(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map((x) => ({
            periodo: x?.periodo ?? null,
            hora: x?.hora ?? null,
            value: fieldNumber(x?.value),
            descripcion: x?.descripcion ?? null,
        }))
        .filter((x) => x.descripcion || x.value !== null);
}

export function processAemetData(raw, municipality) {
    if (!raw || typeof raw !== "object")
        throw new Error("AEMET no ha devuelto datos meteorológicos.");
    const dailyPayload = unwrap(raw.daily);
    const hourlyPayload = unwrap(raw.hourly);
    const dailyRows = Array.isArray(dailyPayload?.prediccion?.dia)
        ? dailyPayload.prediccion.dia
        : [];
    const hourlyRows = Array.isArray(hourlyPayload?.prediccion?.dia)
        ? hourlyPayload.prediccion.dia
        : [];
    if (!dailyRows.length && !hourlyRows.length)
        throw new Error(
            "AEMET ha respondido, pero no contiene predicciones utilizables.",
        );
    return normalizeWeatherData({
        municipality,
        dailyRows,
        hourlyRows,
        dailyRaw: dailyPayload,
        hourlyRaw: hourlyPayload,
    });
}

export function normalizeWeatherData({
    municipality,
    dailyRows,
    hourlyRows,
    dailyRaw,
    hourlyRaw,
}) {
    const daily = dailyRows
        .map((day) => ({
            date: dateOnly(day.fecha),
            temperature: {
                max: asNumber(day.temperatura?.maxima),
                min: asNumber(day.temperatura?.minima),
                values: Array.isArray(day.temperatura?.dato)
                    ? day.temperatura.dato.map(fieldNumber)
                    : [],
            },
            humidity: {
                max: asNumber(day.humedadRelativa?.maxima),
                min: asNumber(day.humedadRelativa?.minima),
                values: Array.isArray(day.humedadRelativa?.dato)
                    ? day.humedadRelativa.dato.map(fieldNumber)
                    : [],
            },
            rainProbability: Array.isArray(day.probPrecipitacion)
                ? day.probPrecipitacion.map((x) => ({
                      period: x?.periodo ?? null,
                      value: fieldNumber(x?.value),
                  }))
                : [],
            precipitation: [],
            sky: normalizeSkyList(day.estadoCielo),
            wind: Array.isArray(day.viento)
                ? day.viento.map((x) => ({
                      direction: x?.direccion ?? null,
                      speed: asNumber(x?.velocidad),
                      period: x?.periodo ?? null,
                  }))
                : [],
            gusts: Array.isArray(day.rachaMax)
                ? day.rachaMax.map((x) => fieldNumber(x?.value ?? x))
                : [],
            uvMax: fieldNumber(day.uvMax),
        }))
        .filter((day) => day.date);

    const hourly = hourlyRows.flatMap((day) => {
        const date = dateOnly(day.fecha);
        if (!date) return [];
        const candidates = [
            day.temperatura,
            day.probPrecipitacion,
            day.estadoCielo,
            day.humedadRelativa,
            day.vientoAndRachaMax,
            day.precipitacion,
            day.probTormenta,
        ];
        const length = Math.max(
            0,
            ...candidates.map((x) => (Array.isArray(x) ? x.length : 0)),
        );
        return Array.from({ length }, (_, i) => {
            const temp = day.temperatura?.[i];
            const humidity = day.humedadRelativa?.[i];
            const rain = day.probPrecipitacion?.[i];
            const precip = day.precipitacion?.[i];
            const storm = day.probTormenta?.[i];
            const sky = day.estadoCielo?.[i];
            const wind = day.vientoAndRachaMax?.[i];
            return {
                date,
                hour:
                    temp?.hora ??
                    humidity?.hora ??
                    rain?.hora ??
                    precip?.hora ??
                    storm?.hora ??
                    sky?.hora ??
                    wind?.hora ??
                    null,
                temperature: fieldNumber(temp),
                humidity: fieldNumber(humidity),
                rainProbability: fieldNumber(rain?.value ?? rain),
                precipitation: fieldNumber(precip?.value ?? precip),
                stormProbability: fieldNumber(storm?.value ?? storm),
                sky: sky
                    ? {
                          value: fieldNumber(sky?.value),
                          description: sky?.descripcion ?? null,
                      }
                    : null,
                wind: wind
                    ? {
                          direction: wind.direccion ?? null,
                          speed: asNumber(wind.velocidad),
                          gust: asNumber(wind.rachaMax),
                      }
                    : null,
            };
        });
    });

    return {
        municipality,
        updatedAt: new Date().toISOString(),
        daily,
        hourly,
        raw: { daily: dailyRaw, hourly: hourlyRaw },
    };
}
