import { sql, ensureSchema, verifyPassword, signToken, setSessionCookie, readBody } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  try {
    await ensureSchema();
    const { email, password } = readBody(req);
    if (!email || !password) return res.status(400).json({ error: "Faltan datos" });

    const rows = await sql`SELECT id, email, nombre, cargo, password_hash
      FROM users WHERE email = ${String(email).toLowerCase()} LIMIT 1`;
    const user = rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    setSessionCookie(res, signToken({ uid: user.id }));
    return res.status(200).json({ id: user.id, email: user.email, nombre: user.nombre, cargo: user.cargo });
  } catch (e) {
    console.error("login error", e);
    return res.status(500).json({ error: "Error del servidor" });
  }
}
