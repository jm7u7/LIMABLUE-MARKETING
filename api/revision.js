import { sql, ensureSchema, readBody } from "./_lib.js";

// Endpoint PÚBLICO (sin login) para el enlace de aprobación de material (/#revisar-ID).
// Permite: 1) leer un pendiente puntual por id, 2) adjuntar el material a revisar,
// 3) registrar la decisión (aprobado / necesita corrección) — una sola vez por pendiente.
// No expone ni permite tocar el resto de campos de la tarea, solo lo relacionado a revisión.

const TASKS_KEY = "marketing-tasks-v2";

async function leerTareas() {
  const rows = await sql`SELECT value FROM kv_store WHERE scope = 'shared' AND key = ${TASKS_KEY} LIMIT 1`;
  if (!rows[0]) return [];
  try { return JSON.parse(rows[0].value); } catch (e) { return []; }
}

async function guardarTareas(tareas) {
  const val = JSON.stringify(tareas);
  await sql`INSERT INTO kv_store (scope, key, value, updated_at)
    VALUES ('shared', ${TASKS_KEY}, ${val}, now())
    ON CONFLICT (scope, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

// Solo estos campos son visibles/editables desde el enlace público — nunca se expone la tarea completa.
function vistaPublica(t) {
  return {
    id: t.id,
    titulo: t.titulo,
    descripcion: t.descripcion || "",
    departamento: t.departamento,
    responsables: t.responsables || [],
    fecha: t.fecha || "",
    archivoRevision: t.archivoRevision || null,
    revisionEstado: t.revisionEstado || null,
    comentarioRevision: t.comentarioRevision || "",
    revisadoPorNombre: t.revisadoPorNombre || "",
    revisadoEn: t.revisadoEn || null,
  };
}

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const id = String((req.query && req.query.id) || "").trim();
    if (!id) return res.status(400).json({ error: "Falta id" });

    if (req.method === "GET") {
      const tareas = await leerTareas();
      const t = tareas.find((x) => x.id === id);
      if (!t) return res.status(404).json({ error: "No encontrado" });
      return res.status(200).json(vistaPublica(t));
    }

    if (req.method === "POST") {
      const b = readBody(req);
      const accion = b.accion;
      const tareas = await leerTareas();
      const idx = tareas.findIndex((x) => x.id === id);
      if (idx === -1) return res.status(404).json({ error: "No encontrado" });
      const actual = tareas[idx];

      if (accion === "material") {
        if (actual.revisionEstado) return res.status(409).json({ error: "Ya se tomó una decisión sobre este pendiente." });
        const subidoPor = String(b.subidoPor || "").trim().slice(0, 150);
        if (!subidoPor) return res.status(400).json({ error: "Falta el nombre de quién sube el material." });
        const dataUrl = typeof b.dataUrl === "string" && b.dataUrl.length < 6000000 ? b.dataUrl : null; // ~6MB máx en base64
        const nuevo = {
          nombre: b.nombre ? String(b.nombre).slice(0, 200) : null,
          tipo: b.tipo ? String(b.tipo).slice(0, 60) : null,
          dataUrl,
          enlaceExterno: b.enlaceExterno ? String(b.enlaceExterno).slice(0, 500) : null,
          subidoPor,
          subidoEn: new Date().toISOString(),
        };
        tareas[idx] = { ...actual, archivoRevision: nuevo };
        await guardarTareas(tareas);
        return res.status(200).json(vistaPublica(tareas[idx]));
      }

      if (accion === "decision") {
        // "Solo una vez": si ya hay decisión, no se vuelve a aceptar (se devuelve la que ya existe).
        if (actual.revisionEstado) return res.status(200).json(vistaPublica(actual));
        const revisionEstado = b.revisionEstado === "aprobado" ? "aprobado" : b.revisionEstado === "rechazado" ? "rechazado" : null;
        if (!revisionEstado) return res.status(400).json({ error: "Decisión inválida" });
        const revisadoPorNombre = String(b.revisadoPorNombre || "").trim().slice(0, 150);
        if (!revisadoPorNombre) return res.status(400).json({ error: "Falta el nombre de quién decide." });
        const comentarioRevision = String(b.comentarioRevision || "").slice(0, 1000);
        const ahora = new Date().toISOString();
        tareas[idx] = {
          ...actual,
          revisionEstado,
          comentarioRevision,
          revisadoPorNombre,
          revisadoEn: ahora,
          estado: revisionEstado === "aprobado" ? "done" : "doing",
          estadoActualizadoEn: ahora,
        };
        await guardarTareas(tareas);
        return res.status(200).json(vistaPublica(tareas[idx]));
      }

      return res.status(400).json({ error: "Acción inválida" });
    }

    return res.status(405).json({ error: "Método no permitido" });
  } catch (e) {
    return res.status(500).json({ error: "Error del servidor", detail: String(e && e.message || e) });
  }
}
