import { sql, getUser, ensureSchema, readBody } from "./_lib.js";

// Almacén clave-valor compartido por el equipo. Reemplaza a window.storage de Claude.
// scope = 'shared' (datos del equipo) o el id del usuario (datos privados, no usados hoy).
export default async function handler(req, res) {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "No autenticado" });
    await ensureSchema();

    const method = req.method;
    const q = req.query || {};
    const shared = String(q.shared) === "1" || String(q.shared) === "true";

    // GET ?list=1 -> lista de claves con prefijo
    if (method === "GET" && (q.list === "1" || q.list === "true")) {
      const scope = shared ? "shared" : user.id;
      const prefix = (q.prefix || "") + "%";
      const rows = await sql`SELECT key FROM kv_store WHERE scope = ${scope} AND key LIKE ${prefix}`;
      return res.status(200).json({ keys: rows.map((r) => r.key) });
    }

    if (method === "GET") {
      const key = q.key;
      if (!key) return res.status(400).json({ error: "Falta key" });
      const scope = shared ? "shared" : user.id;
      const rows = await sql`SELECT value FROM kv_store WHERE scope = ${scope} AND key = ${key} LIMIT 1`;
      if (!rows[0]) return res.status(404).json({ error: "Key not found" });
      return res.status(200).json({ key, value: rows[0].value, shared });
    }

    if (method === "POST") {
      const { key, value, shared: bShared } = readBody(req);
      if (!key) return res.status(400).json({ error: "Falta key" });
      const isShared = bShared === true || bShared === "true" || bShared === 1;
      const scope = isShared ? "shared" : user.id;
      const val = typeof value === "string" ? value : JSON.stringify(value);
      await sql`INSERT INTO kv_store (scope, key, value, updated_at)
        VALUES (${scope}, ${key}, ${val}, now())
        ON CONFLICT (scope, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
      return res.status(200).json({ key, shared: isShared });
    }

    if (method === "DELETE") {
      const key = q.key;
      if (!key) return res.status(400).json({ error: "Falta key" });
      const scope = shared ? "shared" : user.id;
      await sql`DELETE FROM kv_store WHERE scope = ${scope} AND key = ${key}`;
      return res.status(200).json({ key, deleted: true, shared });
    }

    return res.status(405).json({ error: "Método no permitido" });
  } catch (e) {
    console.error("storage error", e);
    return res.status(500).json({ error: "Error del servidor" });
  }
}
