import React, { useState, useEffect } from "react";

const T = {
  bg: "#F8FAFC", panel: "#FFFFFF", border: "#E2E8F0",
  text: "#0F172A", dim: "#64748B", blue: "#2563EB", red: "#B91C1C",
};

const CARGOS = [
  { id: "gerente", label: "Gerente" },
  { id: "coordinador", label: "Coordinador" },
  { id: "edicion_audiovisual", label: "Edición Audiovisual" },
  { id: "productor_audiovisual", label: "Productor Audiovisual" },
  { id: "disenador", label: "Diseñador" },
  { id: "paid_media", label: "Paid Media" },
  { id: "otros", label: "Otros" },
  { id: "visitante", label: "Visitante" },
];
const labelCargo = (id) => (CARGOS.find((c) => c.id === id) || {}).label || id;

const emptyForm = { nombre: "", email: "", cargo: "otros", password: "" };

export default function UsersAdmin({ me, onClose }) {
  const [users, setUsers] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const r = await fetch("/api/users", { credentials: "include" });
      if (r.ok) { const d = await r.json(); setUsers(d.users || []); }
      else setUsers([]);
    } catch (e) { setUsers([]); }
  };
  useEffect(() => { load(); }, []);

  const crear = async (e) => {
    e.preventDefault();
    setError(null); setOk(null);
    if (!form.nombre.trim() || !form.email.trim() || !form.password) {
      setError("Completa nombre, correo y contraseña."); return;
    }
    if (form.password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/users", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          email: form.email.trim().toLowerCase(),
          cargo: form.cargo,
          password: form.password,
        }),
      });
      if (r.ok) {
        setOk(`Cuenta creada para ${form.nombre.trim()}.`);
        setForm(emptyForm);
        load();
      } else {
        const d = await r.json().catch(() => ({}));
        setError(d.error || "No se pudo crear la cuenta.");
      }
    } catch (e) { setError("Error de conexión."); }
    finally { setSaving(false); }
  };

  const borrar = async (u) => {
    if (!window.confirm(`¿Borrar la cuenta de ${u.nombre}?`)) return;
    setError(null); setOk(null);
    try {
      const r = await fetch(`/api/users?id=${encodeURIComponent(u.id)}`, {
        method: "DELETE", credentials: "include",
      });
      if (r.ok) load();
      else { const d = await r.json().catch(() => ({})); setError(d.error || "No se pudo borrar."); }
    } catch (e) { setError("Error de conexión."); }
  };

  const inStyle = {
    width: "100%", background: "#FFF", border: `1px solid ${T.border}`, color: T.text,
    borderRadius: 8, padding: "9px 11px", fontSize: 13, outline: "none", boxSizing: "border-box",
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 9999,
      display: "grid", placeItems: "center", padding: 20, fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 640, maxHeight: "88vh", overflow: "auto",
        background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24,
        boxShadow: "0 20px 50px rgba(15,23,42,0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.text }}>Usuarios y accesos</h2>
          <button onClick={onClose} style={{ border: "none", background: "transparent", fontSize: 20, cursor: "pointer", color: T.dim }}>✕</button>
        </div>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: T.dim }}>
          Crea las cuentas del equipo. Cada persona entra con su correo y contraseña.
        </p>

        {/* Formulario de creación */}
        <form onSubmit={crear} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Nombre
              <input style={{ ...inStyle, marginTop: 5 }} value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre y apellido" />
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Correo
              <input style={{ ...inStyle, marginTop: 5 }} type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="correo@limablue.com" />
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Cargo
              <select style={{ ...inStyle, marginTop: 5 }} value={form.cargo}
                onChange={(e) => setForm({ ...form, cargo: e.target.value })}>
                {CARGOS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Contraseña
              <input style={{ ...inStyle, marginTop: 5 }} type="text" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="mínimo 6 caracteres" />
            </label>
          </div>
          {error && <div style={{ marginTop: 12, fontSize: 12, color: T.red }}>{error}</div>}
          {ok && <div style={{ marginTop: 12, fontSize: 12, color: "#047857" }}>{ok}</div>}
          <button type="submit" disabled={saving} style={{
            marginTop: 14, padding: "9px 16px", borderRadius: 8, border: "none",
            background: saving ? T.dim : T.text, color: "#FFF", fontWeight: 600, fontSize: 13,
            cursor: saving ? "default" : "pointer",
          }}>{saving ? "Creando…" : "Crear cuenta"}</button>
        </form>

        {/* Lista de usuarios */}
        <div style={{ fontSize: 12, fontWeight: 600, color: T.dim, marginBottom: 8 }}>
          CUENTAS ({users ? users.length : "…"})
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {users === null && <div style={{ fontSize: 13, color: T.dim }}>Cargando…</div>}
          {users && users.length === 0 && <div style={{ fontSize: 13, color: T.dim }}>Aún no hay cuentas.</div>}
          {users && users.map((u) => (
            <div key={u.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px",
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
                  {u.nombre} {u.id === me.id && <span style={{ fontSize: 11, color: T.blue }}>(tú)</span>}
                </div>
                <div style={{ fontSize: 12, color: T.dim }}>{u.email} · {labelCargo(u.cargo)}</div>
              </div>
              {u.id !== me.id && (
                <button onClick={() => borrar(u)} style={{
                  border: `1px solid ${T.border}`, background: "#FFF", color: T.red,
                  borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer",
                }}>Borrar</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
