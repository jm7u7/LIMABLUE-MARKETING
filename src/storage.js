// Reemplazo de `window.storage` (antes era la API de Artifacts de Claude).
// Ahora habla con el backend /api/storage, que guarda en Postgres (Neon) en la nube.
// Mantiene la misma interfaz para no tocar el resto de la app.
//
// IMPORTANTE (evita "reset diario"): Neon (plan gratis) SUSPENDE el cómputo tras ~5 min
// de inactividad. La primera petición tras la suspensión (p.ej. cada mañana) puede fallar
// o tardar mientras la BD "despierta". Por eso get/set REINTENTAN con backoff, y get
// distingue 404 (vacío real) de un error de servidor. Así una lectura fría ya no se
// confunde con "no hay datos" (que llevaba a sobrescribir con vacío = pérdida de datos).

const API = "/api/storage";
const opts = (extra = {}) => ({ credentials: "include", ...extra });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Reintenta ante errores de red o respuestas 5xx (BD despertando). Devuelve la Response.
async function fetchRetry(doFetch, { retries = 4, base = 400 } = {}) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await doFetch();
      if (res.status >= 500 && i < retries - 1) { await sleep(base * (i + 1)); continue; }
      return res;
    } catch (e) {
      lastErr = e;
      if (i < retries - 1) { await sleep(base * (i + 1)); continue; }
    }
  }
  if (lastErr) throw lastErr;
  throw new Error("storage: el servidor no respondió (reintentos agotados)");
}

window.storage = {
  // Devuelve { key, value, shared } si existe; null si NO existe (404 = vacío confirmado);
  // LANZA error si el servidor falló de verdad (para NO confundir "falla" con "vacío").
  async get(key, shared = false) {
    const url = `${API}?key=${encodeURIComponent(key)}&shared=${shared ? 1 : 0}`;
    const res = await fetchRetry(() => fetch(url, opts()));
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`storage.get failed (${res.status})`);
    const data = await res.json();
    return { key, value: data.value, shared };
  },

  async set(key, value, shared = false) {
    try {
      const res = await fetchRetry(() => fetch(API, opts({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value, shared }),
      })));
      if (!res.ok) { console.error("storage.set failed", res.status); return null; }
      return { key, value, shared };
    } catch (e) {
      console.error("storage.set failed", e);
      return null;
    }
  },

  async delete(key, shared = false) {
    const url = `${API}?key=${encodeURIComponent(key)}&shared=${shared ? 1 : 0}`;
    try {
      const res = await fetchRetry(() => fetch(url, opts({ method: "DELETE" })));
      return { key, deleted: res.ok, shared };
    } catch (e) {
      return { key, deleted: false, shared };
    }
  },

  async list(prefix = "", shared = false) {
    const url = `${API}?list=1&prefix=${encodeURIComponent(prefix)}&shared=${shared ? 1 : 0}`;
    try {
      const res = await fetchRetry(() => fetch(url, opts()));
      if (!res.ok) return { keys: [] };
      return await res.json();
    } catch (e) {
      return { keys: [] };
    }
  },
};
