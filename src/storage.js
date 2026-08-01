// Reemplazo de `window.storage` (antes era la API de Artifacts de Claude).
// Ahora habla con el backend /api/storage, que guarda en Postgres (Neon) en la nube.
// Mantiene EXACTAMENTE la misma interfaz para no tocar el resto de la app:
//   window.storage.get(key, shared)  -> { key, value, shared }  (lanza error si no existe)
//   window.storage.set(key, value, shared) -> { key, value, shared } | null
//   window.storage.delete(key, shared) -> { key, deleted, shared }
//   window.storage.list(prefix, shared) -> { keys: [...] }

const API = "/api/storage";
const opts = (extra = {}) => ({ credentials: "include", ...extra });

window.storage = {
  async get(key, shared = false) {
    const url = `${API}?key=${encodeURIComponent(key)}&shared=${shared ? 1 : 0}`;
    const res = await fetch(url, opts());
    if (res.status === 404) throw new Error(`Key not found: ${key}`);
    if (!res.ok) throw new Error(`storage.get failed (${res.status})`);
    const data = await res.json();
    return { key, value: data.value, shared };
  },

  async set(key, value, shared = false) {
    try {
      const res = await fetch(API, opts({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value, shared }),
      }));
      if (!res.ok) { console.error("storage.set failed", res.status); return null; }
      return { key, value, shared };
    } catch (e) {
      console.error("storage.set failed", e);
      return null;
    }
  },

  async delete(key, shared = false) {
    const url = `${API}?key=${encodeURIComponent(key)}&shared=${shared ? 1 : 0}`;
    const res = await fetch(url, opts({ method: "DELETE" }));
    const deleted = res.ok;
    return { key, deleted, shared };
  },

  async list(prefix = "", shared = false) {
    const url = `${API}?list=1&prefix=${encodeURIComponent(prefix)}&shared=${shared ? 1 : 0}`;
    const res = await fetch(url, opts());
    if (!res.ok) return { keys: [] };
    return await res.json();
  },
};
