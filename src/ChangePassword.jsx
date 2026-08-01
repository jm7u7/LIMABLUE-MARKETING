import React, { useState } from "react";

const T = {
  bg: "#F8FAFC", panel: "#FFFFFF", border: "#E2E8F0",
  text: "#0F172A", dim: "#64748B", blue: "#2563EB", red: "#B91C1C",
};

export default function ChangePassword({ me, onClose }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirma, setConfirma] = useState("");
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null); setOk(false);
    if (!actual || !nueva) { setError("Completa la contraseña actual y la nueva."); return; }
    if (nueva.length < 6) { setError("La nueva contraseña debe tener al menos 6 caracteres."); return; }
    if (nueva !== confirma) { setError("La confirmación no coincide."); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/change-password", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: actual, newPassword: nueva }),
      });
      if (r.ok) {
        setOk(true);
        setActual(""); setNueva(""); setConfirma("");
      } else {
        const d = await r.json().catch(() => ({}));
        setError(d.error || "No se pudo cambiar la contraseña.");
      }
    } catch (e) { setError("Error de conexión."); }
    finally { setSaving(false); }
  };

  const inStyle = {
    width: "100%", background: "#FFF", border: `1px solid ${T.border}`, color: T.text,
    borderRadius: 8, padding: "10px 12px", fontSize: 13, outline: "none", boxSizing: "border-box", marginTop: 5,
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 9999,
      display: "grid", placeItems: "center", padding: 20, fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 400, background: T.panel, border: `1px solid ${T.border}`,
        borderRadius: 16, padding: 24, boxShadow: "0 20px 50px rgba(15,23,42,0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.text }}>Cambiar contraseña</h2>
          <button onClick={onClose} style={{ border: "none", background: "transparent", fontSize: 20, cursor: "pointer", color: T.dim }}>✕</button>
        </div>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: T.dim }}>{me.nombre} · {me.email}</p>

        {ok ? (
          <div>
            <div style={{ fontSize: 14, color: "#047857", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "12px 14px" }}>
              ✓ Contraseña actualizada. Úsala la próxima vez que inicies sesión.
            </div>
            <button onClick={onClose} style={{
              width: "100%", marginTop: 16, padding: "10px 16px", borderRadius: 10, border: "none",
              background: T.text, color: "#FFF", fontWeight: 600, fontSize: 14, cursor: "pointer",
            }}>Cerrar</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.text, display: "block" }}>Contraseña actual
              <input style={inStyle} type="password" autoComplete="current-password" value={actual}
                onChange={(e) => setActual(e.target.value)} placeholder="••••••••" />
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.text, display: "block", marginTop: 12 }}>Nueva contraseña
              <input style={inStyle} type="password" autoComplete="new-password" value={nueva}
                onChange={(e) => setNueva(e.target.value)} placeholder="mínimo 6 caracteres" />
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.text, display: "block", marginTop: 12 }}>Repetir nueva contraseña
              <input style={inStyle} type="password" autoComplete="new-password" value={confirma}
                onChange={(e) => setConfirma(e.target.value)} placeholder="••••••••" />
            </label>

            {error && (
              <div style={{ marginTop: 14, fontSize: 13, color: T.red, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 10px" }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={saving} style={{
              width: "100%", marginTop: 18, padding: "11px 16px", borderRadius: 10, border: "none",
              background: saving ? T.dim : T.text, color: "#FFF", fontWeight: 600, fontSize: 14,
              cursor: saving ? "default" : "pointer",
            }}>{saving ? "Guardando…" : "Guardar contraseña"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
