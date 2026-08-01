import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./storage.js"; // define window.storage ANTES de cargar la app
import App from "./App.jsx";
import Login from "./Login.jsx";

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

  if (me === undefined) return <Splash />;
  if (!me) return <Login onLogin={setMe} />;

  // Exponer el usuario autenticado para que la app interna lo use como "session"
  window.__AUTH_USER__ = me;
  return <App />;
}

createRoot(document.getElementById("root")).render(<Root />);
