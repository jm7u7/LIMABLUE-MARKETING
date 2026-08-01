// Utilidades compartidas por las funciones serverless: BD, contraseñas, sesión.
import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";

const SECRET = process.env.AUTH_SECRET || "";
const SESSION_DAYS = 30;

// Conexión a Postgres (Neon). Lee la cadena que Vercel inyecta al conectar la BD.
const CONN =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  "";
// neon() devuelve una función tag que resuelve directamente al ARREGLO de filas.
export const sql = neon(CONN);

/* ---------------- Esquema (idempotente) ---------------- */
let schemaReady = null;
export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY,
        email text UNIQUE NOT NULL,
        nombre text NOT NULL,
        cargo text NOT NULL DEFAULT 'otros',
        password_hash text NOT NULL,
        created_at timestamptz DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS kv_store (
        scope text NOT NULL,
        key text NOT NULL,
        value text NOT NULL,
        updated_at timestamptz DEFAULT now(),
        PRIMARY KEY (scope, key)
      )`;
      // Sembrar un admin inicial si no hay usuarios y hay credenciales en el entorno.
      const rows = await sql`SELECT count(*)::int AS n FROM users`;
      if (rows[0].n === 0 && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
        await sql`INSERT INTO users (id, email, nombre, cargo, password_hash)
          VALUES (
            ${crypto.randomUUID()},
            ${process.env.ADMIN_EMAIL.toLowerCase()},
            ${process.env.ADMIN_NAME || "Administrador"},
            ${process.env.ADMIN_CARGO || "gerente"},
            ${hashPassword(process.env.ADMIN_PASSWORD)}
          )
          ON CONFLICT (email) DO NOTHING`;
      }
    })();
  }
  return schemaReady;
}

/* ---------------- Contraseñas (scrypt) ---------------- */
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const dk = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${dk}`;
}
export function verifyPassword(pw, stored) {
  try {
    const [salt, key] = String(stored).split(":");
    const dk = crypto.scryptSync(pw, salt, 64).toString("hex");
    const a = Buffer.from(key, "hex");
    const b = Buffer.from(dk, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

/* ---------------- Token de sesión (HMAC) ---------------- */
function b64u(buf) { return Buffer.from(buf).toString("base64url"); }
export function signToken(payload) {
  const body = b64u(JSON.stringify({ ...payload, exp: Date.now() + SESSION_DAYS * 864e5 }));
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}
export function verifyToken(token) {
  if (!token || !SECRET) return null;
  const [body, sig] = String(token).split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch (e) { return null; }
}

/* ---------------- Cookies ---------------- */
export function setSessionCookie(res, token) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  res.setHeader("Set-Cookie",
    `session=${token}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${maxAge}`);
}
export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `session=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`);
}
function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

/* ---------------- Usuario actual ---------------- */
export async function getUser(req) {
  const data = verifyToken(readCookie(req, "session"));
  if (!data || !data.uid) return null;
  await ensureSchema();
  const rows = await sql`SELECT id, email, nombre, cargo FROM users WHERE id = ${data.uid} LIMIT 1`;
  return rows[0] || null;
}

/* ---------------- Body JSON ---------------- */
export function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return {};
}
