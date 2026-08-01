import crypto from "node:crypto";
import { sql, getUser, ensureSchema, hashPassword, readBody } from "./_lib.js";

// Gestión de cuentas. Solo Gerente/Coordinador pueden listar, crear o borrar usuarios.
const CARGOS = ["gerente", "coordinador", "edicion_audiovisual", "productor_audiovisual",
  "disenador", "paid_media", "otros", "visitante"];
const ADMIN = new Set(["gerente", "coordinador"]);

export default async function handler(req, res) {
  try {
    const me = await getUser(req);
    if (!me) return res.status(401).json({ error: "No autenticado" });
    if (!ADMIN.has(me.cargo)) return res.status(403).json({ error: "Sin permiso" });
    await ensureSchema();

    if (req.method === "GET") {
      const rows = await sql`SELECT id, email, nombre, cargo, created_at FROM users ORDER BY created_at`;
      return res.status(200).json({ users: rows });
    }

    if (req.method === "POST") {
      const { email, nombre, cargo, password } = readBody(req);
      if (!email || !nombre || !password) return res.status(400).json({ error: "Faltan datos" });
      if (String(password).length < 6) return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
      const c = CARGOS.includes(cargo) ? cargo : "otros";
      try {
        const id = crypto.randomUUID();
        await sql`INSERT INTO users (id, email, nombre, cargo, password_hash)
          VALUES (${id}, ${String(email).toLowerCase()}, ${nombre}, ${c}, ${hashPassword(password)})`;
        return res.status(201).json({ id, email: String(email).toLowerCase(), nombre, cargo: c });
      } catch (e) {
        if (String(e.message || "").includes("duplicate")) return res.status(409).json({ error: "Ese correo ya existe" });
        throw e;
      }
    }

    if (req.method === "DELETE") {
      const id = (req.query || {}).id;
      if (!id) return res.status(400).json({ error: "Falta id" });
      if (id === me.id) return res.status(400).json({ error: "No puedes borrar tu propia cuenta" });
      await sql`DELETE FROM users WHERE id = ${id}`;
      return res.status(200).json({ deleted: true });
    }

    return res.status(405).json({ error: "Método no permitido" });
  } catch (e) {
    console.error("users error", e);
    return res.status(500).json({ error: "Error del servidor" });
  }
}
