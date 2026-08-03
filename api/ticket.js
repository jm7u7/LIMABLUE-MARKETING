import crypto from "node:crypto";
import { sql, ensureSchema, readBody } from "./_lib.js";

// Endpoint PÚBLICO (sin login) para que otras áreas/sedes reporten pendientes desde /#ticket.
// Hace read-modify-write del bloque "ticket-inbox" en el servidor y agrega el ticket.
// Anti-abuso: valida campos, recorta tamaños, limita la foto y topa la lista a 500.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  try {
    await ensureSchema();
    const b = readBody(req);
    const titulo = String(b.titulo || "").trim();
    const areaOrigen = String(b.areaOrigen || "").trim();
    if (!titulo || !areaOrigen) return res.status(400).json({ error: "Faltan datos" });

    const foto = typeof b.foto === "string" && b.foto.length < 2500000 ? b.foto : null;
    const nuevo = {
      id: crypto.randomUUID(),
      titulo: titulo.slice(0, 300),
      descripcion: String(b.descripcion || "").slice(0, 2000),
      areaOrigen: areaOrigen.slice(0, 200),
      nombreReporta: String(b.nombreReporta || "").slice(0, 200),
      ameritaReunion: !!b.ameritaReunion,
      foto,
      creado: new Date().toISOString(),
    };

    const rows = await sql`SELECT value FROM kv_store WHERE scope = 'shared' AND key = 'ticket-inbox' LIMIT 1`;
    let actuales = [];
    if (rows[0]) { try { actuales = JSON.parse(rows[0].value); } catch (e) { actuales = []; } }
    const next = [nuevo, ...actuales].slice(0, 500);
    const val = JSON.stringify(next);

    await sql`INSERT INTO kv_store (scope, key, value, updated_at)
      VALUES ('shared', 'ticket-inbox', ${val}, now())
      ON CONFLICT (scope, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("ticket error", e);
    return res.status(500).json({ error: "Error del servidor" });
  }
}
