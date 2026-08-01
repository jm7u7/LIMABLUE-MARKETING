import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css"; // Tailwind (base + utilidades) — estilos de la app
import "./storage.js"; // define window.storage ANTES de cargar la app
import App from "./App.jsx";
import Login from "./Login.jsx";
import UsersAdmin from "./UsersAdmin.jsx";
import ChangePassword from "./ChangePassword.jsx";

const ADMIN_CARGOS = ["gerente", "coordinador"];

function Splash() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F8FAFC", color: "#64748B", fontFamily: "Inter, system-ui, sans-serif" }}>
      Cargando…
    </div>
  );
}

function Root() {
  // undefined = verificando sesion | null = no logueado | objeto = usuario
  const [me, setMe] = useState(undefined);

  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  // Logout global que la app interna (LoginGate) puede invocar
  useEffect(() => {
    window.__LOGOUT__ = async () => {
      try { await fetch("/api/logout", { method: "POST", credentials: "include" }); } catch (e) {}
      window.__AUTH_USER__ = null;
      setMe(null);
    };
    return () => { delete window.__LOGOUT__; };
  }, []);

  const [showUsers, setShowUsers] = useState(false);
  const [showPass, setShowPass] = useState(false);

  if (me === undefined) return <Splash />;
  if (!me) return <Login onLogin={setMe} />;

  // Exponer el usuario autenticado para que la app interna lo use como "session"
  window.__AUTH_USER__ = me;
  const esAdmin = ADMIN_CARGOS.includes(me.cargo);

  const btnBase = {
    display: "flex", alignItems: "center", gap: 8, border: "none",
    borderRadius: 999, padding: "11px 16px", fontSize: 13, fontWeight: 600,
    fontFamily: "'Inter', system-ui, sans-serif", cursor: "pointer",
    boxShadow: "0 8px 24px rgba(15,23,42,0.25)",
  };

  return (
    <>
      <App />
      {/* Botones flotantes (apilados abajo a la derecha) */}
      <div style={{
        position: "fixed", right: 18, bottom: 18, zIndex: 9998,
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10,
      }}>
        {esAdmin && (
          <button onClick={() => setShowUsers(true)} title="Gestionar cuentas de usuario"
            style={{ ...btnBase, background: "#0F172A", color: "#FFF" }}>
            <span style={{ fontSize: 15 }}>👤</span> Usuarios
          </button>
        )}
        <button onClick={() => setShowPass(true)} title="Cambiar mi contraseña"
          style={{ ...btnBase, background: "#FFFFFF", color: "#0F172A", border: "1px solid #E2E8F0" }}>
          <span style={{ fontSize: 15 }}>🔑</span> Contraseña
        </button>
      </div>
      {showUsers && <UsersAdmin me={me} onClose={() => setShowUsers(false)} />}
      {showPass && <ChangePassword me={me} onClose={() => setShowPass(false)} />}
    </>
  );
}

createRoot(document.getElementById("root")).render(<Root />);
