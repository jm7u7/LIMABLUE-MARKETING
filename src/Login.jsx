import React, { useState } from "react";

const T = {
  bg: "#F8FAFC", panel: "#FFFFFF", border: "#E2E8F0",
  text: "#0F172A", dim: "#64748B", blue: "#2563EB",
};

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) { setError("Escribe tu correo y contraseña."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      if (res.ok) {
        const user = await res.json();
        onLogin(user);
      } else if (res.status === 401) {
        setError("Correo o contraseña incorrectos.");
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "No se pudo iniciar sesión. Intenta de nuevo.");
      }
    } catch (e) {
      setError("Error de conexión. Revisa tu internet.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: T.bg, padding: 20 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&display=swap');
        .lb-disp { font-family: 'Space Grotesk', sans-serif; }
        .lb-in {
          width: 100%; background: #FFFFFF; border: 1px solid ${T.border}; color: ${T.text};
          border-radius: 10px; padding: 11px 13px; font-size: 14px; outline: none;
          font-family: 'Inter', sans-serif; box-sizing: border-box;
        }
        .lb-in:focus { border-color: ${T.blue}; }
      `}</style>
      <form
        onSubmit={submit}
        className="lb-disp"
        style={{
          width: "100%", maxWidth: 380, background: T.panel, border: `1px solid ${T.border}`,
          borderRadius: 18, padding: 28, boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: T.blue }} />
          <div className="lb-disp" style={{ fontSize: 18, fontWeight: 700, color: T.text }}>Limablue · Marketing</div>
        </div>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: T.dim }}>Inicia sesión con tu cuenta.</p>

        <label style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Correo
          <input className="lb-in" style={{ marginTop: 6 }} type="email" autoComplete="username"
            placeholder="tucorreo@limablue.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>

        <label style={{ fontSize: 13, fontWeight: 600, color: T.text, display: "block", marginTop: 14 }}>Contraseña
          <input className="lb-in" style={{ marginTop: 6 }} type="password" autoComplete="current-password"
            placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>

        {error && (
          <div style={{ marginTop: 14, fontSize: 13, color: "#B91C1C", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 10px" }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading}
          style={{
            width: "100%", marginTop: 20, padding: "11px 16px", borderRadius: 10, border: "none",
            background: loading ? T.dim : T.text, color: "#FFF", fontWeight: 600, fontSize: 14,
            cursor: loading ? "default" : "pointer",
          }}>
          {loading ? "Entrando…" : "Entrar"}
        </button>

        <p style={{ marginTop: 16, fontSize: 12, color: T.dim, textAlign: "center" }}>
          ¿No tienes cuenta? Pídele a Gerencia o Coordinación que te cree una.
        </p>
      </form>
    </div>
  );
}
