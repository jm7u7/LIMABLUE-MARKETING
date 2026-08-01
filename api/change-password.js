import { sql, getUser, ensureSchema, verifyPassword, hashPassword, readBody } from "./_lib.js";

// Permite a cualquier usuario autenticado cambiar SU propia contraseña.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  try {
    const me = await getUser(req);
    if (!me) return res.status(401).json({ error: "No autenticado" });
    await ensureSchema();

    const { currentPassword, newPassword } = readBody(req);
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Faltan datos" });
    if (String(newPassword).length < 6) return res.status(400).json({ error: "La nueva contraseña debe tener al menos 6 caracteres" });

    const rows = await sql`SELECT password_hash FROM users WHERE id = ${me.id} LIMIT 1`;
    if (!rows[0] || !verifyPassword(currentPassword, rows[0].password_hash)) {
      return res.status(401).json({ error: "La contraseña actual no es correcta" });
    }

    await sql`UPDATE users SET password_hash = ${hashPassword(newPassword)} WHERE id = ${me.id}`;
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("change-password error", e);
    return res.status(500).json({ error: "Error del servidor" });
  }
}
