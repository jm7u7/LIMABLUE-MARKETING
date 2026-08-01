import { getUser } from "./_lib.js";

export default async function handler(req, res) {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "No autenticado" });
    return res.status(200).json(user);
  } catch (e) {
    console.error("me error", e);
    return res.status(500).json({ error: "Error del servidor" });
  }
}
