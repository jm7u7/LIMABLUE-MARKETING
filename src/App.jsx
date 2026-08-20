import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Plus, X, Trash2, Calendar, User, Flag, LayoutGrid, CheckCircle2, AlertTriangle,
  TrendingUp, Upload, FileSpreadsheet, Check, Users, CircleDollarSign, Target,
  ChevronDown, MessageSquare, ShoppingBag, Megaphone, ClipboardList, ImagePlus,
  ChevronLeft, ChevronRight, CalendarDays, Paperclip, Pencil, Download, BookOpen,
  PenTool, FolderOpen, Link2, Copy, ExternalLink, Eraser, Eye, Lock, Clock, Pin
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import Papa from "papaparse";

const uid = () => "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
const normalize = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const localISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const nowStamp = () => new Date().toISOString();

// Vuelve a leer el dato COMPARTIDO más reciente justo antes de escribir, en vez de confiar
// en el estado local (que puede estar desactualizado si otra persona guardó algo mientras tanto).
// Esto evita que una carga inicial lenta/fallida termine borrando datos de otros al agregar algo nuevo.
async function mutateShared(key, shared, mutatorFn) {
  // Leemos el dato COMPARTIDO más reciente antes de escribir. get() devuelve null si la
  // clave no existe (vacío real) y LANZA si el servidor falló (p.ej. Neon despertando).
  // Si la lectura falla de verdad (no 404), RE-LANZAMOS: así el llamador no ejecuta su
  // setState(next) ni escribe nada. NUNCA sobrescribimos con vacío = nunca se borran datos.
  // La operación queda sin efecto y se puede reintentar (para entonces la BD ya despertó).
  const res0 = await window.storage.get(key, shared);
  const current = res0 ? JSON.parse(res0.value) : []; // null = vacío confirmado
  const next = mutatorFn(current);
  const res = await window.storage.set(key, JSON.stringify(next), shared);
  return { next, ok: !!res };
}

const fmtSoles = (n) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 0 }).format(n || 0);
const fmtNum = (n) => new Intl.NumberFormat("es-PE").format(Math.round(n || 0));

/* ---------------------------------- THEME (oscuro / neón, estilo dashboard cripto) ---------------------------------- */
const T = {
  bg: "transparent",
  panel: "rgba(15,23,41,0.58)",
  panelAlt: "rgba(22,32,58,0.72)",
  border: "rgba(120,160,225,0.16)",
  text: "#EAF1FF",
  dim: "#8CA0C7",
  blue: "#2FB3FF",
  blueDark: "#1152D8",
  teal: "#20E4C0",

  amber: "#FFB020",
  rose: "#FF5C7A",
  purple: "#8B6BFF",
  slate: "#33436B",
};

/* ---------------------------------- Partículas de fondo (puntitos que suben y se desvanecen) ---------------------------------- */
const BG_PARTICLES = Array.from({ length: 42 }, (_, i) => ({
  left: (i * 8.3 + (i % 5) * 4.5) % 100,
  size: 2 + (i % 3),
  delay: (i * 0.45) % 16,
  duration: 10 + (i % 6) * 2,
  opacity: 0.4 + (i % 4) * 0.13,
}));

/* ---------------------------------- ISOTIPO LIMABLUE (los 5 puntos del logo) ---------------------------------- */
function LimablueDots({ color = "#FFFFFF", size = 32, animated = false, delayStep = 0.1, animClass = "lb-dot-anim" }) {
  const dots = [
    { cx: 24.1, cy: 83.2, r: 8.5 },
    { cx: 41.4, cy: 65.3, r: 11.8 },
    { cx: 69.1, cy: 46.9, r: 15.4 },
    { cx: 107.1, cy: 33.5, r: 19.2 },
    { cx: 153.4, cy: 38.2, r: 23.9 },
  ];
  return (
    <svg viewBox="0 0 190 101" width={size} height={size * (101 / 190)} style={{ display: "block", overflow: "visible" }}>
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.cx}
          cy={d.cy}
          r={d.r}
          fill={color}
          className={animated ? animClass : ""}
          style={animated ? { animationDelay: `${i * delayStep}s` } : {}}
        />
      ))}
    </svg>
  );
}

const INTRO_VIDEO_SRC = "/intro-video.mp4";

function IntroSplash({ onFinish }) {
  const [etapa, setEtapa] = useState("video"); // video -> isotipo -> (onFinish)
  const [saliendo, setSaliendo] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [mostrarBoton, setMostrarBoton] = useState(false);
  const videoRef = useRef(null);

  const irAIsotipo = () => setEtapa("isotipo");

  useEffect(() => {
    if (etapa !== "video") return;
    const t = setTimeout(irAIsotipo, 4800); // respaldo por si el video no dispara onEnded
    const t2 = setTimeout(() => {
      const v = videoRef.current;
      if (v && v.paused) setMostrarBoton(true);
    }, 900);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [etapa]);

  useEffect(() => {
    if (etapa !== "isotipo") return;
    setSaliendo(false);
    const t = setTimeout(() => { setSaliendo(true); setTimeout(onFinish, 380); }, 2200);
    return () => clearTimeout(t);
  }, [etapa]);

  if (etapa === "video" && !videoError) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#000", zIndex: 9999 }} onClick={irAIsotipo}>
        <style>{`.lb-splash-video { width: 100%; height: 100%; object-fit: cover; }`}</style>
        <video
          ref={videoRef}
          className="lb-splash-video"
          src={INTRO_VIDEO_SRC}
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={irAIsotipo}
          onError={() => setVideoError(true)}
        />
        {mostrarBoton && (
          <button
            onClick={(e) => { e.stopPropagation(); const v = videoRef.current; if (v) v.play().catch(() => irAIsotipo()); setMostrarBoton(false); }}
            className="absolute"
            style={{
              bottom: 40, left: "50%", transform: "translateX(-50%)",
              background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.3)", color: "#FFF",
              padding: "10px 20px", borderRadius: 999, fontSize: 13, fontWeight: 600,
              fontFamily: "'Inter', sans-serif", cursor: "pointer",
            }}
          >
            Toca para continuar
          </button>
        )}
      </div>
    );
  }

  // etapa === "isotipo" (o el video falló al cargar)
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${T.blueDark}, ${T.blue})`, zIndex: 9999 }} onClick={onFinish}>
      <style>{`
        @keyframes lbDotIn { 0% { opacity: 0; transform: scale(0) translateY(14px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes lbFadeOut { 0% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes lbGlowSweep { 0% { transform: translateX(-120%) rotate(8deg); opacity: 0; } 15% { opacity: 0.55; } 60% { opacity: 0.35; } 100% { transform: translateX(120%) rotate(8deg); opacity: 0; } }
        .lb-dot-anim { opacity: 0; animation: lbDotIn 0.5s cubic-bezier(.34,1.56,.64,1) forwards; transform-origin: center; transform-box: fill-box; }
        .lb-splash-wrap { position: relative; z-index: 1; }
        .lb-splash-wrap.lb-splash-out { animation: lbFadeOut 0.38s ease-in forwards; }
        .lb-splash-sweep {
          position: absolute; top: -40%; left: 0; width: 60%; height: 180%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,0.22), transparent);
          animation: lbGlowSweep 2.2s ease-in-out infinite; pointer-events: none;
        }
      `}</style>
      <div className="lb-splash-sweep" />
      <div className={`lb-splash-wrap flex flex-col items-center${saliendo ? " lb-splash-out" : ""}`}>
        <LimablueDots color="#FFFFFF" size={260} animated delayStep={0.12} />
      </div>
    </div>
  );
}

/* ---------------------------------- ACCESO POR CARGO ---------------------------------- */
// Nota: esto es solo un selector organizacional (ordena qué ve cada cargo), sin usuario ni contraseña.

const CARGOS = [
  { id: "gerente", label: "Gerente", color: T.purple, acceso: "total" },
  { id: "coordinador", label: "Coordinador", color: T.blue, acceso: "total" },
  { id: "edicion_audiovisual", label: "Edición Audiovisual", color: T.teal, acceso: "area", area: "edicion_audiovisual" },
  { id: "productor_audiovisual", label: "Realizador Audiovisual", color: "#0891B2", acceso: "area", area: "productor_audiovisual" },
  { id: "disenador", label: "Diseñador", color: T.amber, acceso: "area", area: "diseno" },
  { id: "productor_ia", label: "Productor IA", color: "#EC4899", acceso: "area", area: "productor_ia" },
  { id: "otros", label: "Otros", color: T.dim, acceso: "minimo" },
  { id: "visitante", label: "Visitante", color: "#94A3B8", acceso: "dashboard_pendientes" },
];
const cargoMeta = (id) => CARGOS.find((c) => c.id === id) || CARGOS[CARGOS.length - 1];


const DEPARTAMENTOS = [
  { id: "gerencia", label: "Gerencia", color: T.purple },
  { id: "coordinacion", label: "Coordinación", color: T.blue },
  { id: "diseno", label: "Diseño Gráfico", color: T.amber },
  { id: "productor_audiovisual", label: "Realizador Audiovisual", color: "#0891B2" },
  { id: "edicion_audiovisual", label: "Edición Audiovisual", color: T.teal },
  { id: "productor_ia", label: "Productor IA", color: "#EC4899" },
];

const COLUMNS = [
  { id: "todo", label: "Por hacer", color: T.blue },
  { id: "doing", label: "En curso", color: T.amber },
  { id: "revision", label: "En revisión", color: T.purple },
  { id: "done", label: "Hecho", color: T.teal },
  { id: "suspendido", label: "Suspendido", color: T.rose },
];

const PRIORITY = [
  { id: "alta", label: "Alta", color: T.rose },
  { id: "media", label: "Media", color: T.amber },
  { id: "baja", label: "Baja", color: T.dim },
];

const priorityMeta = (id) => PRIORITY.find((p) => p.id === id) || PRIORITY[1];
const deptMeta = (id) => DEPARTAMENTOS.find((d) => d.id === id) || DEPARTAMENTOS[0];

const BANDEJA = { id: "bandeja", label: "Tickets (otras áreas)", color: T.rose };
const TABS_PENDIENTES = [BANDEJA, ...DEPARTAMENTOS];

const makeEmptyTaskForm = (dept) => ({ titulo: "", descripcion: "", responsables: [], fechaInicio: localISO(), fecha: "", horaInicio: "", horaFin: "", prioridad: "media", departamento: dept, esEmergencia: false, sustentoEmergencia: "", solicitadoPor: "", firmaSolicitante: null });
const emptyTicketForm = { titulo: "", descripcion: "", areaOrigen: "", nombreReporta: "", requiereReunion: false, fechaPropuesta: "", foto: null };

const comprimirImagen = (file, cb) => {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const maxSide = 800;
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      cb(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
};

function TicketLinkShare() {
  const [copied, setCopied] = useState(false);
  const base = typeof window !== "undefined" ? window.location.href.split("#")[0] : "";
  const ticketLink = `${base}#ticket`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(ticketLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) { /* no-op */ }
  };

  return (
    <div className="rounded-xl p-4 mb-6" style={{ background: T.panelAlt, border: `1px solid ${T.border}` }}>
      <p className="text-xs font-semibold mb-1" style={{ color: T.text }}>Enlace para que otras áreas reporten pendientes</p>
      <p className="text-[11px] mb-3" style={{ color: "#94A3B8" }}>
        Comparte este link por WhatsApp o correo. Abre un formulario simple (sin ver el resto del panel) donde solo pueden cargar su pendiente. Para que funcione fuera de este chat, primero debes publicar/compartir este panel desde Claude.
      </p>
      <div className="flex gap-2 flex-wrap">
        <input readOnly className="flex-1 min-w-[200px] mono text-[11px]" value={ticketLink} onClick={(e) => e.target.select()} />
        <button onClick={copiar} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-white" style={{ background: copied ? T.teal : T.rose }}>
          <Copy size={13} /> {copied ? "¡Copiado!" : "Copiar enlace"}
        </button>
        <a href={ticketLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium" style={{ background: T.panel, color: T.dim, border: `1px solid ${T.border}` }}>
          <ExternalLink size={13} /> Probar
        </a>
      </div>
    </div>
  );
}

function TaskAttachments({ taskId, onCountChange }) {
  const [files, setFiles] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(`task-files:${taskId}`, true);
        setFiles(res ? JSON.parse(res.value) : []);
      } catch (e) {
        setFiles([]);
      }
    })();
  }, [taskId]);

  const persistFiles = async (next) => {
    setFiles(next);
    onCountChange?.(next.length);
    try {
      const res = await window.storage.set(`task-files:${taskId}`, JSON.stringify(next), true);
      if (!res) setError("No se pudo guardar el archivo. Intenta de nuevo.");
      else setError(null);
    } catch (e) {
      setError("No se pudo guardar el archivo. Intenta de nuevo.");
    }
  };

  const handleFiles = (fileList) => {
    setError(null);
    Array.from(fileList).forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const maxSide = 900;
            const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
            const canvas = document.createElement("canvas");
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
            setFiles((prev) => {
              const next = [...(prev || []), { id: uid(), name: file.name, type: "image", dataUrl, addedAt: nowStamp() }];
              persistFiles(next);
              return prev;
            });
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      } else {
        if (file.size > 800 * 1024) {
          setError(`"${file.name}" pesa demasiado (máx. ~800KB para documentos). Sube una versión más liviana.`);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          setFiles((prev) => {
            const next = [...(prev || []), { id: uid(), name: file.name, type: "file", dataUrl: reader.result, addedAt: nowStamp() }];
            persistFiles(next);
            return prev;
          });
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removeFile = (id) => persistFiles((files || []).filter((f) => f.id !== id));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium" style={{ color: T.dim }}>Fotos y documentos</p>
        <button type="button" onClick={() => inputRef.current?.click()} className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg" style={{ background: T.panelAlt, color: T.blue, border: `1px solid ${T.border}` }}>
          <Upload size={12} /> Subir archivo
        </button>
        <input ref={inputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xlsx,.xls" className="hidden" onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ""; }} />
      </div>
      {error && <p className="text-[11px] mb-2" style={{ color: T.rose }}>{error}</p>}
      <p className="text-[11px] mb-2" style={{ color: "#94A3B8" }}>Las imágenes se comprimen automáticamente. Documentos hasta ~800KB.</p>
      {files === null ? (
        <p className="text-xs" style={{ color: "#94A3B8" }}>Cargando…</p>
      ) : files.length === 0 ? (
        <p className="text-xs" style={{ color: "#94A3B8" }}>Sin archivos todavía.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {files.map((f) => (
            <div key={f.id} className="relative group" style={{ width: 64 }}>
              {f.type === "image" ? (
                <a href={f.dataUrl} target="_blank" rel="noreferrer">
                  <img src={f.dataUrl} alt={f.name} className="w-16 h-16 rounded-lg object-cover" style={{ border: `1px solid ${T.border}` }} />
                </a>
              ) : (
                <a href={f.dataUrl} download={f.name} className="w-16 h-16 rounded-lg flex flex-col items-center justify-center gap-1" style={{ background: T.panelAlt, border: `1px solid ${T.border}` }}>
                  <FileSpreadsheet size={16} color={T.dim} />
                  <span className="text-[8px] px-1 truncate w-full text-center" style={{ color: T.dim }}>{f.name}</span>
                </a>
              )}
              <button type="button" onClick={() => removeFile(f.id)} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: T.rose }}>
                <X size={10} color="#fff" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const DIAS_SEMANA_LARGO = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function CalendarioDelDia({ tasks, areaColor, colorDeTarea }) {
  const hoyReal = localISO();
  const [fecha, setFecha] = useState(hoyReal);
  const HORA_INICIO = 7, HORA_FIN = 19;
  const horas = Array.from({ length: HORA_FIN - HORA_INICIO + 1 }, (_, i) => i + HORA_INICIO);
  const ALTO_HORA = 50;

  const minutosDesde = (hora) => {
    const [h, m] = hora.split(":").map(Number);
    return (h - HORA_INICIO) * 60 + m;
  };

  const cambiarDia = (delta) => {
    const d = new Date(fecha + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setFecha(localISO(d));
  };

  const tareasDelDia = useMemo(() => {
    return (tasks || [])
      .filter((t) => {
        if (!t.horaInicio) return false;
        const ini = t.fechaInicio || t.fecha;
        const fin = t.fecha || t.fechaInicio;
        return ini && fin && ini <= fecha && fecha <= fin;
      })
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  }, [tasks, fecha]);

  const dObj = new Date(fecha + "T00:00:00");
  const etiquetaFecha = `${DIAS_SEMANA_LARGO[dObj.getDay()]}, ${dObj.getDate()} de ${MESES_LARGO[dObj.getMonth()]}`;

  const ahora = new Date();
  const esHoy = fecha === hoyReal;
  const minutosAhora = (ahora.getHours() - HORA_INICIO) * 60 + ahora.getMinutes();
  const mostrarLineaAhora = esHoy && minutosAhora >= 0 && minutosAhora <= (HORA_FIN - HORA_INICIO) * 60;

  return (
    <div className="rounded-xl p-3 shrink-0" style={{ background: T.panel, border: `1px solid ${T.border}`, width: 280 }}>
      <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: T.text }}>
        <Clock size={13} color={areaColor} /> Calendario del día
      </p>
      <div className="flex items-center justify-between mb-3 gap-1">
        <span className="text-[11px] font-medium capitalize truncate" style={{ color: T.text }}>{etiquetaFecha}</span>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => cambiarDia(-1)} className="p-1 rounded" style={{ color: "#8CA0C7" }}><ChevronLeft size={13} /></button>
          <button onClick={() => cambiarDia(1)} className="p-1 rounded" style={{ color: "#8CA0C7" }}><ChevronRight size={13} /></button>
          {!esHoy && (
            <button onClick={() => setFecha(hoyReal)} className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: T.blue + "1A", color: T.blue }}>Hoy</button>
          )}
        </div>
      </div>
      <div className="relative" style={{ height: horas.length * ALTO_HORA }}>
        {horas.map((h, i) => (
          <div key={h} className="absolute left-0 right-0 flex items-start gap-1.5" style={{ top: i * ALTO_HORA }}>
            <span className="text-[9px] mono w-8 shrink-0 -mt-1.5" style={{ color: "#94A3B8" }}>{String(h).padStart(2, "0")}:00</span>
            <div className="flex-1 border-t" style={{ borderColor: T.border }} />
          </div>
        ))}
        {mostrarLineaAhora && (
          <div className="absolute left-0 right-0 flex items-center gap-1 z-10" style={{ top: (minutosAhora / 60) * ALTO_HORA }}>
            <span className="text-[8px] mono font-bold w-8 shrink-0 text-right pr-0.5" style={{ color: T.rose }}>{ahora.toTimeString().slice(0, 5)}</span>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: T.rose }} />
            <div className="flex-1 border-t" style={{ borderColor: T.rose, borderTopWidth: 1.5 }} />
          </div>
        )}
        {tareasDelDia.map((t) => {
          const iniMin = minutosDesde(t.horaInicio);
          const finMin = t.horaFin ? minutosDesde(t.horaFin) : iniMin + 30;
          const top = Math.max((iniMin / 60) * ALTO_HORA, 0);
          const height = Math.max(((finMin - iniMin) / 60) * ALTO_HORA, 22);
          const c = t.esEmergencia ? T.rose : (colorDeTarea ? colorDeTarea(t.id) : areaColor);
          return (
            <div key={t.id} className="absolute rounded px-1.5 py-1 overflow-hidden" style={{
              top, height, left: 38, right: 2,
              background: c + "22", borderLeft: `3px solid ${c}`,
            }} title={t.titulo}>
              <p className="text-[9.5px] font-medium leading-tight truncate" style={{ color: T.text }}>{t.titulo}</p>
              <div className="flex items-center justify-between">
                <p className="text-[8.5px] mono" style={{ color: "#94A3B8" }}>{t.horaInicio}{t.horaFin ? `–${t.horaFin}` : ""}</p>
                {t.esEmergencia && <span className="text-[7.5px] font-bold" style={{ color: T.rose }}>EMERGENCIA</span>}
              </div>
            </div>
          );
        })}
      </div>
      {tareasDelDia.length === 0 && (
        <p className="text-[11px] text-center py-4 mt-2 rounded-lg" style={{ color: "#94A3B8", border: `1px dashed ${T.border}` }}>
          Sin horarios agendados este día. Agrega hora de inicio/fin al crear un pendiente para verlo aquí.
        </p>
      )}
      <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${T.border}` }}>
        <span className="text-[10px]" style={{ color: "#94A3B8" }}>Pendientes con hora asignada, {esHoy ? "hoy" : ""} {fecha.slice(5)}</span>
      </div>

    </div>
  );
}

function AreaMiniCalendar({ tasks, areaColor }) {
  const [cursor, setCursor] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [selectedDate, setSelectedDate] = useState(todayKey);

  const grid = useMemo(() => getMonthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);

  const rangos = useMemo(() => tasks.map((t) => {
    const inicio = t.fechaInicio || localISO(new Date(t.creado || Date.now()));
    return { ...t, inicioCalc: inicio, finCalc: t.fecha || inicio };
  }), [tasks]);

  const porDia = useMemo(() => {
    const map = {};
    grid.forEach(({ date }) => {
      const key = toKey(date);
      map[key] = rangos.filter((t) => key >= t.inicioCalc && key <= t.finCalc);
    });
    return map;
  }, [grid, rangos]);

  const seleccionadas = porDia[selectedDate] || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="p-1.5 rounded-lg" style={{ background: T.panelAlt }}>
          <ChevronLeft size={16} color={T.dim} />
        </button>
        <div className="flex items-center gap-2">
          <CalendarDays size={15} color={areaColor} />
          <h4 className="disp text-sm font-semibold" style={{ color: T.text }}>{MESES[cursor.getMonth()]} {cursor.getFullYear()}</h4>
          <button onClick={() => { const n = new Date(); setCursor(new Date(n.getFullYear(), n.getMonth(), 1)); setSelectedDate(todayKey); }} className="text-[11px] font-medium px-2 py-1 rounded-full" style={{ background: T.panelAlt, color: T.blue }}>Hoy</button>
        </div>
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="p-1.5 rounded-lg" style={{ background: T.panelAlt }}>
          <ChevronRight size={16} color={T.dim} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-5">
        {DIAS_SEMANA.map((d) => <div key={d} className="text-center text-[10px] font-semibold py-1" style={{ color: "#94A3B8" }}>{d}</div>)}
        {grid.map(({ date, outside }, i) => {
          const key = toKey(date);
          const dayTasks = porDia[key] || [];
          const isToday = key === todayKey;
          const isSelected = key === selectedDate;
          return (
            <button
              key={i}
              onClick={() => setSelectedDate(key)}
              className="aspect-square rounded-lg p-1 text-left flex flex-col transition-colors"
              style={{ background: isSelected ? areaColor + "12" : T.panel, border: `1px solid ${isSelected ? areaColor : isToday ? areaColor + "88" : T.border}`, opacity: outside ? 0.4 : 1 }}
            >
              <span className="mono text-[10px]" style={{ color: isToday ? areaColor : T.text, fontWeight: isToday ? 700 : 500 }}>{date.getDate()}</span>
              <div className="flex flex-wrap gap-0.5 mt-auto">
                {dayTasks.slice(0, 3).map((t, j) => <span key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: priorityMeta(t.prioridad).color }} />)}
                {dayTasks.length > 3 && <span className="text-[8px] mono" style={{ color: "#94A3B8" }}>+{dayTasks.length - 3}</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl p-4" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
        <h4 className="disp text-sm font-semibold mb-3" style={{ color: T.text }}>
          {new Date(selectedDate + "T00:00:00").toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}
        </h4>
        {seleccionadas.length === 0 ? (
          <p className="text-xs" style={{ color: "#94A3B8" }}>Sin pendientes vigentes este día.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {seleccionadas.map((t) => {
              const pMeta = priorityMeta(t.prioridad);
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg" style={{ background: T.panelAlt }}>
                  <div className="min-w-0">
                    <p className="text-sm truncate" style={{ color: T.text }}>{t.titulo}</p>
                    <p className="text-[11px]" style={{ color: "#94A3B8" }}>
                      {COLUMNS.find((c) => c.id === t.estado)?.label}
                      {t.responsables?.length > 0 && ` · ${t.responsables.join(", ")}`}
                      {t.inicioCalc !== t.finCalc && ` · ${t.inicioCalc.slice(5)} al ${t.finCalc.slice(5)}`}
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: pMeta.color + "1A", color: pMeta.color }}>{pMeta.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- CONTENIDO (Grilla + Actividades + Ideas, por mes) ---------------------------------- */
const PLATAFORMAS_GRILLA = [
  { id: "facebook", label: "Facebook", color: "#2FB3FF" },
  { id: "instagram", label: "Instagram", color: "#EC4899" },
  { id: "tiktok", label: "TikTok", color: "#8CA0C7" },
  { id: "youtube", label: "YouTube", color: "#FF5C7A" },
];
const TIPOS_CONTENIDO_GRILLA = ["Post", "Story", "Reel", "Video", "Carrusel", "Otro"];
const ESTADOS_GRILLA_CONTENIDO = [
  { id: "planificado", label: "Planificado", color: "#8CA0C7" },
  { id: "en_diseno", label: "En diseño", color: "#FFB020" },
  { id: "listo", label: "Listo", color: "#2FB3FF" },
  { id: "publicado", label: "Publicado", color: "#20E4C0" },
];
const TIPOS_ACTIVIDAD_GRILLA = ["Evento", "Campaña", "Gestión", "Reunión", "Otro"];
const ESTADOS_GRILLA_ACTIVIDAD = [
  { id: "planificado", label: "Planificado", color: "#8CA0C7" },
  { id: "en_curso", label: "En curso", color: "#FFB020" },
  { id: "realizado", label: "Realizado", color: "#20E4C0" },
  { id: "cancelado", label: "Cancelado", color: "#FF5C7A" },
];
const ESTADOS_IDEA = [
  { id: "pendiente", label: "Pendiente de revisión", color: "#8CA0C7" },
  { id: "aprobada", label: "Aprobada", color: "#20E4C0" },
  { id: "producida", label: "Producida", color: "#2FB3FF" },
  { id: "descartada", label: "Descartada", color: "#FF5C7A" },
];
const TIPOS_GRILLA = [
  { id: "organica", label: "Orgánica", color: "#20E4C0" },
  { id: "pauta", label: "Pauta", color: "#FFB020" },
];

const emptyGrillaContenidoForm = { fecha: localISO(), tipoGrilla: "organica", plataformas: [], tipo: "Post", tema: "", estado: "planificado", responsable: "" };
const emptyGrillaActividadForm = { fecha: localISO(), actividad: "", tipo: "Evento", descripcion: "", estado: "planificado", responsable: "" };
const emptyIdeaForm = { texto: "", link: "", estado: "pendiente", responsable: "" };

// Calendario mensual reutilizable: agrupa items con .fecha en la grilla del mes y los pinta con un color por item.
function CalendarioMensual({ mes, items, colorDeItem, labelDeItem, onDia }) {
  const [year, month] = mes.split("-").map((n) => parseInt(n, 10));
  const grid = useMemo(() => getMonthGrid(year, month - 1), [year, month]);
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);

  const porDia = useMemo(() => {
    const map = {};
    items.forEach((it) => {
      if (!it.fecha) return;
      if (!map[it.fecha]) map[it.fecha] = [];
      map[it.fecha].push(it);
    });
    return map;
  }, [items]);

  const seleccionadas = diaSeleccionado ? (porDia[diaSeleccionado] || []) : [];

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 mb-4">
        {DIAS_SEMANA.map((d) => <div key={d} className="text-center text-[10px] font-semibold py-1" style={{ color: "#94A3B8" }}>{d}</div>)}
        {grid.map(({ date, outside }, i) => {
          const key = toKey(date);
          const dayItems = porDia[key] || [];
          const isToday = key === todayKey;
          const isSelected = key === diaSeleccionado;
          return (
            <button
              key={i}
              onClick={() => setDiaSeleccionado(isSelected ? null : key)}
              className="rounded-lg p-1 text-left flex flex-col transition-colors"
              style={{ minHeight: 62, background: isSelected ? T.blue + "12" : T.panel, border: `1px solid ${isSelected ? T.blue : isToday ? T.blue + "88" : T.border}`, opacity: outside ? 0.35 : 1 }}
            >
              <span className="mono text-[10px]" style={{ color: isToday ? T.blue : T.text, fontWeight: isToday ? 700 : 500 }}>{date.getDate()}</span>
              <div className="flex flex-col gap-0.5 mt-0.5">
                {dayItems.slice(0, 2).map((it, j) => (
                  <span key={j} className="text-[9px] px-1 py-0.5 rounded truncate" style={{ background: colorDeItem(it) + "22", color: colorDeItem(it) }}>
                    {labelDeItem(it)}
                  </span>
                ))}
                {dayItems.length > 2 && <span className="text-[8px] mono" style={{ color: "#94A3B8" }}>+{dayItems.length - 2} más</span>}
              </div>
            </button>
          );
        })}
      </div>

      {diaSeleccionado && (
        <div className="rounded-xl p-4" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
          <h4 className="disp text-sm font-semibold mb-3" style={{ color: T.text }}>
            {new Date(diaSeleccionado + "T00:00:00").toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}
          </h4>
          {seleccionadas.length === 0 ? (
            <p className="text-xs" style={{ color: "#94A3B8" }}>Nada programado este día.</p>
          ) : (
            <div className="flex flex-col gap-2">{seleccionadas.map((it) => onDia(it))}</div>
          )}
        </div>
      )}
    </div>
  );
}

function ContenidoPanel() {
  const [vista, setVista] = useState("grilla"); // grilla | actividades | ideas
  const [modoVista, setModoVista] = useState("lista"); // lista | calendario
  const [mes, setMes] = useState(() => localISO().slice(0, 7));
  const [contenido, setContenido] = useState(null);
  const [actividades, setActividades] = useState(null);
  const [ideas, setIdeas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formContenido, setFormContenido] = useState(emptyGrillaContenidoForm);
  const [formActividad, setFormActividad] = useState(emptyGrillaActividadForm);
  const [formIdea, setFormIdea] = useState(emptyIdeaForm);
  const [formError, setFormError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [filtroTipoGrilla, setFiltroTipoGrilla] = useState("todas"); // todas | organica | pauta
  const [aprobandoIdeaId, setAprobandoIdeaId] = useState(null);
  const [aprobarInputs, setAprobarInputs] = useState({ fecha: localISO(), tipoGrilla: "organica" });

  useEffect(() => {
    (async () => {
      try {
        const r1 = await window.storage.get("grilla-contenido", true);
        setContenido(r1 ? JSON.parse(r1.value) : []);
      } catch (e) {
        setContenido([]);
      }
      try {
        const r2 = await window.storage.get("grilla-actividades", true);
        setActividades(r2 ? JSON.parse(r2.value) : []);
      } catch (e) {
        setActividades([]);
      }
      try {
        const r3 = await window.storage.get("ideas-contenido", true);
        setIdeas(r3 ? JSON.parse(r3.value) : []);
      } catch (e) {
        setIdeas([]);
      }
      setLoading(false);
    })();
  }, []);

  const mesesDisponibles = useMemo(() => {
    const set = new Set();
    (contenido || []).forEach((c) => c.fecha && set.add(c.fecha.slice(0, 7)));
    (actividades || []).forEach((a) => a.fecha && set.add(a.fecha.slice(0, 7)));
    set.add(mes);
    return Array.from(set).sort();
  }, [contenido, actividades, mes]);

  const togglePlataforma = (id) => {
    setFormContenido((f) => ({
      ...f,
      plataformas: f.plataformas.includes(id) ? f.plataformas.filter((p) => p !== id) : [...f.plataformas, id],
    }));
  };

  const crearContenido = async () => {
    if (!formContenido.tema.trim()) { setFormError("Ponle un tema o título a la pieza."); return; }
    if (formContenido.plataformas.length === 0) { setFormError("Elige al menos una red social."); return; }
    const nuevo = { ...formContenido, id: uid(), creado: nowStamp() };
    const { next, ok } = await mutateShared("grilla-contenido", true, (current) => [nuevo, ...current]);
    setContenido(next);
    setSaveError(ok ? null : "No se pudo guardar. Intenta de nuevo.");
    setFormContenido(emptyGrillaContenidoForm);
    setFormError(null);
    setShowForm(false);
  };

  const crearActividad = async () => {
    if (!formActividad.actividad.trim()) { setFormError("Ponle un nombre a la actividad."); return; }
    const nueva = { ...formActividad, id: uid(), creado: nowStamp() };
    const { next, ok } = await mutateShared("grilla-actividades", true, (current) => [nueva, ...current]);
    setActividades(next);
    setSaveError(ok ? null : "No se pudo guardar. Intenta de nuevo.");
    setFormActividad(emptyGrillaActividadForm);
    setFormError(null);
    setShowForm(false);
  };

  const crearIdea = async () => {
    if (!formIdea.texto.trim()) { setFormError("Escribe la idea."); return; }
    const nueva = { ...formIdea, id: uid(), creado: nowStamp() };
    const { next, ok } = await mutateShared("ideas-contenido", true, (current) => [nueva, ...current]);
    setIdeas(next);
    setSaveError(ok ? null : "No se pudo guardar. Intenta de nuevo.");
    setFormIdea(emptyIdeaForm);
    setFormError(null);
    setShowForm(false);
  };

  const eliminarContenido = async (id) => {
    const { next, ok } = await mutateShared("grilla-contenido", true, (current) => current.filter((c) => c.id !== id));
    setContenido(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };
  const eliminarActividad = async (id) => {
    const { next, ok } = await mutateShared("grilla-actividades", true, (current) => current.filter((a) => a.id !== id));
    setActividades(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };
  const eliminarIdea = async (id) => {
    const { next, ok } = await mutateShared("ideas-contenido", true, (current) => current.filter((i) => i.id !== id));
    setIdeas(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };
  const cambiarEstadoContenido = async (id, estado) => {
    const { next, ok } = await mutateShared("grilla-contenido", true, (current) => current.map((c) => (c.id === id ? { ...c, estado } : c)));
    setContenido(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };
  const cambiarEstadoActividad = async (id, estado) => {
    const { next, ok } = await mutateShared("grilla-actividades", true, (current) => current.map((a) => (a.id === id ? { ...a, estado } : a)));
    setActividades(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };
  const cambiarEstadoIdea = async (id, estado) => {
    const { next, ok } = await mutateShared("ideas-contenido", true, (current) => current.map((i) => (i.id === id ? { ...i, estado } : i)));
    setIdeas(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };

  // Al aprobar una idea, se pide fecha + tipo de grilla y se crea automáticamente
  // la pieza correspondiente en la Grilla (así aparece de inmediato en el calendario).
  const iniciarAprobacionIdea = (idea) => {
    setAprobandoIdeaId(idea.id);
    setAprobarInputs({ fecha: localISO(), tipoGrilla: "organica" });
  };

  const confirmarAprobacionIdea = async (idea) => {
    const nuevaPieza = {
      id: uid(), fecha: aprobarInputs.fecha, tipoGrilla: aprobarInputs.tipoGrilla,
      plataformas: [], tipo: "Video", tema: idea.texto, estado: "planificado",
      responsable: idea.responsable || "", ideaOrigenId: idea.id, creado: nowStamp(),
    };
    const { next: nextContenido, ok: ok1 } = await mutateShared("grilla-contenido", true, (current) => [nuevaPieza, ...current]);
    setContenido(nextContenido);
    const { next: nextIdeas, ok: ok2 } = await mutateShared("ideas-contenido", true, (current) =>
      current.map((i) => (i.id === idea.id ? { ...i, estado: "aprobada", grillaGeneradaId: nuevaPieza.id, grillaFecha: nuevaPieza.fecha, grillaTipo: nuevaPieza.tipoGrilla } : i))
    );
    setIdeas(nextIdeas);
    if (!ok1 || !ok2) setSaveError("No se pudo guardar. Intenta de nuevo.");
    setAprobandoIdeaId(null);
  };

  const contenidoDelMes = useMemo(
    () => (contenido || [])
      .filter((c) => (c.fecha || "").slice(0, 7) === mes)
      .filter((c) => filtroTipoGrilla === "todas" || c.tipoGrilla === filtroTipoGrilla)
      .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "")),
    [contenido, mes, filtroTipoGrilla]
  );
  const actividadesDelMes = useMemo(
    () => (actividades || []).filter((a) => (a.fecha || "").slice(0, 7) === mes).sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "")),
    [actividades, mes]
  );

  const resumenContenido = useMemo(() => {
    const r = {};
    PLATAFORMAS_GRILLA.forEach((p) => { r[p.id] = contenidoDelMes.filter((c) => (c.plataformas || []).includes(p.id)).length; });
    return r;
  }, [contenidoDelMes]);

  const resumenIdeas = useMemo(() => {
    const list = ideas || [];
    const r = { total: list.length };
    ESTADOS_IDEA.forEach((s) => { r[s.id] = list.filter((i) => i.estado === s.id).length; });
    return r;
  }, [ideas]);

  if (loading) return <div className="text-sm" style={{ color: T.dim }}>Cargando…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="disp text-lg font-semibold" style={{ color: T.text }}>Contenido</h2>
          <p className="text-sm mt-1" style={{ color: T.dim }}>Grilla de redes, actividades del área e ideas de video, todo junto.</p>
        </div>
        {vista !== "ideas" && (
          <button onClick={() => { setFormError(null); setShowForm((s) => !s); }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-white shrink-0" style={{ background: showForm ? T.dim : T.blue }}>
            {showForm ? "Cancelar" : <><Plus size={16} strokeWidth={2.5} /> {vista === "grilla" ? "Nueva pieza" : "Nueva actividad"}</>}
          </button>
        )}
        {vista === "ideas" && (
          <button onClick={() => { setFormError(null); setShowForm((s) => !s); }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-white shrink-0" style={{ background: showForm ? T.dim : T.blue }}>
            {showForm ? "Cancelar" : <><Plus size={16} strokeWidth={2.5} /> Nueva idea</>}
          </button>
        )}
      </div>

      {saveError && <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: T.rose + "1F", color: T.rose }}>{saveError}</div>}

      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
        <div className="flex flex-wrap items-center gap-2">
          {[{ id: "grilla", label: "Grilla" }, { id: "actividades", label: "Actividades" }, { id: "ideas", label: "Ideas" }].map((v) => (
            <button
              key={v.id}
              onClick={() => { setVista(v.id); setShowForm(false); setFormError(null); }}
              className="text-xs font-medium px-3 py-1.5 rounded-full"
              style={{
                background: vista === v.id ? T.blue + "1F" : T.panelAlt,
                color: vista === v.id ? T.blue : T.dim,
                border: `1px solid ${vista === v.id ? T.blue + "66" : T.border}`,
              }}
            >
              {v.label}
            </button>
          ))}
          {vista !== "ideas" && (
            <>
              <span className="w-px h-4 mx-1" style={{ background: T.border }} />
              <select value={mes} onChange={(e) => setMes(e.target.value)} className="text-xs">
                {mesesDisponibles.map((m) => <option key={m} value={m}>{labelMes(m)}</option>)}
              </select>
            </>
          )}
        </div>
        {vista !== "ideas" && (
          <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: T.panelAlt, border: `1px solid ${T.border}` }}>
            {[{ id: "lista", label: "Lista" }, { id: "calendario", label: "Calendario" }].map((m) => (
              <button
                key={m.id}
                onClick={() => setModoVista(m.id)}
                className="text-[11px] font-medium px-2.5 py-1.5 rounded-md"
                style={{ background: modoVista === m.id ? T.blue : "transparent", color: modoVista === m.id ? "#FFF" : T.dim }}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {vista === "grilla" && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {[{ id: "todas", label: "Todas" }, ...TIPOS_GRILLA.map((t) => ({ id: t.id, label: `Grilla ${t.label}` }))].map((t) => (
              <button
                key={t.id}
                onClick={() => setFiltroTipoGrilla(t.id)}
                className="text-xs font-medium px-3 py-1.5 rounded-full"
                style={{
                  background: filtroTipoGrilla === t.id ? T.blue + "1F" : T.panelAlt,
                  color: filtroTipoGrilla === t.id ? T.blue : T.dim,
                  border: `1px solid ${filtroTipoGrilla === t.id ? T.blue + "66" : T.border}`,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {PLATAFORMAS_GRILLA.map((p) => (
              <StatCard key={p.id} icon={<CalendarDays size={16} />} label={p.label} value={resumenContenido[p.id] || 0} color={p.color} />
            ))}
          </div>

          {showForm && (
            <div className="rounded-xl p-5 mb-5" style={{ background: T.panel, border: `1px solid ${T.blue}55` }}>
              <h3 className="disp text-sm font-semibold mb-4" style={{ color: T.text }}>Nueva pieza de contenido</h3>
              {formError && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: T.rose + "1F", color: T.rose }}>{formError}</div>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs" style={{ color: T.dim }}>
                  Fecha
                  <input type="date" className="w-full mt-1" value={formContenido.fecha} onChange={(e) => setFormContenido({ ...formContenido, fecha: e.target.value })} />
                </label>
                <label className="text-xs" style={{ color: T.dim }}>
                  Tipo de contenido
                  <select className="w-full mt-1" value={formContenido.tipo} onChange={(e) => setFormContenido({ ...formContenido, tipo: e.target.value })}>
                    {TIPOS_CONTENIDO_GRILLA.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="text-xs" style={{ color: T.dim }}>
                  Grilla
                  <select className="w-full mt-1" value={formContenido.tipoGrilla} onChange={(e) => setFormContenido({ ...formContenido, tipoGrilla: e.target.value })}>
                    {TIPOS_GRILLA.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </label>
                <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
                  Tema / título *
                  <input className="w-full mt-1" placeholder="Ej. Beneficios del procedimiento X" value={formContenido.tema} onChange={(e) => setFormContenido({ ...formContenido, tema: e.target.value })} />
                </label>
                <div className="md:col-span-2">
                  <p className="text-xs mb-1.5" style={{ color: T.dim }}>Redes sociales *</p>
                  <div className="flex flex-wrap gap-2">
                    {PLATAFORMAS_GRILLA.map((p) => {
                      const activo = formContenido.plataformas.includes(p.id);
                      return (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => togglePlataforma(p.id)}
                          className="text-xs font-medium px-3 py-1.5 rounded-full"
                          style={{ background: activo ? p.color + "22" : T.panelAlt, color: activo ? p.color : T.dim, border: `1px solid ${activo ? p.color + "66" : T.border}` }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label className="text-xs" style={{ color: T.dim }}>
                  Estado
                  <select className="w-full mt-1" value={formContenido.estado} onChange={(e) => setFormContenido({ ...formContenido, estado: e.target.value })}>
                    {ESTADOS_GRILLA_CONTENIDO.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </label>
                <label className="text-xs" style={{ color: T.dim }}>
                  Responsable
                  <input className="w-full mt-1" placeholder="Nombre" value={formContenido.responsable} onChange={(e) => setFormContenido({ ...formContenido, responsable: e.target.value })} />
                </label>
              </div>
              <div className="flex gap-2 mt-5">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg font-medium text-sm" style={{ background: T.panelAlt, color: T.dim }}>Cancelar</button>
                <button type="button" onClick={crearContenido} className="flex-1 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.blue }}>Guardar</button>
              </div>
            </div>
          )}

          {modoVista === "calendario" ? (
            <CalendarioMensual
              mes={mes}
              items={contenidoDelMes}
              colorDeItem={(c) => (TIPOS_GRILLA.find((x) => x.id === c.tipoGrilla) || TIPOS_GRILLA[0]).color}
              labelDeItem={(c) => c.tema}
              onDia={(c) => {
                const estado = ESTADOS_GRILLA_CONTENIDO.find((s) => s.id === c.estado) || ESTADOS_GRILLA_CONTENIDO[0];
                const tipoG = TIPOS_GRILLA.find((x) => x.id === c.tipoGrilla) || TIPOS_GRILLA[0];
                return (
                  <div key={c.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg" style={{ background: T.panelAlt }}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm truncate" style={{ color: T.text }}>{c.tema}</p>
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: tipoG.color + "1A", color: tipoG.color }}>{tipoG.label}</span>
                      </div>
                      <p className="text-[11px]" style={{ color: "#94A3B8" }}>{c.tipo}{c.responsable ? ` · ${c.responsable}` : ""}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: estado.color + "1A", color: estado.color }}>{estado.label}</span>
                  </div>
                );
              }}
            />
          ) : contenidoDelMes.length === 0 ? (
            <div className="text-sm text-center py-10 rounded-lg" style={{ color: "#94A3B8", border: `1px dashed ${T.border}` }}>No hay contenido programado para {labelMes(mes)}.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {contenidoDelMes.map((c) => {
                const estado = ESTADOS_GRILLA_CONTENIDO.find((s) => s.id === c.estado) || ESTADOS_GRILLA_CONTENIDO[0];
                const tipoG = TIPOS_GRILLA.find((x) => x.id === c.tipoGrilla) || TIPOS_GRILLA[0];
                return (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                    <span className="text-xs mono shrink-0" style={{ color: T.dim, width: 60 }}>{c.fecha ? c.fecha.slice(5) : "—"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium truncate" style={{ color: T.text }}>{c.tema}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: tipoG.color + "1A", color: tipoG.color }}>{tipoG.label}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: T.slate + "44", color: T.dim }}>{c.tipo}</span>
                        {(c.plataformas || []).map((pid) => {
                          const p = PLATAFORMAS_GRILLA.find((x) => x.id === pid);
                          return p ? <span key={pid} className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: p.color + "1A", color: p.color }}>{p.label}</span> : null;
                        })}
                      </div>
                      {c.responsable && <span className="text-[11px]" style={{ color: "#8CA0C7" }}>{c.responsable}</span>}
                    </div>
                    <select value={c.estado} onChange={(e) => cambiarEstadoContenido(c.id, e.target.value)} className="text-[11px] font-semibold px-2 py-1 rounded-full shrink-0" style={{ background: estado.color + "22", color: estado.color, border: `1px solid ${estado.color}55` }}>
                      {ESTADOS_GRILLA_CONTENIDO.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                    <button onClick={() => eliminarContenido(c.id)}><Trash2 size={13} color={T.rose} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {vista === "actividades" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {ESTADOS_GRILLA_ACTIVIDAD.map((s) => (
              <StatCard key={s.id} icon={<Calendar size={16} />} label={s.label} value={actividadesDelMes.filter((a) => a.estado === s.id).length} color={s.color} />
            ))}
          </div>

          {showForm && (
            <div className="rounded-xl p-5 mb-5" style={{ background: T.panel, border: `1px solid ${T.blue}55` }}>
              <h3 className="disp text-sm font-semibold mb-4" style={{ color: T.text }}>Nueva actividad</h3>
              {formError && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: T.rose + "1F", color: T.rose }}>{formError}</div>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs" style={{ color: T.dim }}>
                  Fecha
                  <input type="date" className="w-full mt-1" value={formActividad.fecha} onChange={(e) => setFormActividad({ ...formActividad, fecha: e.target.value })} />
                </label>
                <label className="text-xs" style={{ color: T.dim }}>
                  Tipo
                  <select className="w-full mt-1" value={formActividad.tipo} onChange={(e) => setFormActividad({ ...formActividad, tipo: e.target.value })}>
                    {TIPOS_ACTIVIDAD_GRILLA.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
                  Actividad *
                  <input className="w-full mt-1" placeholder="Ej. Evento aniversario sede San Isidro" value={formActividad.actividad} onChange={(e) => setFormActividad({ ...formActividad, actividad: e.target.value })} />
                </label>
                <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
                  Descripción
                  <textarea rows={2} className="w-full mt-1 resize-none" value={formActividad.descripcion} onChange={(e) => setFormActividad({ ...formActividad, descripcion: e.target.value })} />
                </label>
                <label className="text-xs" style={{ color: T.dim }}>
                  Estado
                  <select className="w-full mt-1" value={formActividad.estado} onChange={(e) => setFormActividad({ ...formActividad, estado: e.target.value })}>
                    {ESTADOS_GRILLA_ACTIVIDAD.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </label>
                <label className="text-xs" style={{ color: T.dim }}>
                  Responsable
                  <input className="w-full mt-1" placeholder="Nombre" value={formActividad.responsable} onChange={(e) => setFormActividad({ ...formActividad, responsable: e.target.value })} />
                </label>
              </div>
              <div className="flex gap-2 mt-5">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg font-medium text-sm" style={{ background: T.panelAlt, color: T.dim }}>Cancelar</button>
                <button type="button" onClick={crearActividad} className="flex-1 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.blue }}>Guardar</button>
              </div>
            </div>
          )}

          {modoVista === "calendario" ? (
            <CalendarioMensual
              mes={mes}
              items={actividadesDelMes}
              colorDeItem={(a) => (ESTADOS_GRILLA_ACTIVIDAD.find((s) => s.id === a.estado) || ESTADOS_GRILLA_ACTIVIDAD[0]).color}
              labelDeItem={(a) => a.actividad}
              onDia={(a) => {
                const estado = ESTADOS_GRILLA_ACTIVIDAD.find((s) => s.id === a.estado) || ESTADOS_GRILLA_ACTIVIDAD[0];
                return (
                  <div key={a.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg" style={{ background: T.panelAlt }}>
                    <div className="min-w-0">
                      <p className="text-sm truncate" style={{ color: T.text }}>{a.actividad}</p>
                      <p className="text-[11px]" style={{ color: "#94A3B8" }}>{a.tipo}{a.responsable ? ` · ${a.responsable}` : ""}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: estado.color + "1A", color: estado.color }}>{estado.label}</span>
                  </div>
                );
              }}
            />
          ) : actividadesDelMes.length === 0 ? (
            <div className="text-sm text-center py-10 rounded-lg" style={{ color: "#94A3B8", border: `1px dashed ${T.border}` }}>No hay actividades programadas para {labelMes(mes)}.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {actividadesDelMes.map((a) => {
                const estado = ESTADOS_GRILLA_ACTIVIDAD.find((s) => s.id === a.estado) || ESTADOS_GRILLA_ACTIVIDAD[0];
                return (
                  <div key={a.id} className="rounded-lg px-4 py-3" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs mono shrink-0" style={{ color: T.dim, width: 60 }}>{a.fecha ? a.fecha.slice(5) : "—"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium" style={{ color: T.text }}>{a.actividad}</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: T.slate + "44", color: T.dim }}>{a.tipo}</span>
                        </div>
                        {a.responsable && <span className="text-[11px]" style={{ color: "#8CA0C7" }}>{a.responsable}</span>}
                      </div>
                      <select value={a.estado} onChange={(e) => cambiarEstadoActividad(a.id, e.target.value)} className="text-[11px] font-semibold px-2 py-1 rounded-full shrink-0" style={{ background: estado.color + "22", color: estado.color, border: `1px solid ${estado.color}55` }}>
                        {ESTADOS_GRILLA_ACTIVIDAD.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                      <button onClick={() => eliminarActividad(a.id)}><Trash2 size={13} color={T.rose} /></button>
                    </div>
                    {a.descripcion && <p className="text-xs mt-2 ml-[72px]" style={{ color: T.dim }}>{a.descripcion}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {vista === "ideas" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard icon={<ClipboardList size={16} />} label="Total de ideas" value={resumenIdeas.total} color={T.blue} />
            <StatCard icon={<AlertTriangle size={16} />} label="Pendientes de revisión" value={resumenIdeas.pendiente || 0} color={T.dim} />
            <StatCard icon={<CheckCircle2 size={16} />} label="Aprobadas" value={resumenIdeas.aprobada || 0} color={T.teal} />
            <StatCard icon={<Flag size={16} />} label="Producidas" value={resumenIdeas.producida || 0} color={T.blue} />
          </div>

          {showForm && (
            <div className="rounded-xl p-5 mb-5" style={{ background: T.panel, border: `1px solid ${T.blue}55` }}>
              <h3 className="disp text-sm font-semibold mb-4" style={{ color: T.text }}>Nueva idea de video</h3>
              {formError && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: T.rose + "1F", color: T.rose }}>{formError}</div>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
                  Idea *
                  <textarea rows={2} className="w-full mt-1 resize-none" placeholder="Describe la idea del video…" value={formIdea.texto} onChange={(e) => setFormIdea({ ...formIdea, texto: e.target.value })} />
                </label>
                <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
                  Enlace de referencia (opcional)
                  <input className="w-full mt-1" placeholder="https://www.instagram.com/reel/…" value={formIdea.link} onChange={(e) => setFormIdea({ ...formIdea, link: e.target.value })} />
                </label>
                <label className="text-xs" style={{ color: T.dim }}>
                  Estado
                  <select className="w-full mt-1" value={formIdea.estado} onChange={(e) => setFormIdea({ ...formIdea, estado: e.target.value })}>
                    {ESTADOS_IDEA.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </label>
                <label className="text-xs" style={{ color: T.dim }}>
                  Responsable / quién la propuso
                  <input className="w-full mt-1" placeholder="Nombre" value={formIdea.responsable} onChange={(e) => setFormIdea({ ...formIdea, responsable: e.target.value })} />
                </label>
              </div>
              <div className="flex gap-2 mt-5">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg font-medium text-sm" style={{ background: T.panelAlt, color: T.dim }}>Cancelar</button>
                <button type="button" onClick={crearIdea} className="flex-1 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.blue }}>Guardar</button>
              </div>
            </div>
          )}

          {(ideas || []).length === 0 ? (
            <div className="text-sm text-center py-10 rounded-lg" style={{ color: "#94A3B8", border: `1px dashed ${T.border}` }}>Todavía no hay ideas registradas.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {ideas.map((i) => {
                const estado = ESTADOS_IDEA.find((s) => s.id === i.estado) || ESTADOS_IDEA[0];
                const aprobando = aprobandoIdeaId === i.id;
                const tipoGDeLaIdea = i.grillaTipo ? TIPOS_GRILLA.find((t) => t.id === i.grillaTipo) : null;
                return (
                  <div key={i.id} className="rounded-lg px-4 py-3" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm flex-1" style={{ color: T.text }}>{i.texto}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={i.estado}
                          onChange={(e) => {
                            if (e.target.value === "aprobada" && i.estado !== "aprobada") iniciarAprobacionIdea(i);
                            else cambiarEstadoIdea(i.id, e.target.value);
                          }}
                          className="text-[11px] font-semibold px-2 py-1 rounded-full"
                          style={{ background: estado.color + "22", color: estado.color, border: `1px solid ${estado.color}55` }}
                        >
                          {ESTADOS_IDEA.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                        <button onClick={() => eliminarIdea(i.id)}><Trash2 size={13} color={T.rose} /></button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-1.5">
                      {i.responsable && <span className="text-[11px]" style={{ color: "#8CA0C7" }}>{i.responsable}</span>}
                      {i.link && <a href={i.link} target="_blank" rel="noreferrer" className="text-[11px] font-medium flex items-center gap-1" style={{ color: T.blue }}><Link2 size={11} /> Ver referencia</a>}
                      {tipoGDeLaIdea && (
                        <span className="text-[11px] font-medium" style={{ color: tipoGDeLaIdea.color }}>
                          → Programada en Grilla {tipoGDeLaIdea.label} el {i.grillaFecha}
                        </span>
                      )}
                    </div>

                    {aprobando && (
                      <div className="mt-3 p-3 rounded-lg flex flex-wrap items-end gap-3" style={{ background: T.panelAlt, border: `1px solid ${T.border}` }}>
                        <label className="text-xs" style={{ color: T.dim }}>
                          Fecha para la Grilla
                          <input type="date" className="w-full mt-1" value={aprobarInputs.fecha} onChange={(e) => setAprobarInputs({ ...aprobarInputs, fecha: e.target.value })} />
                        </label>
                        <label className="text-xs" style={{ color: T.dim }}>
                          Tipo de grilla
                          <select className="w-full mt-1" value={aprobarInputs.tipoGrilla} onChange={(e) => setAprobarInputs({ ...aprobarInputs, tipoGrilla: e.target.value })}>
                            {TIPOS_GRILLA.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                          </select>
                        </label>
                        <button onClick={() => setAprobandoIdeaId(null)} className="text-xs font-medium px-3 py-2 rounded-lg" style={{ background: T.panel, color: T.dim }}>Cancelar</button>
                        <button onClick={() => confirmarAprobacionIdea(i)} className="text-xs font-medium px-3 py-2 rounded-lg text-white" style={{ background: T.blue }}>Aprobar y agendar</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PendientesPanel({ initialDept, permisos }) {
  const [tasks, setTasks] = useState(null);
  const [tickets, setTickets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeDept] = useState(initialDept || "bandeja"); // fija: cada vista se navega directo desde el menú "Gestión", no se cambia desde dentro
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(makeEmptyTaskForm("gerencia"));
  const [editingId, setEditingId] = useState(null);
  const [ticketForm, setTicketForm] = useState(emptyTicketForm);
  const [responsableInput, setResponsableInput] = useState("");
  const [formError, setFormError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [vistaPendientes, setVistaPendientes] = useState("tablero");
  const COLUMNAS_COLAPSABLES = ["todo", "revision", "done", "suspendido"];
  const [columnasVisibles, setColumnasVisibles] = useState([]); // ids extra que el usuario decidió mostrar
  const [menuColumnasAbierto, setMenuColumnasAbierto] = useState(false);
  const [ordenAsc, setOrdenAsc] = useState(true);
  const TASK_COLORS = [T.blue, T.amber, T.purple, T.teal, T.rose];
  const colorDeTarea = (id) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % TASK_COLORS.length;
    return TASK_COLORS[hash];
  };
  const etiquetaDias = (fecha, estado) => {
    if (!fecha || estado === "done" || estado === "suspendido") return null;
    const hoy = new Date(new Date().toDateString());
    const f = new Date(fecha + "T00:00:00");
    const dias = Math.round((f - hoy) / 86400000);
    if (dias < 0) return { texto: `Vencido hace ${Math.abs(dias)}d`, color: T.rose };
    if (dias === 0) return { texto: "Vence hoy", color: T.rose };
    if (dias <= 3) return { texto: `${dias} día${dias === 1 ? "" : "s"} restante${dias === 1 ? "" : "s"}`, color: T.amber };
    return { texto: `${dias} días restantes`, color: T.teal };
  };
  const inicialesDe = (nombre) => (nombre || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const esTotal = !permisos || permisos.acceso === "total";

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("marketing-tasks-v2", true);
        setTasks(res ? JSON.parse(res.value) : []);
      } catch (e) {
        setTasks([]);
      } finally {
        setLoading(false);
      }
    })();
    (async () => {
      try {
        const res = await window.storage.get("ticket-inbox", true);
        setTickets(res ? JSON.parse(res.value) : []);
      } catch (e) {
        setTickets([]);
      }
    })();
  }, []);

  const persist = useCallback(async (next) => {
    setTasks(next);
    try {
      const res = await window.storage.set("marketing-tasks-v2", JSON.stringify(next), true);
      setSaveError(res ? null : "No se pudo guardar en el servidor. El cambio se ve localmente, pero intenta de nuevo para que se guarde.");
    } catch (e) {
      setSaveError("No se pudo guardar en el servidor. El cambio se ve localmente, pero intenta de nuevo para que se guarde.");
    }
  }, []);

  const persistTickets = useCallback(async (next) => {
    setTickets(next);
    try {
      const res = await window.storage.set("ticket-inbox", JSON.stringify(next), true);
      setSaveError(res ? null : "No se pudo guardar el ticket. Intenta de nuevo.");
    } catch (e) {
      setSaveError("No se pudo guardar el ticket. Intenta de nuevo.");
    }
  }, []);

  const addTicket = async () => {
    if (!ticketForm.titulo.trim()) { setFormError("Ponle un título al pendiente."); return; }
    if (!ticketForm.areaOrigen.trim()) { setFormError("Indica qué área o persona lo reporta."); return; }
    const nuevoTicket = { ...ticketForm, id: uid(), creado: nowStamp() };
    const { next, ok } = await mutateShared("ticket-inbox", true, (current) => [nuevoTicket, ...current]);
    setTickets(next);
    setSaveError(ok ? null : "No se pudo guardar en el servidor. Intenta de nuevo.");
    setTicketForm(emptyTicketForm);
    setFormError(null);
    setShowForm(false);
  };

  const assignTicket = async (ticket, departamentoDestino) => {
    const nuevaTareaId = uid();
    const nuevaTarea = {
      id: nuevaTareaId,
      titulo: ticket.titulo,
      descripcion: `${ticket.descripcion || ""}${ticket.descripcion ? " — " : ""}Reportado por: ${ticket.nombreReporta || "sin nombre"} (${ticket.areaOrigen})`.trim(),
      responsables: [],
      fecha: "",
      prioridad: "media",
      departamento: departamentoDestino,
      estado: "todo",
      creado: nowStamp(),
      archivosCount: ticket.foto ? 1 : 0,
    };
    const tareasRes = await mutateShared("marketing-tasks-v2", true, (current) => [nuevaTarea, ...current]);
    setTasks(tareasRes.next);
    const ticketsRes = await mutateShared("ticket-inbox", true, (current) => current.filter((t) => t.id !== ticket.id));
    setTickets(ticketsRes.next);
    if (!tareasRes.ok || !ticketsRes.ok) setSaveError("No se pudo guardar en el servidor. Intenta de nuevo.");
    if (ticket.foto) {
      try {
        await window.storage.set(`task-files:${nuevaTareaId}`, JSON.stringify([{ id: uid(), name: "foto-ticket.jpg", type: "image", dataUrl: ticket.foto, addedAt: nowStamp() }]), true);
      } catch (e) { /* no-op */ }
    }
  };

  const dismissTicket = async (id) => {
    const { next, ok } = await mutateShared("ticket-inbox", true, (current) => current.filter((t) => t.id !== id));
    setTickets(next);
    if (!ok) setSaveError("No se pudo guardar en el servidor. Intenta de nuevo.");
  };

  const [reunionAgendada, setReunionAgendada] = useState({});
  const agendarReunion = async (ticket) => {
    try {
      const res = await window.storage.get("calendar-events", true);
      const actuales = res ? JSON.parse(res.value) : [];
      const nuevoEvento = {
        id: uid(),
        tipo: "reunion",
        titulo: `Reunión: ${ticket.titulo}`,
        inicio: ticket.fechaPropuesta,
        fin: ticket.fechaPropuesta,
        area: "general",
        descripcion: `Propuesta por ${ticket.nombreReporta || "sin nombre"} (${ticket.areaOrigen}). Confirmar fecha/hora final.`,
      };
      await window.storage.set("calendar-events", JSON.stringify([nuevoEvento, ...actuales]), true);
      setReunionAgendada((prev) => ({ ...prev, [ticket.id]: true }));
    } catch (e) {
      setSaveError("No se pudo agendar la reunión. Intenta de nuevo.");
    }
  };

  const saveTask = async () => {
    if (!form.titulo.trim()) {
      setFormError("Ponle un título a la tarea antes de guardar.");
      return;
    }
    if (form.fecha && form.fechaInicio && form.fecha < form.fechaInicio) {
      setFormError("La fecha de fin no puede ser anterior a la fecha de inicio.");
      return;
    }
    if (form.esEmergencia && (!form.sustentoEmergencia.trim() || !form.solicitadoPor.trim())) {
      setFormError("Para marcarla como emergencia, completa el sustento y quién la solicita.");
      return;
    }
    if (editingId) {
      const { next, ok } = await mutateShared("marketing-tasks-v2", true, (current) =>
        current.map((t) => (t.id === editingId ? { ...t, ...form } : t))
      );
      setTasks(next);
      setSaveError(ok ? null : "No se pudo guardar en el servidor. Intenta de nuevo.");
    } else {
      const nuevoId = uid();
      const nuevaTarea = { ...form, id: nuevoId, estado: "todo", creado: nowStamp() };
      const { next, ok } = await mutateShared("marketing-tasks-v2", true, (current) => [nuevaTarea, ...current]);
      setTasks(next);
      setSaveError(ok ? null : "No se pudo guardar en el servidor. Intenta de nuevo.");
      // Deja la tarea recién creada en modo edición para poder adjuntar archivos al toque
      setEditingId(nuevoId);
      setForm({ ...form });
      setResponsableInput("");
      setFormError(null);
      return;
    }
    setForm(makeEmptyTaskForm(activeDept));
    setResponsableInput("");
    setFormError(null);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (task) => {
    setForm({
      titulo: task.titulo, descripcion: task.descripcion || "", responsables: task.responsables || [],
      fechaInicio: task.fechaInicio || localISO(new Date(task.creado || Date.now())), fecha: task.fecha || "",
      horaInicio: task.horaInicio || "", horaFin: task.horaFin || "",
      prioridad: task.prioridad || "media", departamento: task.departamento,
      esEmergencia: task.esEmergencia || false, sustentoEmergencia: task.sustentoEmergencia || "",
      solicitadoPor: task.solicitadoPor || "", firmaSolicitante: task.firmaSolicitante || null,
    });
    setEditingId(task.id);
    setResponsableInput("");
    setFormError(null);
    setShowForm(true);
  };

  const moveTask = async (id, estado, motivo) => {
    const { next, ok } = await mutateShared("marketing-tasks-v2", true, (current) =>
      current.map((t) => (t.id === id ? {
        ...t, estado, estadoActualizadoEn: nowStamp(),
        ...(estado === "suspendido" ? { motivoSuspension: motivo || t.motivoSuspension || "" } : {}),
        // Al reenviar a Revisión (por ejemplo, tras una corrección), se reinicia el ciclo:
        // se limpia la decisión anterior para que el enlace vuelva a estar disponible.
        ...(estado === "revision" ? { revisionEstado: null, comentarioRevision: "", revisadoPorNombre: "", revisadoEn: null } : {}),
      } : t))
    );
    setTasks(next);
    if (!ok) setSaveError("No se pudo guardar en el servidor. Intenta de nuevo.");
  };
  const moveTaskConMotivo = (id, estado) => {
    if (estado === "suspendido") {
      const motivo = window.prompt("¿Por qué se suspende esta tarea? (queda registrado en los reportes)");
      if (motivo === null) return; // canceló
      moveTask(id, estado, motivo.trim());
    } else {
      moveTask(id, estado);
    }
  };
  const removeTask = async (id) => {
    const { next, ok } = await mutateShared("marketing-tasks-v2", true, (current) => current.filter((t) => t.id !== id));
    setTasks(next);
    if (!ok) setSaveError("No se pudo guardar en el servidor. Intenta de nuevo.");
  };
  const onDrop = (colId) => { if (dragId) moveTaskConMotivo(dragId, colId); setDragId(null); setDragOverCol(null); };
  const isOverdue = (fecha, estado) => estado !== "done" && estado !== "suspendido" && fecha && new Date(fecha) < new Date(new Date().toDateString());

  const [enlaceVisibleId, setEnlaceVisibleId] = useState(null); // muestra el campo con el enlace listo para copiar a mano
  const [enlaceCopiadoId, setEnlaceCopiadoId] = useState(null);
  const enlaceInputRefs = useRef({});

  const generarEnlaceRevision = (taskId) => {
    const base = typeof window !== "undefined" ? window.location.href.split("#")[0] : "";
    return `${base}#revisar-${taskId}`;
  };

  const copiarEnlaceRevision = async (taskId) => {
    const enlace = generarEnlaceRevision(taskId);
    let copiado = false;

    // Intento 1: API moderna del portapapeles (solo funciona en https/localhost, NO en file://)
    if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(enlace);
        copiado = true;
      } catch (e) { /* sigue al siguiente intento */ }
    }

    // Intento 2: método clásico execCommand — sí funciona abriendo el archivo directo (file://)
    if (!copiado) {
      try {
        const temp = document.createElement("textarea");
        temp.value = enlace;
        temp.style.position = "fixed";
        temp.style.opacity = "0";
        document.body.appendChild(temp);
        temp.focus();
        temp.select();
        copiado = document.execCommand("copy");
        document.body.removeChild(temp);
      } catch (e) { /* sigue al respaldo visible */ }
    }

    // Siempre mostramos el campo con el enlace, seleccionado, por si el copiado automático no funcionó
    setEnlaceVisibleId(taskId);
    setTimeout(() => {
      const input = enlaceInputRefs.current[taskId];
      if (input) { input.focus(); input.select(); }
    }, 50);

    if (copiado) {
      setEnlaceCopiadoId(taskId);
      setTimeout(() => setEnlaceCopiadoId((cur) => (cur === taskId ? null : cur)), 2500);
    }
  };
  const deptTasks = useMemo(() => (tasks || []).filter((t) => t.departamento === activeDept), [tasks, activeDept]);

  const kpisByDept = useMemo(() => {
    const map = {};
    DEPARTAMENTOS.forEach((d) => {
      const list = (tasks || []).filter((t) => t.departamento === d.id);
      const done = list.filter((t) => t.estado === "done").length;
      const overdue = list.filter((t) => isOverdue(t.fecha, t.estado)).length;
      map[d.id] = { total: list.length, done, overdue, cumplimiento: list.length ? Math.round((done / list.length) * 100) : 0 };
    });
    return map;
  }, [tasks]);

  const openForm = () => {
    if (activeDept === "bandeja") setTicketForm(emptyTicketForm);
    else setForm(makeEmptyTaskForm(activeDept));
    setEditingId(null);
    setResponsableInput("");
    setFormError(null);
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); setFormError(null); };

  const addResponsable = () => {
    const name = responsableInput.trim();
    if (!name) return;
    if (!form.responsables.includes(name)) setForm({ ...form, responsables: [...form.responsables, name] });
    setResponsableInput("");
  };
  const removeResponsable = (name) => setForm({ ...form, responsables: form.responsables.filter((r) => r !== name) });

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <p className="text-sm" style={{ color: T.dim }}>
          {activeDept === "bandeja" ? "Pendientes que reportan otras áreas, listos para asignar." : "Un tablero por área, con KPIs de cumplimiento."}
        </p>
        <button onClick={showForm ? closeForm : openForm} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-white transition-transform hover:scale-[1.02]" style={{ background: showForm ? T.dim : (activeDept === "bandeja" ? T.rose : T.blue) }}>
          {showForm ? <>Cancelar</> : <><Plus size={16} strokeWidth={2.5} /> {activeDept === "bandeja" ? "Reportar pendiente" : "Nueva tarea"}</>}
        </button>
      </div>

      {saveError && (
        <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: (T.rose + "1F"), color: T.rose, border: `1px solid ${T.rose}33` }}>
          {saveError}
        </div>
      )}

      {showForm && activeDept === "bandeja" && (
        <div className="rounded-xl p-5 mb-6" style={{ background: T.panel, border: `1px solid ${T.rose}55`, boxShadow: "0 1px 3px rgba(15,23,42,0.06)" }}>
          <h3 className="disp text-sm font-semibold mb-1" style={{ color: T.text }}>Reportar un pendiente de otra área</h3>
          <p className="text-xs mb-4" style={{ color: "#94A3B8" }}>Este ticket no tiene fecha de finalización — el equipo de Marketing lo asignará luego a la persona y semana que corresponda.</p>
          {formError && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: (T.rose + "1F"), color: T.rose, border: `1px solid ${T.rose}33` }}>{formError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              ¿Qué necesitas? *
              <input className="w-full mt-1" placeholder="Ej. Necesitamos banner para promoción de julio" value={ticketForm.titulo} onChange={(e) => setTicketForm({ ...ticketForm, titulo: e.target.value })} />
            </label>
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              Detalles
              <textarea rows={2} className="w-full mt-1 resize-none" placeholder="Contexto opcional" value={ticketForm.descripcion} onChange={(e) => setTicketForm({ ...ticketForm, descripcion: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Área o sede que reporta *
              <input className="w-full mt-1" placeholder="Ej. Recepción San Isidro" value={ticketForm.areaOrigen} onChange={(e) => setTicketForm({ ...ticketForm, areaOrigen: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Tu nombre
              <input className="w-full mt-1" placeholder="Opcional" value={ticketForm.nombreReporta} onChange={(e) => setTicketForm({ ...ticketForm, nombreReporta: e.target.value })} />
            </label>
            <label className="md:col-span-2 flex items-center gap-2 text-xs pt-1" style={{ color: T.dim }}>
              <input type="checkbox" className="w-auto" checked={ticketForm.requiereReunion} onChange={(e) => setTicketForm({ ...ticketForm, requiereReunion: e.target.checked })} />
              ¿Amerita una reunión?
            </label>
            {ticketForm.requiereReunion && (
              <label className="text-xs" style={{ color: T.dim }}>
                Fecha propuesta
                <input type="date" className="w-full mt-1" value={ticketForm.fechaPropuesta} onChange={(e) => setTicketForm({ ...ticketForm, fechaPropuesta: e.target.value })} />
              </label>
            )}
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              Foto (opcional)
              <div className="flex items-center gap-2 mt-1">
                <input type="file" accept="image/*" id="ticket-foto-input" className="hidden" onChange={(e) => { if (e.target.files?.[0]) comprimirImagen(e.target.files[0], (dataUrl) => setTicketForm((f) => ({ ...f, foto: dataUrl }))); }} />
                <label htmlFor="ticket-foto-input" className="cursor-pointer flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg" style={{ background: T.panelAlt, color: T.rose, border: `1px solid ${T.border}` }}>
                  <ImagePlus size={13} /> {ticketForm.foto ? "Cambiar foto" : "Adjuntar foto"}
                </label>
                {ticketForm.foto && <img src={ticketForm.foto} alt="Adjunto" className="w-10 h-10 rounded-md object-cover" style={{ border: `1px solid ${T.border}` }} />}
              </div>
            </label>
          </div>
          <div className="flex gap-2 mt-5">
            <button type="button" onClick={closeForm} className="flex-1 py-2.5 rounded-lg font-medium text-sm" style={{ background: T.panelAlt, color: T.dim }}>Cancelar</button>
            <button type="button" onClick={addTicket} className="flex-1 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.rose }}>Enviar pendiente</button>
          </div>
        </div>
      )}

      {showForm && activeDept !== "bandeja" && (
        <div className="rounded-xl p-5 mb-6" style={{ background: T.panel, border: `1px solid ${T.blue}55`, boxShadow: "0 1px 3px rgba(15,23,42,0.06)" }}>
          <h3 className="disp text-sm font-semibold mb-4" style={{ color: T.text }}>{editingId ? "Editar tarea" : "Nueva tarea"}</h3>
          {formError && (
            <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: (T.rose + "1F"), color: T.rose, border: `1px solid ${T.rose}33` }}>{formError}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs" style={{ color: T.dim }}>
              Área *
              <select className="w-full mt-1" value={form.departamento} onChange={(e) => setForm({ ...form, departamento: e.target.value })} disabled={!esTotal}>
                {(esTotal ? DEPARTAMENTOS : DEPARTAMENTOS.filter((d) => d.id === permisos.area)).map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Prioridad
              <select className="w-full mt-1" value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })}>
                {PRIORITY.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              Título *
              <input className="w-full mt-1" placeholder="Ej. Programar posts de la semana" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </label>
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              Descripción
              <textarea rows={2} className="w-full mt-1 resize-none" placeholder="Detalles opcionales" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </label>
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              Responsables (uno o varios)
              <div className="flex gap-2 mt-1">
                <input
                  className="flex-1"
                  placeholder="Escribe un nombre y presiona Enter"
                  value={responsableInput}
                  onChange={(e) => setResponsableInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addResponsable(); } }}
                />
                <button type="button" onClick={addResponsable} className="px-3 rounded-lg text-xs font-medium" style={{ background: T.panelAlt, color: T.blue, border: `1px solid ${T.border}` }}>Agregar</button>
              </div>
              {form.responsables.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.responsables.map((r) => (
                    <span key={r} className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full" style={{ background: T.blue + "14", color: T.blue }}>
                      {r}
                      <button type="button" onClick={() => removeResponsable(r)}><X size={10} /></button>
                    </span>
                  ))}
                </div>
              )}
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Fecha de inicio
              <input type="date" className="w-full mt-1" value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Fecha de fin
              <input type="date" className="w-full mt-1" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Hora de inicio <span style={{ color: "#94A3B8" }}>(para el calendario del día)</span>
              <input type="time" className="w-full mt-1" value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Hora de fin
              <input type="time" className="w-full mt-1" value={form.horaFin} onChange={(e) => setForm({ ...form, horaFin: e.target.value })} />
            </label>
          </div>

          <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${T.border}` }}>
            <label className="flex items-center gap-2 text-xs" style={{ color: T.rose }}>
              <input type="checkbox" className="w-auto" checked={form.esEmergencia} onChange={(e) => setForm({ ...form, esEmergencia: e.target.checked })} />
              <AlertTriangle size={13} /> Marcar como pendiente de EMERGENCIA (interrumpe el flujo del día a día)
            </label>
            {form.esEmergencia && (
              <div className="mt-3 p-3 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-3" style={{ background: (T.rose + "1F"), border: `1px solid ${T.rose}33` }}>
                <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
                  Sustento (por qué es urgente) *
                  <textarea rows={2} className="w-full mt-1 resize-none" placeholder="Explica por qué esto no puede esperar al flujo normal" value={form.sustentoEmergencia} onChange={(e) => setForm({ ...form, sustentoEmergencia: e.target.value })} />
                </label>
                <label className="text-xs" style={{ color: T.dim }}>
                  Solicitado por *
                  <input className="w-full mt-1" placeholder="Nombre de quien lo pide" value={form.solicitadoPor} onChange={(e) => setForm({ ...form, solicitadoPor: e.target.value })} />
                </label>
                <div className="text-xs" style={{ color: T.dim }}>
                  Firma de quien solicita
                  <div className="mt-1"><SignaturePad value={form.firmaSolicitante} onChange={(dataUrl) => setForm({ ...form, firmaSolicitante: dataUrl })} /></div>
                </div>
              </div>
            )}
          </div>

          {editingId ? (
            <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${T.border}` }}>
              <TaskAttachments taskId={editingId} onCountChange={async (n) => {
                // Releer la lista COMPARTIDA fresca antes de escribir, para no borrar
                // tareas/cambios que otras personas guardaron mientras este formulario estaba abierto.
                const { next } = await mutateShared("marketing-tasks-v2", true, (current) =>
                  current.map((t) => (t.id === editingId ? { ...t, archivosCount: n } : t))
                );
                setTasks(next);
              }} />
            </div>
          ) : (
            <p className="text-[11px] mt-3" style={{ color: "#94A3B8" }}>Guarda la tarea primero — después de crearla podrás adjuntar fotos o documentos aquí mismo.</p>
          )}

          <div className="flex gap-2 mt-5">
            <button type="button" onClick={closeForm} className="flex-1 py-2.5 rounded-lg font-medium text-sm" style={{ background: T.panelAlt, color: T.dim }}>{editingId ? "Cerrar" : "Cancelar"}</button>
            <button type="button" onClick={saveTask} className="flex-1 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.blue }}>{editingId ? "Guardar cambios" : "Agregar tarea"}</button>
          </div>
        </div>
      )}

      {/* Ya no hay barra de pestañas: cada entrada (Tickets, Gerencia, Coordinación, etc.) se navega directo desde el menú "Gestión". */}

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h3 className="disp text-base font-semibold" style={{ color: T.text }}>{activeDept === "bandeja" ? BANDEJA.label : deptMeta(activeDept).label}</h3>
        {activeDept === "bandeja" ? (
          <span className="text-xs flex items-center gap-1" style={{ color: T.dim }}>{(tickets || []).length} sin asignar</span>
        ) : (
          <>
            <span className="text-xs flex items-center gap-1" style={{ color: T.dim }}><CheckCircle2 size={12} /> {(kpisByDept[activeDept] || {}).done || 0} completadas</span>
            <span className="text-xs flex items-center gap-1" style={{ color: T.dim }}><TrendingUp size={12} /> {(kpisByDept[activeDept] || {}).cumplimiento || 0}% cumplimiento</span>
            {(kpisByDept[activeDept] || {}).overdue > 0 && (
              <span className="text-xs flex items-center gap-1" style={{ color: T.rose }}><AlertTriangle size={12} /> {(kpisByDept[activeDept] || {}).overdue} vencida(s)</span>
            )}
            <div className="flex items-center gap-1 ml-auto">
              {[{ id: "tablero", label: "Tablero" }, { id: "calendario", label: "Calendario del área" }].map((v) => (
                <button key={v.id} onClick={() => setVistaPendientes(v.id)} className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ background: vistaPendientes === v.id ? deptMeta(activeDept).color + "14" : T.panelAlt, color: vistaPendientes === v.id ? deptMeta(activeDept).color : "#94A3B8", border: `1px solid ${vistaPendientes === v.id ? deptMeta(activeDept).color + "55" : T.border}` }}>
                  {v.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {activeDept === "bandeja" && <TicketLinkShare />}

      {activeDept === "bandeja" ? (
        <div className="flex flex-col gap-3">
          {(tickets || []).length === 0 && (
            <div className="text-sm text-center py-10 rounded-lg" style={{ color: "#94A3B8", border: `1px dashed ${T.border}` }}>
              No hay pendientes reportados por otras áreas todavía. Comparte el QR (más abajo, en la pestaña Calendario o generándolo aquí) para que puedan enviarte tickets.
            </div>
          )}
          {(tickets || []).map((tk) => (
            <div key={tk.id} className="rounded-xl p-4" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="text-sm font-medium" style={{ color: T.text }}>{tk.titulo}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                    {tk.areaOrigen}{tk.nombreReporta ? ` · ${tk.nombreReporta}` : ""} · {new Date(tk.creado).toLocaleDateString("es-PE")}
                  </p>
                </div>
                {esTotal && <button onClick={() => dismissTicket(tk.id)} title="Descartar"><Trash2 size={14} color={T.rose} /></button>}
              </div>
              {tk.descripcion && <p className="text-xs mb-3" style={{ color: T.dim }}>{tk.descripcion}</p>}
              {tk.foto && (
                <a href={tk.foto} target="_blank" rel="noreferrer">
                  <img src={tk.foto} alt="Foto adjunta" className="w-16 h-16 rounded-lg object-cover mb-3" style={{ border: `1px solid ${T.border}` }} />
                </a>
              )}
              {tk.requiereReunion && esTotal && (
                <div className="flex items-center gap-2 mb-3 text-[11px] px-2.5 py-1.5 rounded-lg" style={{ background: T.amber + "14", color: T.amber, border: `1px solid ${T.amber}44` }}>
                  <Calendar size={12} />
                  Pide reunión — fecha propuesta: <span className="mono font-medium">{tk.fechaPropuesta || "sin especificar"}</span>
                  {tk.fechaPropuesta && (
                    <button onClick={() => agendarReunion(tk)} className="ml-auto text-[11px] font-semibold underline" disabled={reunionAgendada[tk.id]}>
                      {reunionAgendada[tk.id] ? "Agendada ✓" : "Agendar en calendario"}
                    </button>
                  )}
                </div>
              )}
              {esTotal && (
                <div className="flex items-center flex-wrap gap-2">
                  <span className="text-[11px]" style={{ color: "#94A3B8" }}>Asignar a:</span>
                  {DEPARTAMENTOS.map((d) => (
                    <button key={d.id} onClick={() => assignTicket(tk, d.id)} className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ background: d.color + "14", color: d.color, border: `1px solid ${d.color}44` }}>
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : loading ? (
        <div className="p-8 text-center text-sm" style={{ color: T.dim }}>Cargando…</div>
      ) : vistaPendientes === "calendario" ? (
        <AreaMiniCalendar tasks={deptTasks} areaColor={deptMeta(activeDept).color} />
      ) : (
        <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <button onClick={() => setOrdenAsc((v) => !v)} className="text-xs font-medium flex items-center gap-1" style={{ color: T.blue }}>
            Ordenar por: Fecha límite {ordenAsc ? "↑" : "↓"}
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuColumnasAbierto((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
              style={{ background: T.panel, border: `1px solid ${T.border}`, color: T.dim }}
            >
              <Eye size={13} /> Ver otras columnas <ChevronDown size={12} style={{ transform: menuColumnasAbierto ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>
            {menuColumnasAbierto && (
              <div className="absolute right-0 mt-1.5 rounded-lg p-1.5 z-20" style={{ background: T.panel, border: `1px solid ${T.border}`, boxShadow: "0 8px 24px rgba(0,0,0,0.35)", minWidth: 190 }}>
                {COLUMNS.filter((c) => COLUMNAS_COLAPSABLES.includes(c.id)).map((c) => {
                  const visible = columnasVisibles.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => setColumnasVisibles((cur) => (visible ? cur.filter((x) => x !== c.id) : [...cur, c.id]))}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs"
                      style={{ color: T.text }}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                      <span className="flex-1 text-left">{c.label}</span>
                      {!visible && <Eye size={12} color="#8CA0C7" style={{ opacity: 0.4, textDecoration: "line-through" }} />}
                    </button>
                  );
                })}
                <div className="my-1" style={{ borderTop: `1px solid ${T.border}` }} />
                <button onClick={() => setColumnasVisibles(COLUMNAS_COLAPSABLES)} className="w-full text-left px-2.5 py-2 rounded-md text-xs font-medium" style={{ color: T.blue }}>
                  Todas las columnas
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-4 items-start">
        <div className="flex gap-3 items-start flex-1 min-w-0">
          {COLUMNS.filter((col) => col.id === "doing" || columnasVisibles.includes(col.id)).map((col) => {
            const hoy = new Date(new Date().toDateString());
            const colTasks = deptTasks
              .filter((t) => t.estado === col.id)
              .slice()
              .sort((a, b) => {
                const fa = a.fecha ? new Date(a.fecha) : null;
                const fb = b.fecha ? new Date(b.fecha) : null;
                if (!fa && !fb) return 0;
                if (!fa) return 1;
                if (!fb) return -1;
                return ordenAsc ? fa - fb : fb - fa;
              });
            return (
              <div
                key={col.id}
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.id); }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={() => onDrop(col.id)}
                className="rounded-xl p-3"
                style={{
                  background: dragOverCol === col.id ? T.panelAlt : T.panel,
                  border: `1px solid ${dragOverCol === col.id ? col.color : T.border}`,
                  minHeight: 200,
                  flex: "1 1 260px",
                  minWidth: 260,
                }}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: col.color }} />
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: T.text }}>{col.label}</span>
                    <span className="text-xs px-1.5 rounded" style={{ color: T.dim, background: T.panelAlt }}>{colTasks.length}</span>
                  </div>
                  {col.id !== "doing" && (
                    <button onClick={() => setColumnasVisibles((cur) => cur.filter((x) => x !== col.id))} title="Ocultar columna">
                      <Eye size={13} color="#8CA0C7" />
                    </button>
                  )}
                </div>
                {col.id === "doing" && <p className="text-xs mb-3 px-1" style={{ color: "#94A3B8" }}>Tareas activas que requieren atención</p>}
                <div className="flex flex-col gap-2.5">
                  {colTasks.length === 0 && <div className="text-xs text-center py-8 rounded-lg" style={{ color: "#94A3B8", border: `1px dashed ${T.border}` }}>Sin tareas</div>}
                  {colTasks.map((t) => {
                    const pMeta = priorityMeta(t.prioridad);
                    const tColor = colorDeTarea(t.id);
                    const diasBadge = etiquetaDias(t.fecha, t.estado);
                    const respPrincipal = t.responsables?.[0];
                    return (
                      <div key={t.id} draggable onDragStart={() => setDragId(t.id)} className="task-card rounded-lg p-3 group relative" style={{
                        background: t.revisionEstado === "aprobado" ? T.teal + "14" : t.revisionEstado === "rechazado" ? T.rose + "14" : T.panel,
                        borderLeft: `3px solid ${t.revisionEstado === "aprobado" ? T.teal : t.revisionEstado === "rechazado" ? T.rose : tColor}`,
                        border: `1px solid ${T.border}`,
                        borderLeftWidth: 3,
                        borderLeftColor: t.revisionEstado === "aprobado" ? T.teal : t.revisionEstado === "rechazado" ? T.rose : tColor,
                        boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
                      }}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <button onClick={() => startEdit(t)} className="text-left flex-1">
                            <p className="text-sm font-semibold leading-snug hover:underline" style={{ color: T.text }}>{t.titulo}</p>
                          </button>
                          {diasBadge && (
                            <span className="text-[10px] font-semibold px-2 py-1 rounded-full shrink-0" style={{ background: diasBadge.color + "1F", color: diasBadge.color }}>
                              {diasBadge.texto}
                            </span>
                          )}
                        </div>
                        {t.descripcion && <p className="text-xs mb-2 leading-snug" style={{ color: T.dim }}>{t.descripcion}</p>}
                        <div className="flex items-center flex-wrap gap-1.5 mb-2">
                          {t.esEmergencia && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-0.5" style={{ background: T.rose + "1A", color: T.rose }}>
                              <AlertTriangle size={9} />EMERGENCIA
                            </span>
                          )}
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: pMeta.color + "1A", color: pMeta.color }}>
                            <Flag size={9} className="inline -mt-0.5 mr-0.5" />{pMeta.label}
                          </span>
                          {t.archivosCount > 0 && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5" style={{ background: T.panelAlt, color: T.dim }}>
                              <Paperclip size={9} />{t.archivosCount}
                            </span>
                          )}
                          {(t.fechaInicio || t.fecha) && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5 mono" style={{ background: T.panelAlt, color: T.dim }}>
                              <Calendar size={9} />
                              {t.fechaInicio ? t.fechaInicio.slice(5) : ""}{t.fechaInicio && t.fecha ? " → " : ""}{t.fecha ? t.fecha.slice(5) : ""}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: `1px solid ${T.border}` }}>
                          {respPrincipal ? (
                            <span className="flex items-center gap-1.5 text-[11px]" style={{ color: T.dim }}>
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0" style={{ background: tColor + "33", color: tColor }}>
                                {inicialesDe(respPrincipal)}
                              </span>
                              {respPrincipal}{t.responsables.length > 1 ? ` +${t.responsables.length - 1}` : ""}
                            </span>
                          ) : <span />}
                          <div className="flex items-center gap-1">
                            <button onClick={() => startEdit(t)} title="Editar"><Pencil size={12} color={T.dim} /></button>
                            {!t.bloqueada && <button onClick={() => removeTask(t.id)} title="Eliminar"><Trash2 size={13} color={T.rose} /></button>}
                            {t.bloqueada && <span title="Generado desde Reuniones — no se puede eliminar"><Lock size={12} color={T.dim} /></span>}
                          </div>
                        </div>
                        {col.id === "suspendido" && t.motivoSuspension && (
                          <p className="text-[10px] mt-1.5 px-2 py-1 rounded" style={{ background: T.rose + "14", color: T.rose }}>
                            Motivo: {t.motivoSuspension}
                          </p>
                        )}
                        {t.revisionEstado && (
                          <p className="text-[10px] mt-1.5 px-2 py-1 rounded font-semibold flex items-center gap-1" style={{ background: (t.revisionEstado === "aprobado" ? T.teal : T.rose) + "1F", color: t.revisionEstado === "aprobado" ? T.teal : T.rose }}>
                            {t.revisionEstado === "aprobado" ? <CheckCircle2 size={11} /> : <X size={11} />}
                            {t.revisionEstado === "aprobado" ? "Aprobado" : "No aprobado"}{t.revisadoEn ? ` · ${new Date(t.revisadoEn).toLocaleDateString("es-PE")}` : ""}
                          </p>
                        )}
                        {col.id === "revision" && !t.revisionEstado && (
                          <>
                            <button
                              onClick={() => copiarEnlaceRevision(t.id)}
                              className="mt-1.5 text-[10px] font-semibold px-2 py-1.5 rounded flex items-center gap-1 w-full justify-center"
                              style={{ background: T.purple + "1A", color: T.purple }}
                            >
                              {enlaceCopiadoId === t.id ? <><Check size={11} /> Enlace copiado</> : <><Link2 size={11} /> Copiar enlace para aprobar</>}
                            </button>
                            {enlaceVisibleId === t.id && (
                              <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                                <p className="text-[10px] mb-1" style={{ color: "#94A3B8" }}>
                                  {enlaceCopiadoId === t.id ? "Copiado. Si no funcionó, selecciónalo aquí y copia a mano (Ctrl/Cmd + C):" : "Selecciona el enlace y cópialo a mano (Ctrl/Cmd + C):"}
                                </p>
                                <input
                                  ref={(el) => { enlaceInputRefs.current[t.id] = el; }}
                                  readOnly
                                  value={generarEnlaceRevision(t.id)}
                                  onClick={(e) => e.target.select()}
                                  className="w-full text-[10px] mono px-2 py-1.5 rounded"
                                  style={{ background: T.panelAlt, border: `1px solid ${T.purple}55`, color: T.text }}
                                />
                              </div>
                            )}
                          </>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2 pt-2" style={{ borderTop: `1px solid ${T.border}` }}>
                          {COLUMNS.filter((c) => c.id !== col.id).map((c) => (
                            <button key={c.id} onClick={() => moveTaskConMotivo(t.id, c.id)} className="text-[10px] px-2 py-1 rounded font-medium flex-1 hover:opacity-80 transition-opacity" style={{ background: T.panelAlt, color: c.color }}>
                              → {c.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <button onClick={() => { setForm(makeEmptyTaskForm(activeDept === "bandeja" ? "gerencia" : activeDept)); setEditingId(null); setFormError(null); setShowForm(true); }} className="text-xs font-medium py-2.5 rounded-lg flex items-center justify-center gap-1.5" style={{ background: T.panelAlt, color: T.blue, border: `1px dashed ${T.blue}44` }}>
                    <Plus size={13} /> Nueva tarea
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <CalendarioDelDia tasks={deptTasks} areaColor={deptMeta(activeDept).color} colorDeTarea={colorDeTarea} />
        </div>
        </div>
      )}

    </div>
  );
}

const HEADER_MATCHERS = {
  nombreAnuncio: { exact: ["nombre del anuncio", "nombre de la campana", "nombre del conjunto de anuncios"] },
  fecha: { exact: ["inicio del informe"] },
  indicador: { exact: ["indicador de resultado"] },
  resultados: { exact: ["resultados"] },
  costoPorResultado: { includes: ["costo por resultado"] },
  gasto: { includes: ["importe gastado"] },
  impresiones: { exact: ["impresiones"] },
  alcance: { exact: ["alcance"] },
  clics: { includes: ["clics en el enlace"] },
  contactosTotales: { includes: ["contactos de mensajes totales"] },
  nuevosContactos: { includes: ["nuevos contactos de mensajes"] },
  compras: { exact: ["compras"] },
  costoPorCompra: { includes: ["costo por compra"] },
  conjunto: { includes: ["nombre del conjunto de anuncios"] },
};

function mapHeaders(headers) {
  const map = {};
  const normHeaders = headers.map((h) => ({ raw: h, norm: normalize(h) }));
  Object.entries(HEADER_MATCHERS).forEach(([field, matchers]) => {
    let found = null;
    if (matchers.exact) found = normHeaders.find((h) => matchers.exact.includes(h.norm));
    if (!found && matchers.includes) found = normHeaders.find((h) => matchers.includes.some((m) => h.norm.includes(m)));
    if (found) map[field] = found.raw;
  });
  return map;
}

const detectNivel = (headers) => {
  const norm = headers.map((h) => normalize(h));
  if (norm.includes("nombre del anuncio")) return { etiqueta: "Anuncio", etiquetaPlural: "anuncios" };
  if (norm.includes("nombre de la campana")) return { etiqueta: "Campaña", etiquetaPlural: "campañas" };
  if (norm.includes("nombre del conjunto de anuncios")) return { etiqueta: "Conjunto de anuncios", etiquetaPlural: "conjuntos" };
  return null;
};

const indicadorLabel = (ind) => {
  const n = normalize(ind);
  if (n.includes("messaging_conversation_started")) return "Conversaciones de mensajes iniciadas";
  if (n === "reach" || n.includes("reach")) return "Alcance (reconocimiento de marca)";
  if (!ind) return "Sin objetivo de resultado registrado";
  return ind;
};

const SEDES = {
  SM: "San Miguel",
  SI: "San Isidro",
  LN: "Lince",
  LO: "Los Olivos",
  ON: "One",
};
const sedeLabel = (codigo) => SEDES[(codigo || "").trim().toUpperCase()] || null;

function AdsMetaSection({ data, loading, importError, setImportError, importMensaje, onFile, thumbnails, onUploadThumbnail, valorVenta, onUpdateValorVenta, tasaConversion, onUpdateTasaConversion }) {
  const fileInputRef = useRef(null);
  const allRows = data?.rows || [];
  const etiqueta = data?.etiqueta || "Anuncio";
  const [sedeFiltro, setSedeFiltro] = useState("todas");
  const [mesFiltro, setMesFiltro] = useState("todos");
  const [campanaFiltro, setCampanaFiltro] = useState("todas");
  const [editandoValorVenta, setEditandoValorVenta] = useState(false);
  const [valorVentaInput, setValorVentaInput] = useState(String(valorVenta || ""));
  const [editandoTasa, setEditandoTasa] = useState(false);
  const [tasaInput, setTasaInput] = useState(String(tasaConversion || ""));

  const sedesDisponibles = useMemo(() => {
    const codes = new Set();
    allRows.forEach((r) => {
      const code = (r.conjunto || "").trim().toUpperCase();
      if (SEDES[code]) codes.add(code);
    });
    return Array.from(codes);
  }, [allRows]);

  const mesesDisponibles = useMemo(() => {
    const set = new Set(allRows.map((r) => (r.fecha || "").slice(0, 7)).filter(Boolean));
    return Array.from(set).sort();
  }, [allRows]);

  // La lista de campañas se limita al mes elegido (si hay uno), porque los nombres
  // cambian de un mes a otro y mostrarlas todas juntas sería una lista enorme y confusa.
  const campanasDisponibles = useMemo(() => {
    const base = mesFiltro === "todos" ? allRows : allRows.filter((r) => (r.fecha || "").slice(0, 7) === mesFiltro);
    const set = new Set(base.map((r) => r.anuncio).filter(Boolean));
    return Array.from(set).sort();
  }, [allRows, mesFiltro]);

  useEffect(() => {
    // Si cambias de mes y la campaña elegida no existe en ese mes, se resetea el filtro de campaña.
    if (campanaFiltro !== "todas" && !campanasDisponibles.includes(campanaFiltro)) {
      setCampanaFiltro("todas");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesFiltro]);

  const rows = useMemo(() => {
    let r = allRows;
    if (sedeFiltro === "otras") r = r.filter((x) => !SEDES[(x.conjunto || "").trim().toUpperCase()]);
    else if (sedeFiltro !== "todas") r = r.filter((x) => (x.conjunto || "").trim().toUpperCase() === sedeFiltro);
    if (mesFiltro !== "todos") r = r.filter((x) => (x.fecha || "").slice(0, 7) === mesFiltro);
    if (campanaFiltro !== "todas") r = r.filter((x) => x.anuncio === campanaFiltro);
    return r;
  }, [allRows, sedeFiltro, mesFiltro, campanaFiltro]);

  const totals = useMemo(() => {
    const gasto = rows.reduce((a, r) => a + r.gasto, 0);
    const nuevosContactos = rows.reduce((a, r) => a + r.nuevosContactos, 0);
    const contactosTotales = rows.reduce((a, r) => a + r.contactosTotales, 0);
    const compras = rows.reduce((a, r) => a + r.compras, 0);
    const msgRows = rows.filter((r) => normalize(r.indicador).includes("messaging_conversation_started"));
    const conversaciones = msgRows.reduce((a, r) => a + r.resultados, 0);
    const gastoConversaciones = msgRows.reduce((a, r) => a + r.gasto, 0);
    const costoPorConversacion = conversaciones ? gastoConversaciones / conversaciones : 0;
    const ingresosEstimados = compras * (valorVenta || 0);
    const roi = gasto > 0 ? ((ingresosEstimados - gasto) / gasto) * 100 : 0;
    const roas = gasto > 0 ? ingresosEstimados / gasto : 0;
    // Cuando no hay compras (campañas de conversaciones/mensajes), estimamos ventas
    // a partir de cuántas conversaciones se convierten en venta (tasa manual) y el valor promedio.
    const ventasEstimadasPorConversacion = conversaciones * ((tasaConversion || 0) / 100);
    const ingresosEstimadosConv = ventasEstimadasPorConversacion * (valorVenta || 0);
    const roiConv = gasto > 0 ? ((ingresosEstimadosConv - gasto) / gasto) * 100 : 0;
    const roasConv = gasto > 0 ? ingresosEstimadosConv / gasto : 0;
    return {
      gasto, nuevosContactos, contactosTotales, compras, conversaciones, costoPorConversacion,
      ingresosEstimados, roi, roas,
      ventasEstimadasPorConversacion, ingresosEstimadosConv, roiConv, roasConv,
    };
  }, [rows, valorVenta, tasaConversion]);

  const byIndicador = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      const key = indicadorLabel(r.indicador);
      if (!map[key]) map[key] = { label: key, resultados: 0, gasto: 0 };
      map[key].resultados += r.resultados;
      map[key].gasto += r.gasto;
    });
    return Object.values(map).sort((a, b) => b.gasto - a.gasto);
  }, [rows]);

  const byAnuncio = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      const key = r.anuncio + "||" + r.conjunto;
      if (!map[key]) map[key] = { anuncio: r.anuncio, conjunto: r.conjunto, resultados: 0, gasto: 0, nuevosContactos: 0, indicador: r.indicador };
      map[key].resultados += r.resultados;
      map[key].gasto += r.gasto;
      map[key].nuevosContactos += r.nuevosContactos;
    });
    return Object.values(map).sort((a, b) => b.gasto - a.gasto).slice(0, 20);
  }, [rows]);
  const gastoPorDia = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      if (!r.fecha) return;
      map[r.fecha] = (map[r.fecha] || 0) + r.gasto;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([fecha, gasto]) => ({ fecha: fecha.slice(5), gasto: Math.round(gasto) }));
  }, [rows]);

  const conversacionesPorDia = useMemo(() => {
    const map = {};
    rows.filter((r) => normalize(r.indicador).includes("messaging_conversation_started")).forEach((r) => {
      if (!r.fecha) return;
      map[r.fecha] = (map[r.fecha] || 0) + r.resultados;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([fecha, conversaciones]) => ({ fecha: fecha.slice(5), conversaciones: Math.round(conversaciones) }));
  }, [rows]);

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Megaphone size={16} color={T.blue} />
          <h3 className="disp text-base font-semibold" style={{ color: T.text }}>Rendimiento reportado por Meta</h3>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) onFile(e.target.files[0]); e.target.value = ""; }} />
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium text-xs" style={{ background: T.panel, color: T.text, border: `1px solid ${T.border}` }}>
            <Upload size={14} /> Importar reporte Meta Ads (CSV)
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {mesesDisponibles.length > 1 && (
          <select value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} className="text-xs">
            <option value="todos">Todo el periodo cargado</option>
            {mesesDisponibles.map((m) => <option key={m} value={m}>{labelMes(m)}</option>)}
          </select>
        )}
        {campanasDisponibles.length > 0 && (
          <select value={campanaFiltro} onChange={(e) => setCampanaFiltro(e.target.value)} className="text-xs">
            <option value="todas">Todas las campañas{mesFiltro !== "todos" ? " de este mes" : ""}</option>
            {campanasDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {sedesDisponibles.length > 0 && (
          <select value={sedeFiltro} onChange={(e) => setSedeFiltro(e.target.value)} className="text-xs">
            <option value="todas">Todas las sedes</option>
            {sedesDisponibles.map((code) => <option key={code} value={code}>{SEDES[code]} ({code})</option>)}
            <option value="otras">Sin sede identificada</option>
          </select>
        )}
      </div>

      {importError && (
        <div className="mb-4 text-xs px-3 py-2 rounded-lg flex items-center justify-between" style={{ background: (T.rose + "1F"), color: T.rose, border: `1px solid ${T.rose}33` }}>
          {importError}
          <button onClick={() => setImportError(null)}><X size={14} /></button>
        </div>
      )}

      {importMensaje && (
        <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: T.teal + "1A", color: T.teal, border: `1px solid ${T.teal}44` }}>
          ✓ {importMensaje}
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: T.dim }}>Cargando…</p>
      ) : !data ? (
        <div className="rounded-xl p-10 text-center" style={{ background: T.panel, border: `1px dashed ${T.border}` }}>
          <FileSpreadsheet size={22} color="#94A3B8" className="mx-auto mb-2" />
          <p className="text-sm" style={{ color: T.dim }}>Aún no importas el reporte de Meta Ads.</p>
          <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>Exporta el reporte por anuncio (CSV) desde el Administrador de anuncios y súbelo aquí.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <p className="text-xs" style={{ color: "#94A3B8" }}>
              Último archivo: <span className="mono" style={{ color: T.dim }}>{data.lastFileName}</span> · {new Date(data.lastImportedAt).toLocaleString("es-PE")} · <span className="mono">{allRows.length}</span> filas acumuladas en total
            </p>
            {data.history?.length > 1 && (
              <details className="text-xs">
                <summary className="cursor-pointer select-none" style={{ color: T.blue }}>Ver historial de subidas ({data.history.length})</summary>
                <ul className="mt-2 space-y-1">
                  {data.history.map((h, i) => (
                    <li key={i} className="mono" style={{ color: "#94A3B8" }}>
                      {new Date(h.importedAt).toLocaleString("es-PE")} — {h.fileName} ({h.rowCount} filas del archivo{h.nuevasFilas != null ? `, ${h.nuevasFilas} nuevas / ${h.filasActualizadas} actualizadas` : ""})
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <StatCard icon={<CircleDollarSign size={16} />} label="Inversión total" value={fmtSoles(totals.gasto)} color={T.blue} />
            <StatCard icon={<MessageSquare size={16} />} label="Conversaciones iniciadas" value={fmtNum(totals.conversaciones)} color={T.purple} />
            <StatCard icon={<Target size={16} />} label="Costo por conversación" value={fmtSoles(totals.costoPorConversacion)} color={T.amber} />
            <StatCard icon={<Users size={16} />} label="Nuevos contactos" value={fmtNum(totals.nuevosContactos)} color={T.teal} />
          </div>

          <div className="rounded-xl p-4 mb-6" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <p className="text-xs font-semibold" style={{ color: T.dim }}>ROI de publicidad (estimado)</p>
              {editandoValorVenta ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: T.dim }}>Valor promedio por venta (S/)</span>
                  <input
                    type="number"
                    min="0"
                    className="w-24"
                    value={valorVentaInput}
                    onChange={(e) => setValorVentaInput(e.target.value)}
                    autoFocus
                  />
                  <button
                    onClick={() => { onUpdateValorVenta(parseFloat(valorVentaInput) || 0); setEditandoValorVenta(false); }}
                    className="text-xs font-medium px-2.5 py-1.5 rounded-lg text-white"
                    style={{ background: T.blue }}
                  >
                    Guardar
                  </button>
                </div>
              ) : (
                <button onClick={() => { setValorVentaInput(String(valorVenta || "")); setEditandoValorVenta(true); }} className="text-xs font-medium" style={{ color: T.blue }}>
                  {valorVenta > 0 ? `Editar valor promedio de venta (${fmtSoles(valorVenta)})` : "Definir valor promedio de venta"}
                </button>
              )}
            </div>
            {totals.compras === 0 ? (
              <div>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <p className="text-xs" style={{ color: T.dim }}>
                    Este archivo no reporta compras (es una campaña de conversaciones de mensajes / alcance). Para estimar el retorno aquí, define qué porcentaje de esas conversaciones se convierte en venta.
                  </p>
                  {editandoTasa ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs" style={{ color: T.dim }}>Tasa de conversión (%)</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="w-20"
                        value={tasaInput}
                        onChange={(e) => setTasaInput(e.target.value)}
                        autoFocus
                      />
                      <button
                        onClick={() => { onUpdateTasaConversion(parseFloat(tasaInput) || 0); setEditandoTasa(false); }}
                        className="text-xs font-medium px-2.5 py-1.5 rounded-lg text-white"
                        style={{ background: T.blue }}
                      >
                        Guardar
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => { setTasaInput(String(tasaConversion || "")); setEditandoTasa(true); }} className="text-xs font-medium shrink-0" style={{ color: T.blue }}>
                      {tasaConversion > 0 ? `Editar tasa de conversión (${tasaConversion}%)` : "Definir tasa de conversión"}
                    </button>
                  )}
                </div>
                {tasaConversion > 0 && valorVenta > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard icon={<MessageSquare size={16} />} label="Conversaciones" value={fmtNum(totals.conversaciones)} color={T.purple} />
                    <StatCard icon={<ShoppingBag size={16} />} label="Ventas estimadas" value={fmtNum(totals.ventasEstimadasPorConversacion)} color={T.blue} />
                    <StatCard icon={<TrendingUp size={16} />} label="ROI estimado" value={`${totals.roiConv >= 0 ? "+" : ""}${totals.roiConv.toFixed(0)}%`} color={totals.roiConv >= 0 ? T.teal : T.rose} />
                    <StatCard icon={<Target size={16} />} label="ROAS estimado" value={`${totals.roasConv.toFixed(2)}x`} color={T.purple} />
                  </div>
                ) : (
                  <p className="text-xs px-3 py-2 rounded-lg" style={{ background: T.amber + "1A", color: T.amber }}>
                    Falta {tasaConversion > 0 ? "" : "la tasa de conversión y "}{valorVenta > 0 ? "" : "el valor promedio de venta "}para calcular el ROI estimado. Mientras tanto, usa "Costo por conversación" arriba como referencia.
                  </p>
                )}
              </div>
            ) : valorVenta > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={<ShoppingBag size={16} />} label="Compras" value={fmtNum(totals.compras)} color={T.blue} />
                <StatCard icon={<CircleDollarSign size={16} />} label="Ingresos estimados" value={fmtSoles(totals.ingresosEstimados)} color={T.teal} />
                <StatCard icon={<TrendingUp size={16} />} label="ROI" value={`${totals.roi >= 0 ? "+" : ""}${totals.roi.toFixed(0)}%`} color={totals.roi >= 0 ? T.teal : T.rose} />
                <StatCard icon={<Target size={16} />} label="ROAS (retorno por sol)" value={`${totals.roas.toFixed(2)}x`} color={T.purple} />
              </div>
            ) : (
              <p className="text-xs" style={{ color: "#94A3B8" }}>
                Define cuánto vale en promedio una venta para calcular el retorno real (ingresos estimados vs. inversión). Meta solo reporta la cantidad de compras, no su valor en soles.
              </p>
            )}
          </div>

          {gastoPorDia.length > 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl p-4" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                <p className="text-xs font-medium mb-3" style={{ color: T.dim }}>Inversión por día</p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={gastoPorDia}>
                    <CartesianGrid stroke={T.border} vertical={false} />
                    <XAxis dataKey="fecha" tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} />
                    <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip contentStyle={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} itemStyle={{ color: T.text }} labelStyle={{ color: T.text }} />
                    <Line type="monotone" dataKey="gasto" stroke={T.blue} strokeWidth={2} dot={{ r: 3, fill: T.blue }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-xl p-4" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                <p className="text-xs font-medium mb-3" style={{ color: T.dim }}>Conversaciones iniciadas por día</p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={conversacionesPorDia}>
                    <CartesianGrid stroke={T.border} vertical={false} />
                    <XAxis dataKey="fecha" tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip contentStyle={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} itemStyle={{ color: T.text }} labelStyle={{ color: T.text }} />
                    <Line type="monotone" dataKey="conversaciones" stroke={T.purple} strokeWidth={2} dot={{ r: 3, fill: T.purple }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="rounded-xl overflow-hidden mb-6" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
            <p className="text-xs font-medium px-4 pt-4 pb-2" style={{ color: T.dim }}>Resultados por tipo de objetivo</p>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {["Objetivo", "Resultados", "Gasto", "Costo/Resultado"].map((h) => <th key={h} className="text-left px-4 py-2 font-medium" style={{ color: "#94A3B8" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {byIndicador.map((g) => (
                  <tr key={g.label} style={{ borderBottom: `1px solid ${T.panelAlt}` }}>
                    <td className="px-4 py-2" style={{ color: T.text }}>{g.label}</td>
                    <td className="px-4 py-2 mono" style={{ color: T.dim }}>{fmtNum(g.resultados)}</td>
                    <td className="px-4 py-2 mono" style={{ color: T.dim }}>{fmtSoles(g.gasto)}</td>
                    <td className="px-4 py-2 mono" style={{ color: T.dim }}>{g.resultados ? fmtSoles(g.gasto / g.resultados) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl overflow-hidden" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
            <p className="text-xs font-medium px-4 pt-4 pb-2" style={{ color: T.dim }}>Top 20 {data.etiquetaPlural || "anuncios"} por inversión</p>
            <p className="text-[11px] px-4 pb-2" style={{ color: "#94A3B8" }}>
              Meta no incluye la imagen del creativo en este reporte. Puedes subir una miniatura manualmente para reconocer cada {etiqueta.toLowerCase()} de un vistazo — se guarda para la próxima vez.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    {["", etiqueta, "Sede", "Conjunto", "Resultados", "Gasto", "Contactos nuevos"].map((h) => <th key={h} className="text-left px-4 py-2 font-medium" style={{ color: "#94A3B8" }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {byAnuncio.map((a, i) => {
                    const sede = sedeLabel(a.conjunto);
                    const thumb = thumbnails[a.anuncio];
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${T.panelAlt}` }}>
                        <td className="px-4 py-2">
                          <label className="cursor-pointer block" title="Subir miniatura">
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) onUploadThumbnail(a.anuncio, e.target.files[0]); e.target.value = ""; }} />
                            {thumb ? (
                              <img src={thumb} alt={a.anuncio} className="w-8 h-8 rounded-md object-cover" style={{ border: `1px solid ${T.border}` }} />
                            ) : (
                              <span className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: T.panelAlt, border: `1px dashed ${T.border}` }}>
                                <ImagePlus size={13} color="#94A3B8" />
                              </span>
                            )}
                          </label>
                        </td>
                        <td className="px-4 py-2" style={{ color: T.text }}>{a.anuncio}</td>
                        <td className="px-4 py-2" style={{ color: sede ? T.blue : "#94A3B8" }}>{sede || "—"}</td>
                        <td className="px-4 py-2" style={{ color: T.dim }}>{a.conjunto || "—"}</td>
                        <td className="px-4 py-2 mono" style={{ color: T.dim }}>{fmtNum(a.resultados)}</td>
                        <td className="px-4 py-2 mono" style={{ color: T.dim }}>{fmtSoles(a.gasto)}</td>
                        <td className="px-4 py-2 mono" style={{ color: T.dim }}>{fmtNum(a.nuevosContactos)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="rounded-xl p-4" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
      <div className="flex items-center gap-2 mb-2" style={{ color }}>
        {icon}
        <span className="text-xs font-medium" style={{ color: "#94A3B8" }}>{label}</span>
      </div>
      <p className="disp text-lg font-semibold mono" style={{ color: T.text }}>{value}</p>
    </div>
  );
}

/* ---------------------------------- ADS TAB WRAPPER (estado centralizado) ---------------------------------- */
function PowerBiPanel() {
  const [url, setUrl] = useState(null);
  const [urlInput, setUrlInput] = useState("");
  const [editando, setEditando] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("powerbi-embed-url", true);
        const val = res ? JSON.parse(res.value) : null;
        setUrl(val);
        setUrlInput(val || "");
      } catch (e) {
        setUrl(null);
      }
    })();
  }, []);

  const guardar = async () => {
    try {
      const res = await window.storage.set("powerbi-embed-url", JSON.stringify(urlInput.trim() || null), true);
      if (!res) { setSaveError("No se pudo guardar. Intenta de nuevo."); return; }
      setUrl(urlInput.trim() || null);
      setEditando(false);
      setSaveError(null);
    } catch (e) {
      setSaveError("No se pudo guardar. Intenta de nuevo.");
    }
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} color={T.purple} />
          <h3 className="disp text-base font-semibold" style={{ color: T.text }}>Funnel Comercial y Publicitario (Power BI)</h3>
        </div>
        <button onClick={() => { setUrlInput(url || ""); setEditando((e) => !e); }} className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: T.panelAlt, color: T.dim, border: `1px solid ${T.border}` }}>
          {url ? "Cambiar enlace" : "Configurar enlace"}
        </button>
      </div>

      {saveError && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: (T.rose + "1F"), color: T.rose }}>{saveError}</div>}

      {editando && (
        <div className="rounded-xl p-4 mb-3" style={{ background: T.panelAlt, border: `1px solid ${T.border}` }}>
          <p className="text-xs font-medium mb-2" style={{ color: T.dim }}>Pega aquí el enlace para insertar (embed) del reporte de Power BI</p>
          <div className="flex gap-2">
            <input className="flex-1" placeholder="https://app.powerbi.com/view?r=..." value={urlInput} onChange={(e) => setUrlInput(e.target.value)} />
            <button onClick={guardar} className="px-4 py-2 rounded-lg text-xs font-medium text-white" style={{ background: T.blue }}>Guardar</button>
          </div>
          <p className="text-[11px] mt-2" style={{ color: "#94A3B8" }}>
            En Power BI: Archivo → Insertar informe → Publicar en la Web (genera un enlace público), o el enlace de inserción seguro de tu organización si el reporte es privado — en ese caso, quien lo vea debe tener sesión iniciada en Power BI con permiso al reporte.
          </p>
        </div>
      )}

      {url ? (
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
          <iframe title="Funnel Comercial Power BI" src={url} style={{ width: "100%", height: 620, border: "none" }} allowFullScreen />
        </div>
      ) : (
        <div className="rounded-xl p-10 text-center" style={{ background: T.panel, border: `1px dashed ${T.border}` }}>
          <TrendingUp size={22} color="#94A3B8" className="mx-auto mb-2" />
          <p className="text-sm" style={{ color: T.dim }}>Todavía no se anexó el reporte de Power BI del funnel comercial.</p>
          <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>Este espacio quedará reservado para el visualizador — leads, citas registradas, citas asistidas, ventas y su costo por etapa — que arma el analista con la data interna de citas.</p>
        </div>
      )}
    </div>
  );
}

function AdsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importError, setImportError] = useState(null);
  const [importMensaje, setImportMensaje] = useState(null);
  const [thumbnails, setThumbnails] = useState({});
  const [valorVenta, setValorVenta] = useState(0);
  const [tasaConversion, setTasaConversion] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("ads-performance", true);
        setData(res ? JSON.parse(res.value) : null);
      } catch (e) {
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
    (async () => {
      try {
        const res = await window.storage.get("ad-thumbnails", true);
        setThumbnails(res ? JSON.parse(res.value) : {});
      } catch (e) {
        setThumbnails({});
      }
    })();
    (async () => {
      try {
        const res = await window.storage.get("ads-valor-venta", true);
        setValorVenta(res ? parseFloat(res.value) || 0 : 0);
      } catch (e) {
        setValorVenta(0);
      }
    })();
    (async () => {
      try {
        const res = await window.storage.get("ads-tasa-conversion", true);
        setTasaConversion(res ? parseFloat(res.value) || 0 : 0);
      } catch (e) {
        setTasaConversion(0);
      }
    })();
  }, []);

  const actualizarTasaConversion = async (nuevoValor) => {
    setTasaConversion(nuevoValor);
    try {
      await window.storage.set("ads-tasa-conversion", String(nuevoValor), true);
    } catch (e) {
      // si falla el guardado, el valor sigue funcionando en esta sesión
    }
  };

  const actualizarValorVenta = async (nuevoValor) => {
    setValorVenta(nuevoValor);
    try {
      await window.storage.set("ads-valor-venta", String(nuevoValor), true);
    } catch (e) {
      // si falla el guardado, el valor sigue funcionando en esta sesión
    }
  };

  const uploadThumbnail = (anuncioName, file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const size = 64;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
        const next = { ...thumbnails, [anuncioName]: dataUrl };
        setThumbnails(next);
        try {
          await window.storage.set("ad-thumbnails", JSON.stringify(next), true);
        } catch (e) {
          setImportError("La miniatura se ve, pero no se pudo guardar. Intenta subirla de nuevo.");
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const persist = useCallback(async (next) => {
    setData(next);
    try {
      const res = await window.storage.set("ads-performance", JSON.stringify(next), true);
      if (!res) setImportError("Se importó, pero no se pudo guardar para la próxima vez. Vuelve a intentar si quieres que persista.");
    } catch (e) {
      setImportError("Se importó, pero no se pudo guardar para la próxima vez. Vuelve a intentar si quieres que persista.");
    }
  }, []);

  const handleFile = (file) => {
    setImportError(null);
    setImportMensaje(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const headers = results.meta.fields || [];
          const nivelInfo = detectNivel(headers);
          const map = mapHeaders(headers);
          if (!nivelInfo || !map.nombreAnuncio || !map.gasto) {
            setImportError("No reconozco este archivo como un reporte de Meta Ads. Asegúrate de exportarlo tal cual desde el Administrador de anuncios.");
            return;
          }
          const newRows = results.data
            .filter((r) => (r[map.nombreAnuncio] || "").toString().trim())
            .map((r) => ({
              anuncio: (r[map.nombreAnuncio] || "").toString().trim(),
              conjunto: map.conjunto ? (r[map.conjunto] || "").toString().trim() : "",
              fecha: map.fecha ? r[map.fecha] : "",
              indicador: map.indicador ? r[map.indicador] : "",
              resultados: parseFloat(r[map.resultados]) || 0,
              gasto: parseFloat(r[map.gasto]) || 0,
              impresiones: map.impresiones ? parseFloat(r[map.impresiones]) || 0 : 0,
              alcance: map.alcance ? parseFloat(r[map.alcance]) || 0 : 0,
              clics: map.clics ? parseFloat(r[map.clics]) || 0 : 0,
              contactosTotales: map.contactosTotales ? parseFloat(r[map.contactosTotales]) || 0 : 0,
              nuevosContactos: map.nuevosContactos ? parseFloat(r[map.nuevosContactos]) || 0 : 0,
              compras: map.compras ? parseFloat(r[map.compras]) || 0 : 0,
            }));
          if (!newRows.length) {
            setImportError("El archivo no tiene filas reconocibles.");
            return;
          }

          // Cada archivo nuevo se ACUMULA con lo que ya había (para ir subiendo el año por partes,
          // mes a mes). Una campaña puede tener varias filas el mismo día con el mismo objetivo
          // (distintos anuncios/conjuntos dentro de ella, sin un ID propio en este reporte), así
          // que la clave incluye un número de ocurrencia — si subes el mismo archivo de nuevo, esas
          // filas se actualizan correctamente; si son filas realmente distintas, no se pisan entre sí.
          const construirClaves = (rows) => {
            const contador = new Map();
            return rows.map((r) => {
              const base = `${r.anuncio}|${r.conjunto}|${r.fecha}|${r.indicador}`;
              const n = contador.get(base) || 0;
              contador.set(base, n + 1);
              return { clave: `${base}#${n}`, row: r };
            });
          };
          const existentesConClave = construirClaves(data?.rows || []);
          const nuevasConClave = construirClaves(newRows);
          const mapaExistente = new Map(existentesConClave.map(({ clave, row }) => [clave, row]));
          let nuevasFilas = 0;
          let filasActualizadas = 0;
          nuevasConClave.forEach(({ clave, row }) => {
            if (mapaExistente.has(clave)) filasActualizadas++;
            else nuevasFilas++;
            mapaExistente.set(clave, row);
          });
          const rowsAcumuladas = Array.from(mapaExistente.values());

          const prevHistory = data?.history || [];
          const history = [{ fileName: file.name, importedAt: nowStamp(), rowCount: newRows.length, nuevasFilas, filasActualizadas }, ...prevHistory].slice(0, 30);

          persist({ rows: rowsAcumuladas, history, lastFileName: file.name, lastImportedAt: nowStamp(), etiqueta: nivelInfo.etiqueta, etiquetaPlural: nivelInfo.etiquetaPlural });
          setImportError(null);
          setImportMensaje(`Se agregaron ${nuevasFilas} filas nuevas${filasActualizadas > 0 ? ` y se actualizaron ${filasActualizadas} filas existentes` : ""}. Total acumulado: ${rowsAcumuladas.length} filas.`);
        } catch (e) {
          setImportError("No pude procesar el archivo. Revisa que sea el CSV exportado tal cual desde Meta Ads.");
        }
      },
      error: () => setImportError("No pude leer el archivo."),
    });
  };

  return (
    <div>
      <PowerBiPanel />
      <AdsMetaSection
        data={data}
        loading={loading}
        importError={importError}
        setImportError={setImportError}
        importMensaje={importMensaje}
        onFile={handleFile}
        thumbnails={thumbnails}
        onUploadThumbnail={uploadThumbnail}
        valorVenta={valorVenta}
        onUpdateValorVenta={actualizarValorVenta}
        tasaConversion={tasaConversion}
        onUpdateTasaConversion={actualizarTasaConversion}
      />
    </div>
  );
}

/* ---------------------------------- CALENDARIO (Pendientes + Reuniones + Otros) ---------------------------------- */
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const TIPOS_EVENTO = [
  { id: "pendiente", label: "Pendientes", color: T.blue },
  { id: "reunion", label: "Reuniones", color: T.amber },
  { id: "otro", label: "Otros", color: T.purple },
];

const AREAS_CALENDARIO = [...DEPARTAMENTOS, { id: "general", label: "General", color: T.dim }];
const areaMeta = (id) => AREAS_CALENDARIO.find((a) => a.id === id) || AREAS_CALENDARIO[AREAS_CALENDARIO.length - 1];

const toKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayKey = toKey(new Date());

function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // lunes = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = startOffset; i > 0; i--) cells.push({ date: new Date(year, month, 1 - i), outside: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d), outside: false });
  while (cells.length < 42) cells.push({ date: new Date(year, month, daysInMonth + (cells.length - startOffset - daysInMonth) + 1), outside: true });
  return cells;
}

const emptyEventForm = { tipo: "reunion", titulo: "", inicio: localISO(), fin: "", area: "general", descripcion: "" };

/* ---------------------------------- PRODUCCIÓN DE CONTENIDO ---------------------------------- */
const ETAPAS_CONTENIDO = [
  { id: "propuesta", label: "Propuesta (idea)", color: T.blue },
  { id: "boceto", label: "Entrega de propuesta (boceto)", color: T.amber },
  { id: "grabacion", label: "Grabación", color: T.purple },
  { id: "listo", label: "Listo", color: T.teal },
];
const emptyContenidoForm = { titulo: "", descripcion: "", area: "diseno", responsables: [], fechaLimite: "" };

function ProduccionPanel({ permisos }) {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyContenidoForm);
  const [responsableInput, setResponsableInput] = useState("");
  const [formError, setFormError] = useState(null);
  const [aprobando, setAprobando] = useState(null); // id del item que se está aprobando

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("produccion-contenido", true);
        setItems(res ? JSON.parse(res.value) : []);
      } catch (e) {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = async (next) => {
    setItems(next);
    try {
      const res = await window.storage.set("produccion-contenido", JSON.stringify(next), true);
      setSaveError(res ? null : "No se pudo guardar. Intenta de nuevo.");
    } catch (e) {
      setSaveError("No se pudo guardar. Intenta de nuevo.");
    }
  };

  const crear = async () => {
    if (!form.titulo.trim()) { setFormError("Ponle un título a la pieza de contenido."); return; }
    const nuevo = { ...form, id: uid(), etapa: "propuesta", firmaGerenciaGeneral: null, firmaGerenciaMarketing: null, creado: nowStamp() };
    const { next, ok } = await mutateShared("produccion-contenido", true, (current) => [nuevo, ...current]);
    setItems(next);
    setSaveError(ok ? null : "No se pudo guardar. Intenta de nuevo.");
    setForm(emptyContenidoForm);
    setFormError(null);
    setShowForm(false);
  };

  const moverEtapa = async (item, nuevaEtapa) => {
    if (nuevaEtapa === "grabacion" && (!item.firmaGerenciaGeneral || !item.firmaGerenciaMarketing)) {
      setAprobando(item.id);
      return;
    }
    const { next, ok } = await mutateShared("produccion-contenido", true, (current) => current.map((i) => (i.id === item.id ? { ...i, etapa: nuevaEtapa } : i)));
    setItems(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };

  const guardarFirma = async (id, campo, dataUrl) => {
    const { next, ok } = await mutateShared("produccion-contenido", true, (current) => current.map((i) => (i.id === id ? { ...i, [campo]: dataUrl } : i)));
    setItems(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };

  const eliminar = async (id) => {
    const { next, ok } = await mutateShared("produccion-contenido", true, (current) => current.filter((i) => i.id !== id));
    setItems(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };

  const addResponsable = () => {
    const name = responsableInput.trim();
    if (!name) return;
    if (!form.responsables.includes(name)) setForm({ ...form, responsables: [...form.responsables, name] });
    setResponsableInput("");
  };

  const itemAprobando = (items || []).find((i) => i.id === aprobando);

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <p className="text-sm" style={{ color: T.dim }}>Idea → boceto → grabación (requiere aprobación de Gerencia General y Gerencia de Marketing).</p>
        <button onClick={() => { setForm(emptyContenidoForm); setFormError(null); setShowForm((s) => !s); }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: showForm ? T.dim : T.blue }}>
          {showForm ? "Cancelar" : <><Plus size={16} strokeWidth={2.5} /> Nueva pieza de contenido</>}
        </button>
      </div>

      {saveError && <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: (T.rose + "1F"), color: T.rose, border: `1px solid ${T.rose}33` }}>{saveError}</div>}

      {showForm && (
        <div className="rounded-xl p-5 mb-6" style={{ background: T.panel, border: `1px solid ${T.blue}55` }}>
          <h3 className="disp text-sm font-semibold mb-4" style={{ color: T.text }}>Nueva pieza de contenido</h3>
          {formError && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: (T.rose + "1F"), color: T.rose }}>{formError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              Título / idea *
              <input className="w-full mt-1" placeholder="Ej. Reel de resultados antes/después" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </label>
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              Descripción
              <textarea rows={2} className="w-full mt-1 resize-none" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Área responsable
              <select className="w-full mt-1" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}>
                <option value="diseno">Diseño Gráfico</option>
                <option value="edicion_audiovisual">Edición Audiovisual</option>
                <option value="productor_audiovisual">Realizador Audiovisual</option>
                <option value="productor_ia">Productor IA</option>
              </select>
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Fecha límite de entrega
              <input type="date" className="w-full mt-1" value={form.fechaLimite} onChange={(e) => setForm({ ...form, fechaLimite: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Responsables
              <div className="flex gap-2 mt-1">
                <input className="flex-1" placeholder="Nombre y Enter" value={responsableInput} onChange={(e) => setResponsableInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addResponsable(); } }} />
                <button type="button" onClick={addResponsable} className="px-3 rounded-lg text-xs font-medium" style={{ background: T.panelAlt, color: T.blue }}>+</button>
              </div>
            </label>
          </div>
          {form.responsables.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {form.responsables.map((r) => <span key={r} className="text-[11px] font-medium px-2 py-1 rounded-full" style={{ background: T.blue + "14", color: T.blue }}>{r}</span>)}
            </div>
          )}
          <div className="flex gap-2 mt-5">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg font-medium text-sm" style={{ background: T.panelAlt, color: T.dim }}>Cancelar</button>
            <button type="button" onClick={crear} className="flex-1 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.blue }}>Crear</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: T.dim }}>Cargando…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {ETAPAS_CONTENIDO.map((etapa) => {
            const enEtapa = (items || []).filter((i) => i.etapa === etapa.id);
            return (
              <div key={etapa.id} className="rounded-xl p-3 min-h-[300px]" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full" style={{ background: etapa.color }} />
                  <span className="text-xs font-semibold uppercase" style={{ color: T.dim }}>{etapa.label}</span>
                  <span className="mono text-xs ml-auto" style={{ color: "#94A3B8" }}>{enEtapa.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {enEtapa.map((item) => {
                    const atrasado = etapa.id !== "listo" && item.fechaLimite && new Date(item.fechaLimite) < new Date(new Date().toDateString());
                    return (
                    <div key={item.id} className="rounded-lg p-3" style={{ background: T.panelAlt, border: atrasado ? `1px solid ${T.rose}` : `1px solid ${T.border}` }}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-medium" style={{ color: T.text }}>{item.titulo}</p>
                        <button onClick={() => eliminar(item.id)}><Trash2 size={12} color={T.rose} /></button>
                      </div>
                      {item.descripcion && <p className="text-xs mb-1.5" style={{ color: T.dim }}>{item.descripcion}</p>}
                      <p className="text-[10px] mb-2" style={{ color: "#94A3B8" }}>{deptMeta(item.area).label}{item.responsables?.length > 0 && ` · ${item.responsables.join(", ")}`}</p>
                      {item.fechaLimite && (
                        <p className="text-[10px] font-semibold mb-2" style={{ color: atrasado ? T.rose : T.dim }}>
                          {atrasado ? "⚠ Atrasado · " : "Entrega: "}{item.fechaLimite}
                        </p>
                      )}
                      {etapa.id === "grabacion" && (
                        <div className="flex items-center gap-1 mb-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: item.firmaGerenciaGeneral ? T.teal + "14" : T.rose + "14", color: item.firmaGerenciaGeneral ? T.teal : T.rose }}>GG {item.firmaGerenciaGeneral ? "✓" : "✗"}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: item.firmaGerenciaMarketing ? T.teal + "14" : T.rose + "14", color: item.firmaGerenciaMarketing ? T.teal : T.rose }}>GM {item.firmaGerenciaMarketing ? "✓" : "✗"}</span>
                        </div>
                      )}
                      <div className="flex gap-1">
                        {ETAPAS_CONTENIDO.filter((e) => e.id !== etapa.id).map((e) => (
                          <button key={e.id} onClick={() => moverEtapa(item, e.id)} className="text-[10px] px-1.5 py-1 rounded font-medium flex-1" style={{ background: T.panel, color: e.color }}>
                            → {e.label.split(" ")[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  );})}
                  {enEtapa.length === 0 && <p className="text-xs text-center py-6" style={{ color: "#94A3B8" }}>Vacío</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {itemAprobando && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: "#0F172A55" }} onClick={() => setAprobando(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-xl p-5" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="disp text-sm font-semibold" style={{ color: T.text }}>Aprobación para grabación</h3>
              <button onClick={() => setAprobando(null)}><X size={16} color={T.dim} /></button>
            </div>
            <p className="text-xs mb-4" style={{ color: "#94A3B8" }}>"{itemAprobando.titulo}" necesita ambas firmas antes de pasar a Grabación.</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <p className="text-[11px] font-medium mb-1" style={{ color: T.text }}>Gerencia General</p>
                <SignaturePad value={itemAprobando.firmaGerenciaGeneral} onChange={(d) => guardarFirma(itemAprobando.id, "firmaGerenciaGeneral", d)} />
              </div>
              <div>
                <p className="text-[11px] font-medium mb-1" style={{ color: T.text }}>Gerencia de Marketing</p>
                <SignaturePad value={itemAprobando.firmaGerenciaMarketing} onChange={(d) => guardarFirma(itemAprobando.id, "firmaGerenciaMarketing", d)} />
              </div>
            </div>
            <button
              onClick={async () => {
                if (itemAprobando.firmaGerenciaGeneral && itemAprobando.firmaGerenciaMarketing) {
                  // Releer la lista compartida fresca antes de escribir (no pisar cambios de otros).
                  const { next } = await mutateShared("produccion-contenido", true, (current) =>
                    current.map((i) => (i.id === itemAprobando.id ? { ...i, etapa: "grabacion" } : i))
                  );
                  setItems(next);
                  setAprobando(null);
                }
              }}
              disabled={!itemAprobando.firmaGerenciaGeneral || !itemAprobando.firmaGerenciaMarketing}
              className="w-full py-2.5 rounded-lg font-medium text-sm text-white"
              style={{ background: T.purple, opacity: (itemAprobando.firmaGerenciaGeneral && itemAprobando.firmaGerenciaMarketing) ? 1 : 0.5 }}
            >
              Confirmar y pasar a Grabación
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- PROYECTOS (flujograma) ---------------------------------- */
const ETAPAS_PROYECTO = [
  { id: "idea", label: "Idea" },
  { id: "implementacion", label: "Implementación" },
  { id: "acciones", label: "Acciones" },
  { id: "aplicaciones", label: "Aplicaciones" },
  { id: "fecha_implementacion", label: "Fecha de implementación" },
];
const emptyProyectoForm = { nombre: "", descripcion: "", fechaImplementacion: "" };

function ProyectosPanel() {
  const [proyectos, setProyectos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyProyectoForm);
  const [formError, setFormError] = useState(null);
  const [expandido, setExpandido] = useState(null);
  const [firmando, setFirmando] = useState(null); // {proyectoId, quien}

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("proyectos-flujo", true);
        setProyectos(res ? JSON.parse(res.value) : []);
      } catch (e) {
        setProyectos([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = async (next) => {
    setProyectos(next);
    try {
      const res = await window.storage.set("proyectos-flujo", JSON.stringify(next), true);
      setSaveError(res ? null : "No se pudo guardar. Intenta de nuevo.");
    } catch (e) {
      setSaveError("No se pudo guardar. Intenta de nuevo.");
    }
  };

  const crear = async () => {
    if (!form.nombre.trim()) { setFormError("Ponle un nombre al proyecto."); return; }
    const nuevo = {
      ...form, id: uid(), etapa: "idea", creado: nowStamp(),
      aprobaciones: { coordinacion: null, gerenciaGeneral: null, gerenciaMarketing: null },
    };
    const { next, ok } = await mutateShared("proyectos-flujo", true, (current) => [nuevo, ...current]);
    setProyectos(next);
    setSaveError(ok ? null : "No se pudo guardar. Intenta de nuevo.");
    setForm(emptyProyectoForm);
    setFormError(null);
    setShowForm(false);
  };

  const cambiarEtapa = async (id, etapa) => {
    const { next, ok } = await mutateShared("proyectos-flujo", true, (current) => current.map((p) => (p.id === id ? { ...p, etapa } : p)));
    setProyectos(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };
  const eliminar = async (id) => {
    const { next, ok } = await mutateShared("proyectos-flujo", true, (current) => current.filter((p) => p.id !== id));
    setProyectos(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };

  const guardarAprobacion = async (id, quien, dataUrl) => {
    const { next, ok } = await mutateShared("proyectos-flujo", true, (current) =>
      current.map((p) => (p.id === id ? { ...p, aprobaciones: { ...p.aprobaciones, [quien]: dataUrl } } : p))
    );
    setProyectos(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
    setFirmando(null);
  };

  const APROBADORES = [
    { id: "coordinacion", label: "Coordinación de Marketing", nota: "Valida diseño, audiovisual y demás detalles" },
    { id: "gerenciaGeneral", label: "Gerencia General", nota: "Aprobación final" },
    { id: "gerenciaMarketing", label: "Gerencia de Marketing", nota: "Aprobación final" },
  ];

  const proyectoFirmando = (proyectos || []).find((p) => p.id === firmando?.proyectoId);

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <p className="text-sm" style={{ color: T.dim }}>Idea → implementación → acciones → aplicaciones → fecha de implementación, con aprobación de Coordinación y ambas Gerencias.</p>
        <button onClick={() => { setForm(emptyProyectoForm); setFormError(null); setShowForm((s) => !s); }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: showForm ? T.dim : T.blue }}>
          {showForm ? "Cancelar" : <><Plus size={16} strokeWidth={2.5} /> Nuevo proyecto</>}
        </button>
      </div>

      {saveError && <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: (T.rose + "1F"), color: T.rose }}>{saveError}</div>}

      {showForm && (
        <div className="rounded-xl p-5 mb-6" style={{ background: T.panel, border: `1px solid ${T.blue}55` }}>
          <h3 className="disp text-sm font-semibold mb-4" style={{ color: T.text }}>Nuevo proyecto</h3>
          {formError && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: (T.rose + "1F"), color: T.rose }}>{formError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              Nombre del proyecto *
              <input className="w-full mt-1" placeholder="Ej. Rediseño de flujo de citas" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </label>
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              Descripción de la idea
              <textarea rows={2} className="w-full mt-1 resize-none" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Fecha tentativa de implementación
              <input type="date" className="w-full mt-1" value={form.fechaImplementacion} onChange={(e) => setForm({ ...form, fechaImplementacion: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-2 mt-5">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg font-medium text-sm" style={{ background: T.panelAlt, color: T.dim }}>Cancelar</button>
            <button type="button" onClick={crear} className="flex-1 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.blue }}>Crear proyecto</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: T.dim }}>Cargando…</p>
      ) : (proyectos || []).length === 0 ? (
        <div className="text-sm text-center py-10 rounded-lg" style={{ color: "#94A3B8", border: `1px dashed ${T.border}` }}>Todavía no hay proyectos.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {(proyectos || []).map((p) => {
            const etapaIdx = ETAPAS_PROYECTO.findIndex((e) => e.id === p.etapa);
            const todasAprobadas = APROBADORES.every((a) => p.aprobaciones[a.id]);
            return (
              <div key={p.id} className="rounded-xl p-4" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold" style={{ color: T.text }}>{p.nombre}</p>
                      {todasAprobadas && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: T.teal + "14", color: T.teal }}>APROBADO</span>}
                    </div>
                    {p.descripcion && <p className="text-xs mt-0.5" style={{ color: T.dim }}>{p.descripcion}</p>}
                    {p.fechaImplementacion && <p className="text-[11px] mt-1 mono" style={{ color: "#94A3B8" }}>Implementación: {p.fechaImplementacion}</p>}
                  </div>
                  <button onClick={() => eliminar(p.id)}><Trash2 size={14} color={T.rose} /></button>
                </div>

                {/* Stepper del flujograma */}
                <div className="flex items-center mb-4 overflow-x-auto">
                  {ETAPAS_PROYECTO.map((e, i) => (
                    <React.Fragment key={e.id}>
                      <button onClick={() => cambiarEtapa(p.id, e.id)} className="flex flex-col items-center gap-1 shrink-0" style={{ minWidth: 90 }}>
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold" style={{ background: i <= etapaIdx ? T.blue : T.panelAlt, color: i <= etapaIdx ? "#fff" : "#94A3B8" }}>{i + 1}</span>
                        <span className="text-[10px] text-center" style={{ color: i <= etapaIdx ? T.blue : "#94A3B8" }}>{e.label}</span>
                      </button>
                      {i < ETAPAS_PROYECTO.length - 1 && <div className="h-0.5 flex-1" style={{ background: i < etapaIdx ? T.blue : T.border, minWidth: 20 }} />}
                    </React.Fragment>
                  ))}
                </div>

                {/* Cadena de aprobación */}
                <div className="flex items-center flex-wrap gap-2 pt-3" style={{ borderTop: `1px solid ${T.border}` }}>
                  <span className="text-[11px]" style={{ color: "#94A3B8" }}>Aprobación:</span>
                  {APROBADORES.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setFirmando({ proyectoId: p.id, quien: a.id })}
                      title={a.nota}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1"
                      style={{ background: p.aprobaciones[a.id] ? T.teal + "14" : T.panelAlt, color: p.aprobaciones[a.id] ? T.teal : "#94A3B8", border: `1px solid ${p.aprobaciones[a.id] ? T.teal + "55" : T.border}` }}
                    >
                      {p.aprobaciones[a.id] ? <Check size={11} /> : null} {a.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {proyectoFirmando && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: "#0F172A55" }} onClick={() => setFirmando(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xs rounded-xl p-5" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="disp text-sm font-semibold" style={{ color: T.text }}>{APROBADORES.find((a) => a.id === firmando.quien)?.label}</h3>
              <button onClick={() => setFirmando(null)}><X size={16} color={T.dim} /></button>
            </div>
            <p className="text-[11px] mb-3" style={{ color: "#94A3B8" }}>Firma para aprobar "{proyectoFirmando.nombre}"</p>
            <SignaturePad
              value={proyectoFirmando.aprobaciones[firmando.quien]}
              onChange={(d) => guardarAprobacion(proyectoFirmando.id, firmando.quien, d)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- REUNIONES (se agendan aparte; al llegar la fecha, se convierten solas en pendiente y quedan bloqueadas) ---------------------------------- */
const emptyReunionForm = { titulo: "", fecha: localISO(), hora: "", area: "gerencia", participantes: "", descripcion: "" };

function ReunionesPanel() {
  const [reuniones, setReuniones] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyReunionForm);
  const [formError, setFormError] = useState(null);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("reuniones-agendadas", true);
        setReuniones(res ? JSON.parse(res.value) : []);
      } catch (e) {
        setReuniones([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const crear = async () => {
    if (!form.titulo.trim()) { setFormError("Ponle un título a la reunión."); return; }
    if (!form.fecha) { setFormError("Elige una fecha."); return; }
    const nueva = { ...form, id: uid(), pendienteGeneradoId: null, creado: nowStamp() };
    const { next, ok } = await mutateShared("reuniones-agendadas", true, (current) => [nueva, ...current]);
    setReuniones(next);
    setSaveError(ok ? null : "No se pudo guardar. Intenta de nuevo.");
    setForm(emptyReunionForm);
    setFormError(null);
    setShowForm(false);
  };

  const eliminar = async (id) => {
    const { next, ok } = await mutateShared("reuniones-agendadas", true, (current) => current.filter((r) => r.id !== id));
    setReuniones(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };

  const hoy = localISO();
  const pendientesDeAgendar = useMemo(() => (reuniones || []).filter((r) => !r.pendienteGeneradoId && r.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha)), [reuniones]);
  const yaConvertidas = useMemo(() => (reuniones || []).filter((r) => r.pendienteGeneradoId).sort((a, b) => b.fecha.localeCompare(a.fecha)), [reuniones]);

  if (loading) return <div className="text-sm" style={{ color: T.dim }}>Cargando…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="disp text-lg font-semibold" style={{ color: T.text }}>Reuniones</h2>
          <p className="text-sm mt-1" style={{ color: T.dim }}>Agenda tus reuniones aquí. El día que llegue la fecha, se crean solas como pendiente en Gestión — y ya no se pueden borrar por error.</p>
        </div>
        <button onClick={() => { setForm(emptyReunionForm); setFormError(null); setShowForm((s) => !s); }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-white shrink-0" style={{ background: showForm ? T.dim : T.blue }}>
          {showForm ? "Cancelar" : <><Plus size={16} strokeWidth={2.5} /> Nueva reunión</>}
        </button>
      </div>

      {saveError && <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: T.rose + "1F", color: T.rose }}>{saveError}</div>}

      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard icon={<Calendar size={16} />} label="Reuniones agendadas" value={pendientesDeAgendar.length} color={T.blue} />
        <StatCard icon={<Lock size={16} />} label="Ya convertidas en pendiente" value={yaConvertidas.length} color={T.teal} />
      </div>

      {showForm && (
        <div className="rounded-xl p-5 mb-5" style={{ background: T.panel, border: `1px solid ${T.blue}55` }}>
          <h3 className="disp text-sm font-semibold mb-4" style={{ color: T.text }}>Nueva reunión</h3>
          {formError && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: T.rose + "1F", color: T.rose }}>{formError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              Título *
              <input className="w-full mt-1" placeholder="Ej. Reunión de cierre de mes con Gerencia" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Fecha *
              <input type="date" className="w-full mt-1" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Hora
              <input type="time" className="w-full mt-1" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Área a la que se le asignará el pendiente
              <select className="w-full mt-1" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}>
                {DEPARTAMENTOS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Participantes
              <input className="w-full mt-1" placeholder="Nombres separados por coma" value={form.participantes} onChange={(e) => setForm({ ...form, participantes: e.target.value })} />
            </label>
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              Notas
              <textarea rows={2} className="w-full mt-1 resize-none" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-2 mt-5">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg font-medium text-sm" style={{ background: T.panelAlt, color: T.dim }}>Cancelar</button>
            <button type="button" onClick={crear} className="flex-1 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.blue }}>Guardar</button>
          </div>
        </div>
      )}

      <p className="text-xs font-semibold mb-2" style={{ color: T.dim }}>PRÓXIMAS (todavía no llega su fecha)</p>
      {pendientesDeAgendar.length === 0 ? (
        <p className="text-sm mb-6" style={{ color: "#94A3B8" }}>No hay reuniones agendadas por venir.</p>
      ) : (
        <div className="flex flex-col gap-2 mb-6">
          {pendientesDeAgendar.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
              <span className="text-xs mono shrink-0" style={{ color: T.blue, width: 90 }}>{r.fecha}{r.hora ? ` ${r.hora}` : ""}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: T.text }}>{r.titulo}</p>
                <p className="text-[11px]" style={{ color: "#8CA0C7" }}>{deptMeta(r.area).label}{r.participantes ? ` · ${r.participantes}` : ""}</p>
              </div>
              <button onClick={() => eliminar(r.id)}><Trash2 size={13} color={T.rose} /></button>
            </div>
          ))}
        </div>
      )}

      {yaConvertidas.length > 0 && (
        <>
          <p className="text-xs font-semibold mb-2" style={{ color: T.dim }}>YA CONVERTIDAS EN PENDIENTE</p>
          <div className="flex flex-col gap-2">
            {yaConvertidas.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: T.panelAlt, border: `1px solid ${T.border}` }}>
                <Lock size={13} color={T.dim} className="shrink-0" />
                <span className="text-xs mono shrink-0" style={{ color: T.dim, width: 80 }}>{r.fecha}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: T.dim }}>{r.titulo}</p>
                </div>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: T.teal + "1A", color: T.teal }}>{deptMeta(r.area).label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CalendarioPanel() {
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [tiposActivos, setTiposActivos] = useState(["pendiente", "reunion", "otro"]);
  const [areaFiltro, setAreaFiltro] = useState("todas");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyEventForm);
  const [formError, setFormError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [vistaModo, setVistaModo] = useState("mes"); // mes | semana | dia | gantt

  const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };
  const startOfWeek = (date) => { const d = new Date(date); const offset = (d.getDay() + 6) % 7; return addDays(d, -offset); };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.storage.get("marketing-tasks-v2", true);
      setTasks(res ? JSON.parse(res.value) : []);
    } catch (e) { setTasks([]); }
    try {
      const res2 = await window.storage.get("calendar-events", true);
      setEvents(res2 ? JSON.parse(res2.value) : []);
    } catch (e) { setEvents([]); }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const persistEvents = useCallback(async (next) => {
    setEvents(next);
    try {
      const res = await window.storage.set("calendar-events", JSON.stringify(next), true);
      setSaveError(res ? null : "No se pudo guardar. Intenta de nuevo.");
    } catch (e) {
      setSaveError("No se pudo guardar. Intenta de nuevo.");
    }
  }, []);

  const addEvent = async () => {
    if (!form.titulo.trim()) { setFormError("Ponle un título al evento."); return; }
    if (!form.inicio) { setFormError("Elige una fecha de inicio."); return; }
    const nuevoEvento = { ...form, fin: form.fin || form.inicio, id: uid() };
    const { next, ok } = await mutateShared("calendar-events", true, (current) => [nuevoEvento, ...current]);
    setEvents(next);
    setSaveError(ok ? null : "No se pudo guardar. Intenta de nuevo.");
    setForm(emptyEventForm);
    setFormError(null);
    setShowForm(false);
  };
  const removeEvent = async (id) => {
    const { next, ok } = await mutateShared("calendar-events", true, (current) => current.filter((e) => e.id !== id));
    setEvents(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };

  // Unifica pendientes (rango: fecha de ingreso -> fecha límite) y eventos manuales
  const unificados = useMemo(() => {
    const fromTasks = tasks.map((t) => ({
      id: t.id,
      tipo: "pendiente",
      titulo: t.titulo,
      inicio: t.fechaInicio || localISO(new Date(t.creado || Date.now())),
      fin: t.fecha || t.fechaInicio || localISO(new Date(t.creado || Date.now())),
      area: t.departamento,
      color: deptMeta(t.departamento).color,
      estado: t.estado,
      responsables: t.responsables || [],
    }));
    const fromEvents = events.map((e) => ({
      id: e.id,
      tipo: e.tipo,
      titulo: e.titulo,
      inicio: e.inicio,
      fin: e.fin || e.inicio,
      area: e.area,
      color: areaMeta(e.area).color,
      descripcion: e.descripcion,
    }));
    return [...fromTasks, ...fromEvents].filter((it) => {
      if (!tiposActivos.includes(it.tipo)) return false;
      if (areaFiltro !== "todas" && it.area !== areaFiltro) return false;
      return true;
    });
  }, [tasks, events, tiposActivos, areaFiltro]);

  const grid = useMemo(() => getMonthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);

  const diasSemana7 = useMemo(() => {
    const inicio = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(inicio, i));
  }, [cursor]);

  const diasDelMesGantt = useMemo(() => {
    const year = cursor.getFullYear(), month = cursor.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
  }, [cursor]);

  const eventosPorDia = useMemo(() => {
    const map = {};
    grid.forEach(({ date }) => {
      const key = toKey(date);
      map[key] = unificados.filter((it) => key >= it.inicio && key <= it.fin);
    });
    diasSemana7.forEach((date) => {
      const key = toKey(date);
      if (!map[key]) map[key] = unificados.filter((it) => key >= it.inicio && key <= it.fin);
    });
    return map;
  }, [grid, diasSemana7, unificados]);

  const itemsGantt = useMemo(() => {
    if (diasDelMesGantt.length === 0) return [];
    const first = toKey(diasDelMesGantt[0]);
    const last = toKey(diasDelMesGantt[diasDelMesGantt.length - 1]);
    return unificados
      .filter((it) => it.inicio <= last && it.fin >= first)
      .map((it) => {
        const startCol = it.inicio < first ? 1 : new Date(it.inicio + "T00:00:00").getDate();
        const endCol = it.fin > last ? diasDelMesGantt.length : new Date(it.fin + "T00:00:00").getDate();
        return { ...it, startCol, endCol };
      });
  }, [unificados, diasDelMesGantt]);

  const toggleTipo = (id) => setTiposActivos((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

  const selectedEvents = eventosPorDia[selectedDate] || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <p className="text-sm" style={{ color: T.dim }}>
          Pendientes, reuniones y otros eventos del equipo en un solo calendario.
          {!loading && <span className="ml-2" style={{ color: "#94A3B8" }}>({tasks.length} pendientes y {events.length} eventos cargados)</span>}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={loadAll} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium" style={{ background: T.panelAlt, color: T.dim, border: `1px solid ${T.border}` }}>
            Recargar
          </button>
          <button onClick={() => { setForm({ ...emptyEventForm, inicio: selectedDate }); setFormError(null); setShowForm((s) => !s); }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-white transition-transform hover:scale-[1.02]" style={{ background: showForm ? T.dim : T.blue }}>
            {showForm ? "Cancelar" : <><Plus size={16} strokeWidth={2.5} /> Nuevo evento</>}
          </button>
        </div>
      </div>

      {saveError && <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: (T.rose + "1F"), color: T.rose, border: `1px solid ${T.rose}33` }}>{saveError}</div>}

      {showForm && (
        <div className="rounded-xl p-5 mb-6" style={{ background: T.panel, border: `1px solid ${T.blue}55` }}>
          <h3 className="disp text-sm font-semibold mb-4" style={{ color: T.text }}>Nuevo evento</h3>
          {formError && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: (T.rose + "1F"), color: T.rose, border: `1px solid ${T.rose}33` }}>{formError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs" style={{ color: T.dim }}>
              Tipo
              <select className="w-full mt-1" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                <option value="reunion">Reunión</option>
                <option value="otro">Otro</option>
              </select>
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Área / tema
              <select className="w-full mt-1" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}>
                {AREAS_CALENDARIO.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </label>
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              Título *
              <input className="w-full mt-1" placeholder="Ej. Reunión de resultados semanal" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Fecha inicio *
              <input type="date" className="w-full mt-1" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Fecha fin (opcional)
              <input type="date" className="w-full mt-1" value={form.fin} onChange={(e) => setForm({ ...form, fin: e.target.value })} />
            </label>
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              Descripción
              <textarea rows={2} className="w-full mt-1 resize-none" placeholder="Detalles opcionales" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-2 mt-5">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg font-medium text-sm" style={{ background: T.panelAlt, color: T.dim }}>Cancelar</button>
            <button type="button" onClick={addEvent} className="flex-1 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.blue }}>Guardar evento</button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center flex-wrap gap-2 mb-5">
        {TIPOS_EVENTO.map((t) => {
          const active = tiposActivos.includes(t.id);
          return (
            <button key={t.id} onClick={() => toggleTipo(t.id)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors" style={{ background: active ? t.color + "1A" : T.panelAlt, color: active ? t.color : "#94A3B8", border: `1px solid ${active ? t.color + "55" : T.border}` }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.color }} />
              {t.label}
            </button>
          );
        })}
        <select value={areaFiltro} onChange={(e) => setAreaFiltro(e.target.value)} className="text-xs ml-auto">
          <option value="todas">Todas las áreas</option>
          {AREAS_CALENDARIO.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </div>

      {/* Selector de vista */}
      <div className="flex items-center gap-1 mb-4">
        {[{ id: "mes", label: "Mes" }, { id: "semana", label: "Semana" }, { id: "dia", label: "Día" }, { id: "gantt", label: "Gantt" }].map((v) => (
          <button key={v.id} onClick={() => setVistaModo(v.id)} className="text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: vistaModo === v.id ? T.blue + "14" : T.panelAlt, color: vistaModo === v.id ? T.blue : "#94A3B8", border: `1px solid ${vistaModo === v.id ? T.blue + "55" : T.border}` }}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Navegación */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => {
            if (vistaModo === "semana") setCursor(addDays(cursor, -7));
            else if (vistaModo === "dia") { const d = addDays(cursor, -1); setCursor(d); setSelectedDate(toKey(d)); }
            else setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
          }}
          className="p-1.5 rounded-lg" style={{ background: T.panelAlt }}
        >
          <ChevronLeft size={16} color={T.dim} />
        </button>
        <div className="flex items-center gap-2">
          <CalendarDays size={16} color={T.blue} />
          <h3 className="disp text-base font-semibold" style={{ color: T.text }}>
            {vistaModo === "semana"
              ? `${diasSemana7[0].getDate()} ${MESES[diasSemana7[0].getMonth()].slice(0, 3)} – ${diasSemana7[6].getDate()} ${MESES[diasSemana7[6].getMonth()].slice(0, 3)} ${diasSemana7[6].getFullYear()}`
              : vistaModo === "dia"
              ? new Date(selectedDate + "T00:00:00").toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })
              : `${MESES[cursor.getMonth()]} ${cursor.getFullYear()}`}
          </h3>
          <button
            onClick={() => { const n = new Date(); setCursor(vistaModo === "dia" || vistaModo === "semana" ? n : new Date(n.getFullYear(), n.getMonth(), 1)); setSelectedDate(todayKey); }}
            className="text-[11px] font-medium px-2 py-1 rounded-full" style={{ background: T.panelAlt, color: T.blue }}
          >
            Hoy
          </button>
        </div>
        <button
          onClick={() => {
            if (vistaModo === "semana") setCursor(addDays(cursor, 7));
            else if (vistaModo === "dia") { const d = addDays(cursor, 1); setCursor(d); setSelectedDate(toKey(d)); }
            else setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
          }}
          className="p-1.5 rounded-lg" style={{ background: T.panelAlt }}
        >
          <ChevronRight size={16} color={T.dim} />
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm" style={{ color: T.dim }}>Cargando…</div>
      ) : vistaModo === "gantt" ? (
        <div className="rounded-xl p-4" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
          {itemsGantt.length === 0 ? (
            <p className="text-xs text-center py-10" style={{ color: "#94A3B8" }}>Nada vigente este mes con los filtros actuales.</p>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: diasDelMesGantt.length * 26 + 170 }}>
                <div className="flex mb-2" style={{ marginLeft: 170 }}>
                  {diasDelMesGantt.map((d) => (
                    <div key={toKey(d)} className="text-center text-[9px] mono shrink-0" style={{ width: 26, color: toKey(d) === todayKey ? T.blue : "#94A3B8", fontWeight: toKey(d) === todayKey ? 700 : 400 }}>
                      {d.getDate()}
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-1.5">
                  {itemsGantt.map((it) => (
                    <div key={it.id} className="flex items-center" style={{ height: 24 }}>
                      <div className="text-xs truncate pr-2 shrink-0 flex items-center gap-1" style={{ width: 170 }} title={it.titulo}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: it.color }} />
                        <span className="truncate" style={{ color: T.text }}>{it.titulo}</span>
                      </div>
                      <div className="relative flex-1" style={{ height: 16, width: diasDelMesGantt.length * 26 }}>
                        <div
                          title={`${it.inicio} → ${it.fin}`}
                          className="absolute rounded-md flex items-center px-1.5"
                          style={{
                            left: (it.startCol - 1) * 26, width: Math.max(26, (it.endCol - it.startCol + 1) * 26 - 2),
                            height: 16, background: it.color + (it.estado === "done" ? "55" : "cc"),
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : vistaModo === "semana" ? (
        <div className="grid grid-cols-7 gap-1.5">
          {diasSemana7.map((date) => {
            const key = toKey(date);
            const dayEvents = eventosPorDia[key] || [];
            const isToday = key === todayKey;
            return (
              <div key={key} className="rounded-lg p-2 flex flex-col" style={{ background: T.panel, border: `1px solid ${isToday ? T.blue + "88" : T.border}`, minHeight: 160 }}>
                <p className="text-[10px] font-semibold mb-0.5" style={{ color: "#94A3B8" }}>{DIAS_SEMANA[(date.getDay() + 6) % 7]}</p>
                <p className="mono text-xs mb-2" style={{ color: isToday ? T.blue : T.text, fontWeight: isToday ? 700 : 500 }}>{date.getDate()}</p>
                <div className="flex flex-col gap-1">
                  {dayEvents.slice(0, 6).map((ev) => (
                    <div key={ev.id} className="text-[10px] px-1.5 py-1 rounded truncate" style={{ background: ev.color + "1A", color: ev.color }} title={ev.titulo}>
                      {ev.titulo}
                    </div>
                  ))}
                  {dayEvents.length > 6 && <span className="text-[9px] mono" style={{ color: "#94A3B8" }}>+{dayEvents.length - 6} más</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : vistaModo === "dia" ? (
        <div className="rounded-xl p-4" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
          {(eventosPorDia[selectedDate] || []).length === 0 ? (
            <p className="text-xs" style={{ color: "#94A3B8" }}>Sin pendientes ni eventos vigentes este día.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {(eventosPorDia[selectedDate] || []).map((ev) => (
                <div key={ev.id} className="flex items-center gap-2.5 p-2.5 rounded-lg" style={{ background: T.panelAlt }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ev.color }} />
                  <div className="min-w-0">
                    <p className="text-sm" style={{ color: T.text }}>{ev.titulo}</p>
                    <p className="text-[11px]" style={{ color: "#94A3B8" }}>
                      {TIPOS_EVENTO.find((t) => t.id === ev.tipo)?.label} · {areaMeta(ev.area).label}
                      {ev.responsables?.length > 0 && ` · ${ev.responsables.join(", ")}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1.5 mb-6">
            {DIAS_SEMANA.map((d) => <div key={d} className="text-center text-[11px] font-semibold py-1" style={{ color: "#94A3B8" }}>{d}</div>)}
            {grid.map(({ date, outside }, i) => {
              const key = toKey(date);
              const dayEvents = eventosPorDia[key] || [];
              const isToday = key === todayKey;
              const isSelected = key === selectedDate;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(key)}
                  className="aspect-square rounded-lg p-1.5 text-left flex flex-col transition-colors"
                  style={{
                    background: isSelected ? T.blue + "12" : T.panel,
                    border: `1px solid ${isSelected ? T.blue : isToday ? T.blue + "88" : T.border}`,
                    opacity: outside ? 0.4 : 1,
                  }}
                >
                  <span className="mono text-[11px]" style={{ color: isToday ? T.blue : T.text, fontWeight: isToday ? 700 : 500 }}>{date.getDate()}</span>
                  <div className="flex flex-wrap gap-0.5 mt-auto">
                    {dayEvents.slice(0, 4).map((ev, j) => <span key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: ev.color }} />)}
                    {dayEvents.length > 4 && <span className="text-[9px] mono" style={{ color: "#94A3B8" }}>+{dayEvents.length - 4}</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detalle del día seleccionado */}
          <div className="rounded-xl p-4" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
            <h4 className="disp text-sm font-semibold mb-3" style={{ color: T.text }}>
              {new Date(selectedDate + "T00:00:00").toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}
            </h4>
            {selectedEvents.length === 0 ? (
              <p className="text-xs" style={{ color: "#94A3B8" }}>Sin pendientes ni eventos vigentes este día.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {selectedEvents.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg" style={{ background: T.panelAlt }}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ev.color }} />
                      <div className="min-w-0">
                        <p className="text-sm truncate" style={{ color: T.text }}>{ev.titulo}</p>
                        <p className="text-[11px]" style={{ color: "#94A3B8" }}>
                          {TIPOS_EVENTO.find((t) => t.id === ev.tipo)?.label} · {areaMeta(ev.area).label}
                          {ev.responsables?.length > 0 && ` · ${ev.responsables.join(", ")}`}
                          {ev.inicio !== ev.fin && ` · ${ev.inicio.slice(5)} al ${ev.fin.slice(5)}`}
                        </p>
                      </div>
                    </div>
                    {ev.tipo !== "pendiente" && (
                      <button onClick={() => removeEvent(ev.id)} className="shrink-0"><Trash2 size={13} color={T.rose} /></button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------------- APP ---------------------------------- */
function TicketOnlyView() {
  const [form, setForm] = useState(emptyTicketForm);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const enviar = async () => {
    if (!form.titulo.trim()) { setError("Cuéntanos qué necesitas."); return; }
    if (!form.areaOrigen.trim()) { setError("Indica qué área o sede lo reporta."); return; }
    try {
      // Endpoint PÚBLICO: no requiere sesión (esta pantalla la usa gente de otras áreas sin cuenta).
      const res = await fetch("/api/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) setSent(true);
      else setError("No se pudo enviar. Intenta de nuevo.");
    } catch (e) {
      setError("No se pudo enviar. Revisa tu conexión e intenta de nuevo.");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6" style={{ background: T.bg, fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
        .disp { font-family: 'Space Grotesk', sans-serif; }
        input, select, textarea {
          background: ${T.panelAlt}; border: 1px solid ${T.border}; color: ${T.text};
          border-radius: 8px; padding: 10px 12px; font-size: 14px; outline: none; font-family: 'Inter', sans-serif; width: 100%;
        }
        input:focus, select:focus, textarea:focus { border-color: ${T.blue}; }
      `}</style>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: T.panel, border: `1px solid ${T.border}`, boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${T.blue}, ${T.blueDark})` }}>
            <LimablueDots color="#FFFFFF" size={20} />
          </div>
          <div>
            <p className="disp text-base font-semibold" style={{ color: T.text }}>Limablue · Marketing</p>
            <p className="text-xs" style={{ color: T.dim }}>Reportar un pendiente</p>
          </div>
        </div>

        {sent ? (
          <div className="text-center py-6">
            <CheckCircle2 size={32} color={T.teal} className="mx-auto mb-3" />
            <p className="text-sm font-medium" style={{ color: T.text }}>¡Enviado! Gracias.</p>
            <p className="text-xs mt-1" style={{ color: T.dim }}>El equipo de Marketing lo revisará y te confirmará por sus medios habituales.</p>
            <button onClick={() => { setForm(emptyTicketForm); setSent(false); }} className="mt-4 text-xs font-medium" style={{ color: T.blue }}>Enviar otro pendiente</button>
          </div>
        ) : (
          <>
            {error && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: (T.rose + "1F"), color: T.rose, border: `1px solid ${T.rose}33` }}>{error}</div>}
            <div className="flex flex-col gap-3">
              <label className="text-xs" style={{ color: T.dim }}>
                ¿Qué necesitas? *
                <div className="mt-1"><input placeholder="Ej. Necesitamos banner para promoción de julio" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
              </label>
              <label className="text-xs" style={{ color: T.dim }}>
                Detalles
                <div className="mt-1"><textarea rows={3} className="resize-none" placeholder="Contexto opcional" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
              </label>
              <label className="text-xs" style={{ color: T.dim }}>
                Área o sede que reporta *
                <div className="mt-1"><input placeholder="Ej. Recepción San Isidro" value={form.areaOrigen} onChange={(e) => setForm({ ...form, areaOrigen: e.target.value })} /></div>
              </label>
              <label className="text-xs" style={{ color: T.dim }}>
                Tu nombre
                <div className="mt-1"><input placeholder="Opcional" value={form.nombreReporta} onChange={(e) => setForm({ ...form, nombreReporta: e.target.value })} /></div>
              </label>
              <label className="flex items-center gap-2 text-xs" style={{ color: T.dim }}>
                <input type="checkbox" className="w-auto" checked={form.requiereReunion} onChange={(e) => setForm({ ...form, requiereReunion: e.target.checked })} />
                ¿Amerita una reunión?
              </label>
              {form.requiereReunion && (
                <label className="text-xs" style={{ color: T.dim }}>
                  Fecha propuesta
                  <div className="mt-1"><input type="date" value={form.fechaPropuesta} onChange={(e) => setForm({ ...form, fechaPropuesta: e.target.value })} /></div>
                </label>
              )}
              <label className="text-xs" style={{ color: T.dim }}>
                Foto (opcional)
                <div className="flex items-center gap-2 mt-1">
                  <input type="file" accept="image/*" id="ticket-ext-foto-input" className="hidden" onChange={(e) => { if (e.target.files?.[0]) comprimirImagen(e.target.files[0], (dataUrl) => setForm((f) => ({ ...f, foto: dataUrl }))); }} />
                  <label htmlFor="ticket-ext-foto-input" className="cursor-pointer flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg" style={{ background: T.panelAlt, color: T.rose, border: `1px solid ${T.border}` }}>
                    <ImagePlus size={13} /> {form.foto ? "Cambiar foto" : "Adjuntar foto"}
                  </label>
                  {form.foto && <img src={form.foto} alt="Adjunto" className="w-10 h-10 rounded-md object-cover" style={{ border: `1px solid ${T.border}` }} />}
                </div>
              </label>
              <button onClick={enviar} className="w-full mt-2 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.rose }}>Enviar pendiente</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = T.text;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = value;
    }
  }, []);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  };

  const start = (e) => {
    drawing.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current.toDataURL("image/png"));
  };
  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={220}
        height={70}
        className="w-full rounded-lg touch-none"
        style={{ background: "#FFFFFF", border: `1px dashed ${T.border}`, cursor: "crosshair" }}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      />
      <button type="button" onClick={clear} className="flex items-center gap-1.5 mt-2 text-[11px] font-medium" style={{ color: T.dim }}>
        <Eraser size={12} /> Limpiar firma
      </button>
    </div>
  );
}

const CATEGORIAS_REUNION = [
  { id: "general", label: "General" },
  { id: "sede_san_isidro", label: "Sede · San Isidro" },
  { id: "sede_one", label: "Sede · ONE" },
  { id: "sede_lince", label: "Sede · Lince" },
  { id: "sede_los_olivos", label: "Sede · Los Olivos" },
  { id: "sede_san_miguel", label: "Sede · San Miguel" },
  { id: "paid_media_semanal", label: "Paid Media · Semanal" },
];
const emptyActaForm = { fechaReunion: localISO(), categoria: "general", presentes: [], puntos: [], firmas: {} };

const NIVELES_IMPORTANCIA = [
  { id: "baja", label: "Baja", color: T.dim },
  { id: "media", label: "Media", color: T.amber },
  { id: "alta", label: "Alta", color: T.rose },
  { id: "critica", label: "Crítica", color: "#991B1B" },
];
const emptyInformeForm = { titulo: "", proveedor: "", estado: "en_curso", nivelImportancia: "media" };

function InformesPanel({ onBack }) {
  const [vista, setVista] = useState("lista"); // lista | nuevo | detalle
  const [informes, setInformes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(null);
  const [form, setForm] = useState(emptyInformeForm);
  const [detalleId, setDetalleId] = useState(null);
  const [avanceTexto, setAvanceTexto] = useState("");
  const [avanceFecha, setAvanceFecha] = useState(localISO());
  const [avanceArchivo, setAvanceArchivo] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("informes-avance", true);
        setInformes(res ? JSON.parse(res.value) : []);
      } catch (e) {
        setInformes([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persistInformes = async (next) => {
    setInformes(next);
    try {
      const res = await window.storage.set("informes-avance", JSON.stringify(next), true);
      setSaveError(res ? null : "No se pudo guardar. Intenta de nuevo.");
    } catch (e) {
      setSaveError("No se pudo guardar. Intenta de nuevo.");
    }
  };

  const crearInforme = async () => {
    if (!form.titulo.trim()) { setSaveError("Ponle un título al informe."); return; }
    const nuevo = { ...form, id: uid(), creado: nowStamp(), avances: [] };
    const { next, ok } = await mutateShared("informes-avance", true, (current) => [nuevo, ...current]);
    setInformes(next);
    setSaveError(ok ? null : "No se pudo guardar. Intenta de nuevo.");
    setForm(emptyInformeForm);
    setVista("lista");
  };

  const eliminarInforme = async (id) => {
    const { next, ok } = await mutateShared("informes-avance", true, (current) => current.filter((i) => i.id !== id));
    setInformes(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
    if (detalleId === id) setVista("lista");
  };

  const handleArchivo = (file) => {
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxSide = 800;
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          setAvanceArchivo({ name: file.name, type: "image", dataUrl: canvas.toDataURL("image/jpeg", 0.72) });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    } else {
      if (file.size > 800 * 1024) { setSaveError(`"${file.name}" pesa demasiado (máx. ~800KB).`); return; }
      const reader = new FileReader();
      reader.onload = () => setAvanceArchivo({ name: file.name, type: "file", dataUrl: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const agregarAvance = async () => {
    if (!avanceTexto.trim()) { setSaveError("Escribe qué se avanzó."); return; }
    const nuevoAvance = { id: uid(), fecha: avanceFecha, texto: avanceTexto.trim(), archivo: avanceArchivo, creado: nowStamp() };
    const { next, ok } = await mutateShared("informes-avance", true, (current) =>
      current.map((i) => (i.id === detalleId ? { ...i, avances: [nuevoAvance, ...i.avances] } : i))
    );
    setInformes(next);
    setSaveError(ok ? null : "No se pudo guardar. Intenta de nuevo.");
    setAvanceTexto("");
    setAvanceFecha(localISO());
    setAvanceArchivo(null);
  };

  const cambiarEstado = async (id, estado) => {
    const { next, ok } = await mutateShared("informes-avance", true, (current) => current.map((i) => (i.id === id ? { ...i, estado } : i)));
    setInformes(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };

  const informeDetalle = (informes || []).find((i) => i.id === detalleId);

  return (
    <div>
      {saveError && <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: (T.rose + "1F"), color: T.rose, border: `1px solid ${T.rose}33` }}>{saveError}</div>}

      {vista === "lista" && (
        <div>
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <button onClick={onBack} className="text-xs font-medium flex items-center gap-1" style={{ color: T.dim }}>
              <ChevronLeft size={14} /> Biblioteca
            </button>
            <button onClick={() => { setForm(emptyInformeForm); setVista("nuevo"); }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.blue }}>
              <Plus size={16} strokeWidth={2.5} /> Nuevo informe
            </button>
          </div>
          {loading ? (
            <p className="text-sm" style={{ color: T.dim }}>Cargando…</p>
          ) : (informes || []).length === 0 ? (
            <div className="text-sm text-center py-10 rounded-lg" style={{ color: "#94A3B8", border: `1px dashed ${T.border}` }}>Todavía no hay informes de avance.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {(informes || []).map((i) => (
                <button key={i.id} onClick={() => { setDetalleId(i.id); setVista("detalle"); }} className="rounded-xl p-4 text-left flex items-center justify-between gap-3" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: T.text }}>{i.titulo}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{i.proveedor && `${i.proveedor} · `}{i.avances.length} avance(s) registrados</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {i.nivelImportancia && (
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: (NIVELES_IMPORTANCIA.find((n) => n.id === i.nivelImportancia) || NIVELES_IMPORTANCIA[1]).color + "14", color: (NIVELES_IMPORTANCIA.find((n) => n.id === i.nivelImportancia) || NIVELES_IMPORTANCIA[1]).color }}>
                        {(NIVELES_IMPORTANCIA.find((n) => n.id === i.nivelImportancia) || NIVELES_IMPORTANCIA[1]).label}
                      </span>
                    )}
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: (i.estado === "completado" ? T.teal : T.amber) + "14", color: i.estado === "completado" ? T.teal : T.amber }}>
                      {i.estado === "completado" ? "Completado" : "En curso"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {vista === "nuevo" && (
        <div>
          <button onClick={() => setVista("lista")} className="text-xs font-medium flex items-center gap-1 mb-4" style={{ color: T.dim }}>
            <ChevronLeft size={14} /> Cancelar
          </button>
          <div className="rounded-xl p-5" style={{ background: T.panel, border: `1px solid ${T.blue}55` }}>
            <h3 className="disp text-sm font-semibold mb-4" style={{ color: T.text }}>Nuevo informe de avance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
                Título *
                <input className="w-full mt-1" placeholder="Ej. Producción audiovisual — Casa Realizadora XYZ" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
              </label>
              <label className="text-xs" style={{ color: T.dim }}>
                Proveedor / responsable externo
                <input className="w-full mt-1" placeholder="Opcional" value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} />
              </label>
              <label className="text-xs" style={{ color: T.dim }}>
                Estado
                <select className="w-full mt-1" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                  <option value="en_curso">En curso</option>
                  <option value="completado">Completado</option>
                </select>
              </label>
              <label className="text-xs" style={{ color: T.dim }}>
                Nivel de importancia
                <select className="w-full mt-1" value={form.nivelImportancia} onChange={(e) => setForm({ ...form, nivelImportancia: e.target.value })}>
                  {NIVELES_IMPORTANCIA.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
                </select>
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button type="button" onClick={() => setVista("lista")} className="flex-1 py-2.5 rounded-lg font-medium text-sm" style={{ background: T.panelAlt, color: T.dim }}>Cancelar</button>
              <button type="button" onClick={crearInforme} className="flex-1 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.blue }}>Crear informe</button>
            </div>
          </div>
        </div>
      )}

      {vista === "detalle" && informeDetalle && (
        <div>
          <button onClick={() => setVista("lista")} className="text-xs font-medium flex items-center gap-1 mb-4" style={{ color: T.dim }}>
            <ChevronLeft size={14} /> Informes
          </button>
          <div className="rounded-xl p-5 mb-4" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
            <div className="flex items-start justify-between gap-3 mb-1">
              <div>
                <h3 className="disp text-base font-semibold" style={{ color: T.text }}>{informeDetalle.titulo}</h3>
                {informeDetalle.proveedor && <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{informeDetalle.proveedor}</p>}
              </div>
              <button onClick={() => eliminarInforme(informeDetalle.id)}><Trash2 size={15} color={T.rose} /></button>
            </div>
            <div className="flex items-center gap-2 mt-3">
              {[{ id: "en_curso", label: "En curso", color: T.amber }, { id: "completado", label: "Completado", color: T.teal }].map((s) => (
                <button key={s.id} onClick={() => cambiarEstado(informeDetalle.id, s.id)} className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ background: informeDetalle.estado === s.id ? s.color + "1A" : T.panelAlt, color: informeDetalle.estado === s.id ? s.color : "#94A3B8", border: `1px solid ${informeDetalle.estado === s.id ? s.color + "55" : T.border}` }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-5 mb-5" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
            <p className="text-xs font-medium mb-2" style={{ color: T.dim }}>Agregar avance</p>
            <div className="flex flex-col gap-2">
              <textarea rows={2} className="resize-none" placeholder="¿Qué se avanzó?" value={avanceTexto} onChange={(e) => setAvanceTexto(e.target.value)} />
              <div className="flex items-center gap-2 flex-wrap">
                <input type="date" value={avanceFecha} onChange={(e) => setAvanceFecha(e.target.value)} style={{ width: 150 }} />
                <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx,.xlsx,.xls" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleArchivo(e.target.files[0]); e.target.value = ""; }} />
                <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg" style={{ background: T.panelAlt, color: T.blue, border: `1px solid ${T.border}` }}>
                  <Upload size={12} /> {avanceArchivo ? avanceArchivo.name.slice(0, 18) : "Adjuntar"}
                </button>
                <button type="button" onClick={agregarAvance} className="ml-auto px-4 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: T.blue }}>Agregar avance</button>
              </div>
            </div>
          </div>

          <p className="text-xs font-medium mb-3" style={{ color: T.dim }}>Historial de avances</p>
          {informeDetalle.avances.length === 0 ? (
            <p className="text-xs" style={{ color: "#94A3B8" }}>Sin avances registrados todavía.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {informeDetalle.avances.map((av) => (
                <div key={av.id} className="flex gap-3 rounded-xl p-3" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: T.blue }} />
                  <div className="flex-1">
                    <p className="text-[11px] mono mb-1" style={{ color: "#94A3B8" }}>{av.fecha}</p>
                    <p className="text-sm" style={{ color: T.text }}>{av.texto}</p>
                    {av.archivo && (
                      av.archivo.type === "image" ? (
                        <a href={av.archivo.dataUrl} target="_blank" rel="noreferrer">
                          <img src={av.archivo.dataUrl} alt={av.archivo.name} className="w-20 h-20 rounded-lg object-cover mt-2" style={{ border: `1px solid ${T.border}` }} />
                        </a>
                      ) : (
                        <a href={av.archivo.dataUrl} download={av.archivo.name} className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-medium" style={{ color: T.blue }}>
                          <FileSpreadsheet size={12} /> {av.archivo.name}
                        </a>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const emptyConflictoForm = { nombre: "", telefono: "", fecha: localISO(), caso: "", notas: "", estado: "abierto" };

function ConflictosPanel({ onBack }) {
  const [vista, setVista] = useState("lista"); // lista | nuevo | detalle
  const [casos, setCasos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(null);
  const [form, setForm] = useState(emptyConflictoForm);
  const [detalleId, setDetalleId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("resolucion-conflictos", true);
        setCasos(res ? JSON.parse(res.value) : []);
      } catch (e) {
        setCasos([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persistCasos = async (next) => {
    setCasos(next);
    try {
      const res = await window.storage.set("resolucion-conflictos", JSON.stringify(next), true);
      setSaveError(res ? null : "No se pudo guardar. Intenta de nuevo.");
    } catch (e) {
      setSaveError("No se pudo guardar. Intenta de nuevo.");
    }
  };

  const crearCaso = async () => {
    if (!form.nombre.trim() || !form.caso.trim()) { setSaveError("Completa al menos el nombre y la descripción del caso."); return; }
    const nuevo = { ...form, id: uid(), creado: nowStamp() };
    const { next, ok } = await mutateShared("resolucion-conflictos", true, (current) => [nuevo, ...current]);
    setCasos(next);
    setSaveError(ok ? null : "No se pudo guardar. Intenta de nuevo.");
    setForm(emptyConflictoForm);
    setVista("lista");
  };

  const cambiarEstado = async (id, estado) => {
    const { next, ok } = await mutateShared("resolucion-conflictos", true, (current) => current.map((c) => (c.id === id ? { ...c, estado } : c)));
    setCasos(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };
  const eliminarCaso = async (id) => {
    const { next, ok } = await mutateShared("resolucion-conflictos", true, (current) => current.filter((c) => c.id !== id));
    setCasos(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
    if (detalleId === id) setVista("lista");
  };

  const casoDetalle = (casos || []).find((c) => c.id === detalleId);

  return (
    <div>
      {saveError && <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: (T.rose + "1F"), color: T.rose, border: `1px solid ${T.rose}33` }}>{saveError}</div>}

      {vista === "lista" && (
        <div>
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <button onClick={onBack} className="text-xs font-medium flex items-center gap-1" style={{ color: T.dim }}>
              <ChevronLeft size={14} /> Biblioteca
            </button>
            <button onClick={() => { setForm(emptyConflictoForm); setVista("nuevo"); }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.rose }}>
              <Plus size={16} strokeWidth={2.5} /> Registrar caso
            </button>
          </div>
          {loading ? (
            <p className="text-sm" style={{ color: T.dim }}>Cargando…</p>
          ) : (casos || []).length === 0 ? (
            <div className="text-sm text-center py-10 rounded-lg" style={{ color: "#94A3B8", border: `1px dashed ${T.border}` }}>Todavía no hay casos registrados.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {(casos || []).map((c) => (
                <button key={c.id} onClick={() => { setDetalleId(c.id); setVista("detalle"); }} className="rounded-xl p-4 text-left flex items-center justify-between gap-3" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: T.text }}>{c.nombre}</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: "#94A3B8" }}>{c.fecha} {c.telefono && `· ${c.telefono}`} · {c.caso.slice(0, 60)}{c.caso.length > 60 ? "…" : ""}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full shrink-0" style={{ background: (c.estado === "resuelto" ? T.teal : T.rose) + "14", color: c.estado === "resuelto" ? T.teal : T.rose }}>
                    {c.estado === "resuelto" ? "Resuelto" : "Abierto"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {vista === "nuevo" && (
        <div>
          <button onClick={() => setVista("lista")} className="text-xs font-medium flex items-center gap-1 mb-4" style={{ color: T.dim }}>
            <ChevronLeft size={14} /> Cancelar
          </button>
          <div className="rounded-xl p-5" style={{ background: T.panel, border: `1px solid ${T.rose}55` }}>
            <h3 className="disp text-sm font-semibold mb-4" style={{ color: T.text }}>Registrar caso</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-xs" style={{ color: T.dim }}>
                Nombre de la persona *
                <input className="w-full mt-1" placeholder="Nombre y apellido" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </label>
              <label className="text-xs" style={{ color: T.dim }}>
                Teléfono
                <input className="w-full mt-1" placeholder="Opcional" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
              </label>
              <label className="text-xs" style={{ color: T.dim }}>
                Fecha
                <input type="date" className="w-full mt-1" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
              </label>
              <label className="text-xs" style={{ color: T.dim }}>
                Estado
                <select className="w-full mt-1" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                  <option value="abierto">Abierto</option>
                  <option value="resuelto">Resuelto</option>
                </select>
              </label>
              <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
                Explica el caso *
                <textarea rows={3} className="w-full mt-1 resize-none" placeholder="¿Qué pasó? ¿Qué servicio o atención recibió?" value={form.caso} onChange={(e) => setForm({ ...form, caso: e.target.value })} />
              </label>
              <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
                Información adicional
                <textarea rows={2} className="w-full mt-1 resize-none" placeholder="Cualquier otro dato relevante" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button type="button" onClick={() => setVista("lista")} className="flex-1 py-2.5 rounded-lg font-medium text-sm" style={{ background: T.panelAlt, color: T.dim }}>Cancelar</button>
              <button type="button" onClick={crearCaso} className="flex-1 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.rose }}>Guardar caso</button>
            </div>
          </div>
        </div>
      )}

      {vista === "detalle" && casoDetalle && (
        <div>
          <button onClick={() => setVista("lista")} className="text-xs font-medium flex items-center gap-1 mb-4" style={{ color: T.dim }}>
            <ChevronLeft size={14} /> Casos
          </button>
          <div className="rounded-xl p-5" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="disp text-base font-semibold" style={{ color: T.text }}>{casoDetalle.nombre}</h3>
                <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{casoDetalle.fecha}{casoDetalle.telefono && ` · ${casoDetalle.telefono}`}</p>
              </div>
              <button onClick={() => eliminarCaso(casoDetalle.id)}><Trash2 size={15} color={T.rose} /></button>
            </div>
            <div className="flex items-center gap-2 mb-4">
              {[{ id: "abierto", label: "Abierto", color: T.rose }, { id: "resuelto", label: "Resuelto", color: T.teal }].map((s) => (
                <button key={s.id} onClick={() => cambiarEstado(casoDetalle.id, s.id)} className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ background: casoDetalle.estado === s.id ? s.color + "1A" : T.panelAlt, color: casoDetalle.estado === s.id ? s.color : "#94A3B8", border: `1px solid ${casoDetalle.estado === s.id ? s.color + "55" : T.border}` }}>
                  {s.label}
                </button>
              ))}
            </div>
            <p className="text-xs font-medium mb-1" style={{ color: T.dim }}>Caso</p>
            <p className="text-sm mb-4" style={{ color: T.text }}>{casoDetalle.caso}</p>
            {casoDetalle.notas && (
              <>
                <p className="text-xs font-medium mb-1" style={{ color: T.dim }}>Información adicional</p>
                <p className="text-sm" style={{ color: T.text }}>{casoDetalle.notas}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ReportesDiariosPanel({ onBack }) {
  const [tasks, setTasks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fecha, setFecha] = useState(localISO());

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("marketing-tasks-v2", true);
        setTasks(res ? JSON.parse(res.value) : []);
      } catch (e) {
        setTasks([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const enFecha = (stamp) => stamp && localISO(new Date(stamp)) === fecha;

  const porArea = useMemo(() => {
    const areas = DEPARTAMENTOS.filter((d) => d.id !== "bandeja");
    return areas.map((d) => {
      const list = (tasks || []).filter((t) => t.departamento === d.id);
      return {
        area: d,
        completadas: list.filter((t) => t.estado === "done" && enFecha(t.estadoActualizadoEn)),
        enCurso: list.filter((t) => t.estado === "doing"),
        nuevas: list.filter((t) => enFecha(t.creado)),
        emergencias: list.filter((t) => t.esEmergencia && enFecha(t.creado)),
        pendientesTotal: list.filter((t) => t.estado !== "done" && t.estado !== "suspendido").length,
      };
    });
  }, [tasks, fecha]);

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #reporte-imprimible, #reporte-imprimible * { visibility: visible; }
          #reporte-imprimible { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3 no-print">
        <button onClick={onBack} className="text-xs font-medium flex items-center gap-1" style={{ color: T.dim }}>
          <ChevronLeft size={14} /> Biblioteca
        </button>
        <div className="flex items-center gap-2">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.blue }}>
            <FileSpreadsheet size={15} /> Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: T.dim }}>Cargando…</p>
      ) : (
        <div id="reporte-imprimible" className="rounded-2xl p-8" style={{ background: "#FFFFFF", border: `1px solid ${T.border}` }}>
          <div className="flex items-center justify-between mb-1 pb-4" style={{ borderBottom: `2px solid ${T.blue}` }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${T.blue}, ${T.blueDark})` }}>
                <LimablueDots color="#FFFFFF" size={18} />
              </div>
              <p className="disp text-base font-semibold" style={{ color: T.text }}>Limablue · Marketing</p>
            </div>
            <p className="text-xs mono" style={{ color: T.dim }}>Reporte diario · {fecha}</p>
          </div>
          <p className="text-[11px] mt-3 mb-6" style={{ color: "#94A3B8" }}>Para: Gerencia General y Gerencia de Marketing</p>

          {porArea.map(({ area, completadas, enCurso, nuevas, emergencias, pendientesTotal }) => (
            <div key={area.id} className="mb-6" style={{ pageBreakInside: "avoid" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: area.color }} />
                <h3 className="disp text-sm font-semibold" style={{ color: T.text }}>{area.label}</h3>
                <span className="text-[11px] mono" style={{ color: "#94A3B8" }}>({pendientesTotal} pendientes activos en total)</span>
              </div>
              <div className="pl-4" style={{ borderLeft: `2px solid ${T.border}` }}>
                <p className="text-xs font-medium mb-1" style={{ color: T.teal }}>Completado hoy ({completadas.length})</p>
                {completadas.length === 0 ? <p className="text-xs mb-2" style={{ color: "#94A3B8" }}>Nada completado hoy.</p> : (
                  <ul className="text-xs mb-2" style={{ color: T.text }}>
                    {completadas.map((t) => <li key={t.id}>• {t.titulo}{t.responsables?.length > 0 && ` (${t.responsables.join(", ")})`}</li>)}
                  </ul>
                )}
                <p className="text-xs font-medium mb-1" style={{ color: T.amber }}>En curso ({enCurso.length})</p>
                {enCurso.length === 0 ? <p className="text-xs mb-2" style={{ color: "#94A3B8" }}>Nada en curso.</p> : (
                  <ul className="text-xs mb-2" style={{ color: T.text }}>
                    {enCurso.map((t) => <li key={t.id}>• {t.titulo}{t.responsables?.length > 0 && ` (${t.responsables.join(", ")})`}</li>)}
                  </ul>
                )}
                {nuevas.length > 0 && (
                  <>
                    <p className="text-xs font-medium mb-1" style={{ color: T.blue }}>Ingresadas hoy ({nuevas.length})</p>
                    <ul className="text-xs mb-2" style={{ color: T.text }}>
                      {nuevas.map((t) => <li key={t.id}>• {t.titulo}</li>)}
                    </ul>
                  </>
                )}
                {emergencias.length > 0 && (
                  <>
                    <p className="text-xs font-medium mb-1" style={{ color: T.rose }}>⚠ Emergencias reportadas hoy ({emergencias.length})</p>
                    <ul className="text-xs mb-2" style={{ color: T.text }}>
                      {emergencias.map((t) => <li key={t.id}>• {t.titulo} — solicitado por {t.solicitadoPor || "—"}</li>)}
                    </ul>
                  </>
                )}
              </div>
            </div>
          ))}
          <p className="text-[10px] mt-8 pt-3" style={{ color: "#94A3B8", borderTop: `1px solid ${T.border}` }}>Generado automáticamente desde el panel de Gestión de Pendientes de Limablue Marketing.</p>
        </div>
      )}
    </div>
  );
}

const emptyCredencialForm = { redSocial: "", usuario: "", contrasena: "", numeroAnexado: "", notas: "" };
const REDES_SOCIALES_SUGERIDAS = ["Instagram", "Facebook", "TikTok", "WhatsApp Business", "YouTube", "LinkedIn", "Google Business", "Otro"];

function CredencialesPanel({ onBack }) {
  const [creds, setCreds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyCredencialForm);
  const [formError, setFormError] = useState(null);
  const [visibles, setVisibles] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("credenciales-redes", true);
        setCreds(res ? JSON.parse(res.value) : []);
      } catch (e) {
        setCreds([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const crear = async () => {
    if (!form.redSocial.trim() || !form.usuario.trim()) { setFormError("Completa al menos la red social y el usuario."); return; }
    const nuevo = { ...form, id: uid(), creado: nowStamp() };
    const { next, ok } = await mutateShared("credenciales-redes", true, (current) => [nuevo, ...current]);
    setCreds(next);
    setSaveError(ok ? null : "No se pudo guardar. Intenta de nuevo.");
    setForm(emptyCredencialForm);
    setFormError(null);
    setShowForm(false);
  };

  const eliminar = async (id) => {
    const { next, ok } = await mutateShared("credenciales-redes", true, (current) => current.filter((c) => c.id !== id));
    setCreds(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };

  const toggleVisible = (id) => setVisibles((v) => ({ ...v, [id]: !v[id] }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <button onClick={onBack} className="text-xs font-medium flex items-center gap-1" style={{ color: T.dim }}>
          <ChevronLeft size={14} /> Biblioteca
        </button>
        <button onClick={() => { setForm(emptyCredencialForm); setFormError(null); setShowForm((s) => !s); }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: showForm ? T.dim : T.slate }}>
          {showForm ? "Cancelar" : <><Plus size={16} strokeWidth={2.5} /> Guardar acceso</>}
        </button>
      </div>

      <div className="mb-4 text-xs px-3 py-2 rounded-lg flex items-start gap-2" style={{ background: T.amber + "14", color: "#92620A", border: `1px solid ${T.amber}33` }}>
        <AlertTriangle size={13} className="shrink-0 mt-0.5" />
        <span>Solo Gerencia y Coordinación pueden ver esta sección. Aun así, no es un gestor de contraseñas con cifrado real — evita guardar aquí accesos bancarios u otros extremadamente sensibles.</span>
      </div>

      {saveError && <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: (T.rose + "1F"), color: T.rose }}>{saveError}</div>}

      {showForm && (
        <div className="rounded-xl p-5 mb-5" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
          <h3 className="disp text-sm font-semibold mb-4" style={{ color: T.text }}>Guardar acceso</h3>
          {formError && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: (T.rose + "1F"), color: T.rose }}>{formError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs" style={{ color: T.dim }}>
              Red social *
              <input list="redes-sugeridas" className="w-full mt-1" placeholder="Ej. Instagram" value={form.redSocial} onChange={(e) => setForm({ ...form, redSocial: e.target.value })} />
              <datalist id="redes-sugeridas">
                {REDES_SOCIALES_SUGERIDAS.map((r) => <option key={r} value={r} />)}
              </datalist>
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Usuario *
              <input className="w-full mt-1" placeholder="@usuario o correo" value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Contraseña
              <input className="w-full mt-1" placeholder="Contraseña" value={form.contrasena} onChange={(e) => setForm({ ...form, contrasena: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Número anexado
              <input className="w-full mt-1" placeholder="Teléfono vinculado a la cuenta" value={form.numeroAnexado} onChange={(e) => setForm({ ...form, numeroAnexado: e.target.value })} />
            </label>
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              Notas
              <textarea rows={2} className="w-full mt-1 resize-none" placeholder="Correo de recuperación, PIN, quién la administra, etc." value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-2 mt-5">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg font-medium text-sm" style={{ background: T.panelAlt, color: T.dim }}>Cancelar</button>
            <button type="button" onClick={crear} className="flex-1 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.slate }}>Guardar</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: T.dim }}>Cargando…</p>
      ) : (creds || []).length === 0 ? (
        <div className="text-sm text-center py-10 rounded-lg" style={{ color: "#94A3B8", border: `1px dashed ${T.border}` }}>Todavía no hay accesos guardados.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {(creds || []).map((c) => (
            <div key={c.id} className="rounded-xl p-4" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: T.slate + "33", color: T.text }}>{c.redSocial}</span>
                  <p className="text-sm font-medium" style={{ color: T.text }}>{c.usuario}</p>
                </div>
                <button onClick={() => eliminar(c.id)}><Trash2 size={14} color={T.rose} /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: T.panelAlt }}>
                  <span style={{ color: "#94A3B8" }}>Contraseña:</span>
                  <span className="mono flex-1" style={{ color: T.text }}>{c.contrasena ? (visibles[c.id] ? c.contrasena : "••••••••") : "—"}</span>
                  {c.contrasena && (
                    <button onClick={() => toggleVisible(c.id)}><Eye size={13} color="#94A3B8" /></button>
                  )}
                </div>
                <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: T.panelAlt }}>
                  <span style={{ color: "#94A3B8" }}>N° anexado:</span>
                  <span style={{ color: T.text }}>{c.numeroAnexado || "—"}</span>
                </div>
              </div>
              {c.notas && <p className="text-xs mt-2" style={{ color: T.dim }}>{c.notas}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/* ---------------------------------- CONTRATOS ---------------------------------- */
const emptyContratoForm = { nombre: "", contraparte: "", tipo: "proveedor", fechaInicio: localISO(), fechaFin: "", monto: "", estado: "vigente", notas: "" };
const TIPOS_CONTRATO = [
  { id: "proveedor", label: "Proveedor" },
  { id: "cliente", label: "Cliente" },
  { id: "servicio", label: "Servicio" },
  { id: "arrendamiento", label: "Arrendamiento" },
  { id: "influencer", label: "Influencer" },
  { id: "otro", label: "Otro" },
];
const ESTADOS_CONTRATO = [
  { id: "vigente", label: "Vigente", color: "#20E4C0" },
  { id: "por_vencer", label: "Por vencer", color: "#FFB020" },
  { id: "vencido", label: "Vencido", color: "#FF5C7A" },
  { id: "en_renovacion", label: "En renovación", color: "#2FB3FF" },
];

function ContratosPanel({ onBack }) {
  const [contratos, setContratos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyContratoForm);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("contratos-admin", true);
        setContratos(res ? JSON.parse(res.value) : []);
      } catch (e) {
        setContratos([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const crear = async () => {
    if (!form.nombre.trim() || !form.contraparte.trim()) { setFormError("Completa al menos el nombre del contrato y la contraparte."); return; }
    const nuevo = { ...form, id: uid(), creado: nowStamp() };
    const { next, ok } = await mutateShared("contratos-admin", true, (current) => [nuevo, ...current]);
    setContratos(next);
    setSaveError(ok ? null : "No se pudo guardar. Intenta de nuevo.");
    setForm(emptyContratoForm);
    setFormError(null);
    setShowForm(false);
  };

  const eliminar = async (id) => {
    const { next, ok } = await mutateShared("contratos-admin", true, (current) => current.filter((c) => c.id !== id));
    setContratos(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };

  const cambiarEstado = async (id, estado) => {
    const { next, ok } = await mutateShared("contratos-admin", true, (current) => current.map((c) => (c.id === id ? { ...c, estado } : c)));
    setContratos(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <button onClick={onBack} className="text-xs font-medium flex items-center gap-1" style={{ color: T.dim }}>
          <ChevronLeft size={14} /> Biblioteca
        </button>
        <button onClick={() => { setForm(emptyContratoForm); setFormError(null); setShowForm((s) => !s); }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: showForm ? T.dim : T.blue }}>
          {showForm ? "Cancelar" : <><Plus size={16} strokeWidth={2.5} /> Nuevo contrato</>}
        </button>
      </div>

      {saveError && <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: T.rose + "1F", color: T.rose }}>{saveError}</div>}

      {showForm && (
        <div className="rounded-xl p-5 mb-5" style={{ background: T.panel, border: `1px solid ${T.blue}55` }}>
          <h3 className="disp text-sm font-semibold mb-4" style={{ color: T.text }}>Nuevo contrato</h3>
          {formError && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: T.rose + "1F", color: T.rose }}>{formError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs" style={{ color: T.dim }}>
              Nombre del contrato *
              <input className="w-full mt-1" placeholder="Ej. Servicio de hosting anual" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Contraparte *
              <input className="w-full mt-1" placeholder="Empresa o persona" value={form.contraparte} onChange={(e) => setForm({ ...form, contraparte: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Tipo
              <select className="w-full mt-1" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {TIPOS_CONTRATO.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Estado
              <select className="w-full mt-1" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                {ESTADOS_CONTRATO.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Fecha inicio
              <input type="date" className="w-full mt-1" value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Fecha fin
              <input type="date" className="w-full mt-1" value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Monto (S/)
              <input type="number" className="w-full mt-1" placeholder="0" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
            </label>
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              Notas
              <textarea rows={2} className="w-full mt-1 resize-none" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-2 mt-5">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg font-medium text-sm" style={{ background: T.panelAlt, color: T.dim }}>Cancelar</button>
            <button type="button" onClick={crear} className="flex-1 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.blue }}>Guardar</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: T.dim }}>Cargando…</p>
      ) : (contratos || []).length === 0 ? (
        <div className="text-sm text-center py-10 rounded-lg" style={{ color: "#94A3B8", border: `1px dashed ${T.border}` }}>Todavía no hay contratos registrados.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {contratos.map((c) => {
            const estado = ESTADOS_CONTRATO.find((s) => s.id === c.estado) || ESTADOS_CONTRATO[0];
            const tipo = TIPOS_CONTRATO.find((t) => t.id === c.tipo) || TIPOS_CONTRATO[TIPOS_CONTRATO.length - 1];
            return (
              <div key={c.id} className="rounded-xl p-4" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold" style={{ color: T.text }}>{c.nombre}</p>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: T.slate + "44", color: T.dim }}>{tipo.label}</span>
                      <select value={c.estado} onChange={(e) => cambiarEstado(c.id, e.target.value)} className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: estado.color + "22", color: estado.color, border: `1px solid ${estado.color}55` }}>
                        {ESTADOS_CONTRATO.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </div>
                    <p className="text-xs mt-1" style={{ color: T.dim }}>{c.contraparte}</p>
                    <p className="text-[11px] mt-1 mono" style={{ color: "#94A3B8" }}>
                      {c.fechaInicio || "?"}{c.fechaFin ? ` → ${c.fechaFin}` : ""}{c.monto ? ` · ${fmtSoles(c.monto)}` : ""}
                    </p>
                    {c.notas && <p className="text-xs mt-1.5" style={{ color: T.dim }}>{c.notas}</p>}
                  </div>
                  <button onClick={() => eliminar(c.id)}><Trash2 size={14} color={T.rose} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- CAJA CHICA (con categoría, sustento y gráficos) ---------------------------------- */
const emptyMovimientoForm = { tipo: "gasto", categoria: "Otros", concepto: "", monto: "", fecha: localISO(), responsable: "", sustento: "" };
const CATEGORIAS_GASTO = ["Movilidad", "Suministros", "Servicios", "Marketing", "Alimentación", "Mantenimiento", "Otros"];

function CajaChicaPanel({ onBack }) {
  const [movimientos, setMovimientos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyMovimientoForm);
  const [formError, setFormError] = useState(null);
  const [expandidoId, setExpandidoId] = useState(null);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("caja-chica", true);
        setMovimientos(res ? JSON.parse(res.value) : []);
      } catch (e) {
        setMovimientos([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const crear = async () => {
    const monto = parseFloat(form.monto);
    if (!form.concepto.trim() || !monto || monto <= 0) { setFormError("Completa el concepto y un monto válido."); return; }
    const nuevo = { ...form, id: uid(), monto, creado: nowStamp() };
    const { next, ok } = await mutateShared("caja-chica", true, (current) => [nuevo, ...current]);
    setMovimientos(next);
    setSaveError(ok ? null : "No se pudo guardar. Intenta de nuevo.");
    setForm(emptyMovimientoForm);
    setFormError(null);
    setShowForm(false);
  };

  const eliminar = async (id) => {
    const { next, ok } = await mutateShared("caja-chica", true, (current) => current.filter((m) => m.id !== id));
    setMovimientos(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };

  const aplicarPreset = (desde, hasta) => {
    setFechaDesde(desde);
    setFechaHasta(hasta);
  };

  const presetJulioAyer = () => {
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    const quinceJulio = `${hoy.getFullYear()}-07-15`;
    aplicarPreset(quinceJulio, localISO(ayer));
  };

  // Saldo acumulado se calcula sobre TODO el historial (no solo el rango filtrado), como una cuenta real.
  const conSaldo = useMemo(() => {
    const list = [...(movimientos || [])].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
    let saldo = 0;
    return list.map((m) => {
      saldo += m.tipo === "ingreso" ? m.monto : -m.monto;
      return { ...m, saldoAcumulado: saldo };
    }).reverse();
  }, [movimientos]);

  const filtrados = useMemo(() => {
    return conSaldo.filter((m) => (!fechaDesde || m.fecha >= fechaDesde) && (!fechaHasta || m.fecha <= fechaHasta));
  }, [conSaldo, fechaDesde, fechaHasta]);

  const resumen = useMemo(() => {
    const ingresos = filtrados.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + m.monto, 0);
    const gastos = filtrados.filter((m) => m.tipo === "gasto").reduce((a, m) => a + m.monto, 0);
    const saldoActual = conSaldo.length > 0 ? conSaldo[0].saldoAcumulado : 0;
    return { ingresos, gastos, saldoActual, cantidadGastos: filtrados.filter((m) => m.tipo === "gasto").length };
  }, [filtrados, conSaldo]);

  const gastoPorCategoria = useMemo(() => {
    const map = {};
    filtrados.filter((m) => m.tipo === "gasto").forEach((m) => {
      const cat = m.categoria || "Otros";
      map[cat] = (map[cat] || 0) + m.monto;
    });
    return Object.entries(map).map(([categoria, total]) => ({ categoria, total })).sort((a, b) => b.total - a.total);
  }, [filtrados]);

  const gastoPorDia = useMemo(() => {
    const map = {};
    filtrados.filter((m) => m.tipo === "gasto").forEach((m) => {
      map[m.fecha] = (map[m.fecha] || 0) + m.monto;
    });
    return Object.entries(map).map(([fecha, total]) => ({ fecha: fecha.slice(5), total })).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [filtrados]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        {onBack ? (
          <button onClick={onBack} className="text-xs font-medium flex items-center gap-1" style={{ color: T.dim }}>
            <ChevronLeft size={14} /> Biblioteca
          </button>
        ) : <div />}
        <button onClick={() => { setForm(emptyMovimientoForm); setFormError(null); setShowForm((s) => !s); }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: showForm ? T.dim : T.blue }}>
          {showForm ? "Cancelar" : <><Plus size={16} strokeWidth={2.5} /> Nuevo movimiento</>}
        </button>
      </div>

      {saveError && <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: T.rose + "1F", color: T.rose }}>{saveError}</div>}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={presetJulioAyer}
          className="text-xs font-medium px-3 py-1.5 rounded-full"
          style={{ background: T.panelAlt, color: T.dim, border: `1px solid ${T.border}` }}
        >
          15 jul – ayer
        </button>
        <button onClick={() => aplicarPreset("", "")} className="text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: T.panelAlt, color: T.dim, border: `1px solid ${T.border}` }}>
          Todo el historial
        </button>
        <label className="text-xs flex items-center gap-1.5" style={{ color: T.dim }}>
          Desde
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        </label>
        <label className="text-xs flex items-center gap-1.5" style={{ color: T.dim }}>
          Hasta
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </label>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={<TrendingUp size={16} />} label="Ingresos del periodo" value={fmtSoles(resumen.ingresos)} color={T.teal} />
        <StatCard icon={<CircleDollarSign size={16} />} label="Gastos del periodo" value={fmtSoles(resumen.gastos)} color={T.rose} />
        <StatCard icon={<ClipboardList size={16} />} label="N° de gastos" value={resumen.cantidadGastos} color={T.amber} />
        <StatCard icon={<Target size={16} />} label="Saldo actual (total)" value={fmtSoles(resumen.saldoActual)} color={resumen.saldoActual >= 0 ? T.blue : T.rose} />
      </div>

      {filtrados.some((m) => m.tipo === "gasto") && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <div className="rounded-xl p-4" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
            <p className="text-xs font-medium mb-2" style={{ color: T.dim }}>Gasto por categoría</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={gastoPorCategoria} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: "#8CA0C7" }} />
                <YAxis type="category" dataKey="categoria" width={90} tick={{ fontSize: 11, fill: T.text }} />
                <Tooltip contentStyle={{ background: T.panelAlt, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} itemStyle={{ color: T.text }} labelStyle={{ color: T.text }} formatter={(v) => fmtSoles(v)} />
                <Bar dataKey="total" fill={T.rose} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl p-4" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
            <p className="text-xs font-medium mb-2" style={{ color: T.dim }}>Gasto por día</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={gastoPorDia}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: "#8CA0C7" }} />
                <YAxis tick={{ fontSize: 10, fill: "#8CA0C7" }} />
                <Tooltip contentStyle={{ background: T.panelAlt, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} itemStyle={{ color: T.text }} labelStyle={{ color: T.text }} formatter={(v) => fmtSoles(v)} />
                <Line type="monotone" dataKey="total" stroke={T.blue} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {showForm && (
        <div className="rounded-xl p-5 mb-5" style={{ background: T.panel, border: `1px solid ${T.blue}55` }}>
          <h3 className="disp text-sm font-semibold mb-4" style={{ color: T.text }}>Nuevo movimiento</h3>
          {formError && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: T.rose + "1F", color: T.rose }}>{formError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs" style={{ color: T.dim }}>
              Tipo
              <select className="w-full mt-1" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                <option value="gasto">Gasto</option>
                <option value="ingreso">Ingreso (reposición de caja)</option>
              </select>
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Fecha
              <input type="date" className="w-full mt-1" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Categoría
              <select className="w-full mt-1" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                {CATEGORIAS_GASTO.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Monto (S/) *
              <input type="number" className="w-full mt-1" placeholder="0" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
            </label>
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              Concepto *
              <input className="w-full mt-1" placeholder="Ej. Útiles de oficina" value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Responsable
              <input className="w-full mt-1" placeholder="Nombre" value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} />
            </label>
            <div />
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              Sustento (justificación, N° de boleta/factura, detalle)
              <textarea rows={2} className="w-full mt-1 resize-none" placeholder="Ej. Boleta N° 001-4532, compra de cartuchos de tinta para impresora de oficina." value={form.sustento} onChange={(e) => setForm({ ...form, sustento: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-2 mt-5">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg font-medium text-sm" style={{ background: T.panelAlt, color: T.dim }}>Cancelar</button>
            <button type="button" onClick={crear} className="flex-1 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.blue }}>Guardar</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: T.dim }}>Cargando…</p>
      ) : filtrados.length === 0 ? (
        <div className="text-sm text-center py-10 rounded-lg" style={{ color: "#94A3B8", border: `1px dashed ${T.border}` }}>No hay movimientos en este periodo.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtrados.map((m) => {
            const abierto = expandidoId === m.id;
            return (
              <div key={m.id} className="rounded-lg" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setExpandidoId(abierto ? null : m.id)}
                >
                  <span className="text-xs mono shrink-0" style={{ color: T.dim, width: 76 }}>{m.fecha}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium" style={{ color: T.text }}>{m.concepto}</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: T.slate + "44", color: T.dim }}>{m.categoria || "Otros"}</span>
                    </div>
                    {m.responsable && <span className="text-[11px]" style={{ color: "#8CA0C7" }}>{m.responsable}</span>}
                  </div>
                  <span className="text-sm mono font-semibold shrink-0" style={{ color: m.tipo === "ingreso" ? T.teal : T.rose }}>
                    {m.tipo === "ingreso" ? "+" : "−"}{fmtSoles(m.monto)}
                  </span>
                  <span className="text-xs mono shrink-0" style={{ color: T.dim, width: 90, textAlign: "right" }}>{fmtSoles(m.saldoAcumulado)}</span>
                  <ChevronDown size={14} color="#8CA0C7" style={{ transform: abierto ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
                  <button onClick={(e) => { e.stopPropagation(); eliminar(m.id); }}><Trash2 size={13} color={T.rose} /></button>
                </div>
                {abierto && (
                  <div className="px-4 pb-3 pt-0.5" style={{ borderTop: `1px solid ${T.border}` }}>
                    <p className="text-xs mt-2" style={{ color: T.dim }}>
                      {m.sustento ? <><b style={{ color: T.text }}>Sustento: </b>{m.sustento}</> : "Sin sustento registrado para este movimiento."}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- PAGOS PROGRAMADOS ---------------------------------- */
const emptyPagoForm = { nombre: "", monto: "", frecuencia: "mensual", proximaFecha: localISO(), responsable: "", estado: "activo" };
const FRECUENCIAS_PAGO = [
  { id: "unico", label: "Único" },
  { id: "mensual", label: "Mensual" },
  { id: "trimestral", label: "Trimestral" },
  { id: "anual", label: "Anual" },
];

function PagosProgramadosPanel({ onBack }) {
  const [pagos, setPagos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyPagoForm);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("pagos-programados", true);
        setPagos(res ? JSON.parse(res.value) : []);
      } catch (e) {
        setPagos([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const crear = async () => {
    const monto = parseFloat(form.monto);
    if (!form.nombre.trim() || !monto || monto <= 0) { setFormError("Completa el nombre del pago y un monto válido."); return; }
    const nuevo = { ...form, id: uid(), monto, creado: nowStamp() };
    const { next, ok } = await mutateShared("pagos-programados", true, (current) => [nuevo, ...current]);
    setPagos(next);
    setSaveError(ok ? null : "No se pudo guardar. Intenta de nuevo.");
    setForm(emptyPagoForm);
    setFormError(null);
    setShowForm(false);
  };

  const eliminar = async (id) => {
    const { next, ok } = await mutateShared("pagos-programados", true, (current) => current.filter((p) => p.id !== id));
    setPagos(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };

  const marcarPagado = async (p) => {
    let siguiente = null;
    if (p.frecuencia !== "unico" && p.proximaFecha) {
      const d = new Date(p.proximaFecha);
      if (p.frecuencia === "mensual") d.setMonth(d.getMonth() + 1);
      else if (p.frecuencia === "trimestral") d.setMonth(d.getMonth() + 3);
      else if (p.frecuencia === "anual") d.setFullYear(d.getFullYear() + 1);
      siguiente = localISO(d);
    }
    const { next, ok } = await mutateShared("pagos-programados", true, (current) =>
      current.map((x) => (x.id === p.id ? { ...x, proximaFecha: siguiente, estado: siguiente ? "activo" : "completado" } : x))
    );
    setPagos(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };

  const conEstado = useMemo(() => {
    const hoy = new Date(new Date().toDateString());
    const en7dias = new Date(hoy); en7dias.setDate(en7dias.getDate() + 7);
    return (pagos || []).map((p) => {
      let alerta = null;
      if (p.estado === "activo" && p.proximaFecha) {
        const f = new Date(p.proximaFecha);
        if (f < hoy) alerta = "vencido";
        else if (f <= en7dias) alerta = "proximo";
      }
      return { ...p, alerta };
    }).sort((a, b) => (a.proximaFecha || "").localeCompare(b.proximaFecha || ""));
  }, [pagos]);

  const resumen = useMemo(() => ({
    vencidos: conEstado.filter((p) => p.alerta === "vencido").length,
    proximos: conEstado.filter((p) => p.alerta === "proximo").length,
    activos: conEstado.filter((p) => p.estado === "activo").length,
    mensualEstimado: conEstado.filter((p) => p.estado === "activo" && p.frecuencia === "mensual").reduce((a, p) => a + p.monto, 0),
  }), [conEstado]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        {onBack ? (
          <button onClick={onBack} className="text-xs font-medium flex items-center gap-1" style={{ color: T.dim }}>
            <ChevronLeft size={14} /> Biblioteca
          </button>
        ) : <div />}
        <button onClick={() => { setForm(emptyPagoForm); setFormError(null); setShowForm((s) => !s); }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: showForm ? T.dim : T.blue }}>
          {showForm ? "Cancelar" : <><Plus size={16} strokeWidth={2.5} /> Nuevo pago programado</>}
        </button>
      </div>

      {saveError && <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: T.rose + "1F", color: T.rose }}>{saveError}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={<AlertTriangle size={16} />} label="Vencidos" value={resumen.vencidos} color={T.rose} />
        <StatCard icon={<Calendar size={16} />} label="Próximos 7 días" value={resumen.proximos} color={T.amber} />
        <StatCard icon={<CheckCircle2 size={16} />} label="Activos" value={resumen.activos} color={T.blue} />
        <StatCard icon={<CircleDollarSign size={16} />} label="Compromiso mensual" value={fmtSoles(resumen.mensualEstimado)} color={T.teal} />
      </div>

      {showForm && (
        <div className="rounded-xl p-5 mb-5" style={{ background: T.panel, border: `1px solid ${T.blue}55` }}>
          <h3 className="disp text-sm font-semibold mb-4" style={{ color: T.text }}>Nuevo pago programado</h3>
          {formError && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: T.rose + "1F", color: T.rose }}>{formError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              Nombre del pago *
              <input className="w-full mt-1" placeholder="Ej. Suscripción Adobe Creative Cloud" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Monto (S/) *
              <input type="number" className="w-full mt-1" placeholder="0" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Frecuencia
              <select className="w-full mt-1" value={form.frecuencia} onChange={(e) => setForm({ ...form, frecuencia: e.target.value })}>
                {FRECUENCIAS_PAGO.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Próxima fecha de pago
              <input type="date" className="w-full mt-1" value={form.proximaFecha} onChange={(e) => setForm({ ...form, proximaFecha: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Responsable
              <input className="w-full mt-1" placeholder="Quién lo gestiona" value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-2 mt-5">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg font-medium text-sm" style={{ background: T.panelAlt, color: T.dim }}>Cancelar</button>
            <button type="button" onClick={crear} className="flex-1 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.blue }}>Guardar</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: T.dim }}>Cargando…</p>
      ) : conEstado.length === 0 ? (
        <div className="text-sm text-center py-10 rounded-lg" style={{ color: "#94A3B8", border: `1px dashed ${T.border}` }}>Todavía no hay pagos programados.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {conEstado.map((p) => (
            <div key={p.id} className="rounded-xl p-4" style={{
              background: T.panel,
              border: p.alerta === "vencido" ? `1px solid ${T.rose}` : p.alerta === "proximo" ? `1px solid ${T.amber}` : `1px solid ${T.border}`,
            }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold" style={{ color: T.text }}>{p.nombre}</p>
                    {p.alerta === "vencido" && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: T.rose + "22", color: T.rose }}>VENCIDO</span>}
                    {p.alerta === "proximo" && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: T.amber + "22", color: T.amber }}>PRÓXIMO</span>}
                    {p.estado === "completado" && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: T.slate + "44", color: T.dim }}>COMPLETADO</span>}
                  </div>
                  <p className="text-[11px] mt-1 mono" style={{ color: "#94A3B8" }}>
                    {fmtSoles(p.monto)} · {FRECUENCIAS_PAGO.find((f) => f.id === p.frecuencia)?.label}{p.proximaFecha ? ` · Próximo: ${p.proximaFecha}` : ""}{p.responsable ? ` · ${p.responsable}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {p.estado === "activo" && (
                    <button onClick={() => marcarPagado(p)} className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg text-white" style={{ background: T.teal }}>Marcar pagado</button>
                  )}
                  <button onClick={() => eliminar(p.id)}><Trash2 size={14} color={T.rose} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- LICENCIAS Y HERRAMIENTAS ---------------------------------- */
const emptyLicenciaForm = { nombre: "", tipo: "software", vencimiento: "", costo: "", responsable: "", estado: "activa", sustento: "", tarjeta: "", frecuencia: "Mensual", proximoCobro: "" };
const ESTADOS_LICENCIA = [
  { id: "activa", label: "Activa", color: "#20E4C0" },
  { id: "suspendida", label: "Suspendida", color: "#FFB020" },
  { id: "inactiva", label: "Inactiva", color: "#8CA0C7" },
];

function LicenciasPanel({ onBack }) {
  const [licencias, setLicencias] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyLicenciaForm);
  const [formError, setFormError] = useState(null);
  const [expandidoId, setExpandidoId] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [edicionInputs, setEdicionInputs] = useState({ sustento: "", costo: "", vencimiento: "", responsable: "", tarjeta: "", frecuencia: "Mensual", proximoCobro: "" });

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("licencias-software", true);
        setLicencias(res ? JSON.parse(res.value) : []);
      } catch (e) {
        setLicencias([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const crear = async () => {
    if (!form.nombre.trim()) { setFormError("Ponle un nombre a la licencia o herramienta."); return; }
    const nueva = { ...form, id: uid(), creado: nowStamp() };
    const { next, ok } = await mutateShared("licencias-software", true, (current) => [nueva, ...current]);
    setLicencias(next);
    setSaveError(ok ? null : "No se pudo guardar. Intenta de nuevo.");
    setForm(emptyLicenciaForm);
    setFormError(null);
    setShowForm(false);
  };

  const eliminar = async (id) => {
    const { next, ok } = await mutateShared("licencias-software", true, (current) => current.filter((l) => l.id !== id));
    setLicencias(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };

  const cambiarEstado = async (id, estado) => {
    const { next, ok } = await mutateShared("licencias-software", true, (current) => current.map((l) => (l.id === id ? { ...l, estado } : l)));
    setLicencias(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };

  const guardarEdicion = async (id, cambios) => {
    const { next, ok } = await mutateShared("licencias-software", true, (current) => current.map((l) => (l.id === id ? { ...l, ...cambios } : l)));
    setLicencias(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };

  const [subiendoId, setSubiendoId] = useState(null);
  const [archivoTemp, setArchivoTemp] = useState(null); // { nombre, tamanoKB, dataUrl }
  const [montoFactura, setMontoFactura] = useState("");
  const [avisoCambio, setAvisoCambio] = useState(null); // { licenciaId, antes, despues }
  const fileInputRefs = useRef({});

  const elegirArchivo = (licenciaId) => {
    setSubiendoId(licenciaId);
    setArchivoTemp(null);
    setMontoFactura("");
    if (fileInputRefs.current[licenciaId]) fileInputRefs.current[licenciaId].click();
  };

  const onArchivoSeleccionado = (licenciaId, file) => {
    if (!file) return;
    const LIMITE_KB = 800; // localStorage tiene espacio limitado; las facturas pesan poco, así que esto alcanza de sobra
    const tamanoKB = Math.round(file.size / 1024);
    if (tamanoKB > LIMITE_KB) {
      setSaveError(`"${file.name}" pesa ${tamanoKB}KB — el máximo por archivo es ${LIMITE_KB}KB para no llenar el almacenamiento del navegador. Comprime el PDF o sube una versión más liviana.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setArchivoTemp({ nombre: file.name, tamanoKB, dataUrl: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const avanzarFecha = (fechaStr, frecuencia) => {
    if (!fechaStr) return fechaStr;
    const d = new Date(fechaStr + "T00:00:00");
    if (frecuencia === "Anual") d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    return localISO(d);
  };

  const confirmarSubidaFactura = async (licencia) => {
    if (!archivoTemp) { setSaveError("Elige un archivo primero."); return; }
    const monto = parseFloat(montoFactura);
    if (!monto || monto <= 0) { setSaveError("Ingresa el monto que aparece en la factura."); return; }

    const montoAnterior = parseFloat(licencia.costo) || null;
    const cambioMonto = montoAnterior !== null && Math.abs(monto - montoAnterior) > 0.01;

    const nuevoAdjunto = {
      id: uid(), nombre: archivoTemp.nombre, tamanoKB: archivoTemp.tamanoKB,
      dataUrl: archivoTemp.dataUrl, monto, fecha: localISO(), subidoEn: nowStamp(),
    };

    const cambios = {
      adjuntos: [nuevoAdjunto, ...(licencia.adjuntos || [])],
      costo: monto,
      proximoCobro: avanzarFecha(licencia.proximoCobro, licencia.frecuencia),
    };

    const { next, ok } = await mutateShared("licencias-software", true, (current) => current.map((l) => (l.id === licencia.id ? { ...l, ...cambios } : l)));
    setLicencias(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
    if (cambioMonto) setAvisoCambio({ licenciaId: licencia.id, antes: montoAnterior, despues: monto });
    setSubiendoId(null);
    setArchivoTemp(null);
    setMontoFactura("");
  };

  const resumen = useMemo(() => {
    const list = licencias || [];
    const hoy = new Date(new Date().toDateString());
    return {
      activas: list.filter((l) => l.estado === "activa").length,
      suspendidas: list.filter((l) => l.estado === "suspendida").length,
      inactivas: list.filter((l) => l.estado === "inactiva").length,
      porVencer: list.filter((l) => l.estado === "activa" && l.vencimiento && new Date(l.vencimiento) <= new Date(hoy.getTime() + 30 * 86400000)).length,
      costoMensualEstimado: list.filter((l) => l.estado === "activa").reduce((a, l) => a + (parseFloat(l.costo) || 0), 0),
      conSustento: list.filter((l) => l.sustento && l.sustento.trim()).length,
      total: list.length,
    };
  }, [licencias]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        {onBack ? (
          <button onClick={onBack} className="text-xs font-medium flex items-center gap-1" style={{ color: T.dim }}>
            <ChevronLeft size={14} /> Biblioteca
          </button>
        ) : <div />}
        <button onClick={() => { setForm(emptyLicenciaForm); setFormError(null); setShowForm((s) => !s); }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: showForm ? T.dim : T.blue }}>
          {showForm ? "Cancelar" : <><Plus size={16} strokeWidth={2.5} /> Nueva licencia</>}
        </button>
      </div>

      {saveError && <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: T.rose + "1F", color: T.rose }}>{saveError}</div>}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard icon={<CheckCircle2 size={16} />} label="Activas" value={resumen.activas} color={T.teal} />
        <StatCard icon={<AlertTriangle size={16} />} label="Suspendidas" value={resumen.suspendidas} color={T.amber} />
        <StatCard icon={<X size={16} />} label="Inactivas" value={resumen.inactivas} color={T.dim} />
        <StatCard icon={<CircleDollarSign size={16} />} label="Costo mensual activo" value={fmtSoles(resumen.costoMensualEstimado)} color={T.blue} />
        <StatCard icon={<ClipboardList size={16} />} label="Con sustento" value={`${resumen.conSustento} / ${resumen.total}`} color={resumen.conSustento === resumen.total && resumen.total > 0 ? T.teal : T.rose} />
      </div>

      {showForm && (
        <div className="rounded-xl p-5 mb-5" style={{ background: T.panel, border: `1px solid ${T.blue}55` }}>
          <h3 className="disp text-sm font-semibold mb-4" style={{ color: T.text }}>Nueva licencia / herramienta</h3>
          {formError && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: T.rose + "1F", color: T.rose }}>{formError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              Nombre *
              <input className="w-full mt-1" placeholder="Ej. Canva Pro, Adobe Creative Cloud" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Estado
              <select className="w-full mt-1" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                {ESTADOS_LICENCIA.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Vencimiento
              <input type="date" className="w-full mt-1" value={form.vencimiento} onChange={(e) => setForm({ ...form, vencimiento: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Costo mensual (S/)
              <input type="number" className="w-full mt-1" placeholder="0" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Tarjeta vinculada
              <input className="w-full mt-1" placeholder="Ej. ****3194" value={form.tarjeta} onChange={(e) => setForm({ ...form, tarjeta: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Frecuencia de cobro
              <select className="w-full mt-1" value={form.frecuencia} onChange={(e) => setForm({ ...form, frecuencia: e.target.value })}>
                <option value="Mensual">Mensual</option>
                <option value="Anual">Anual</option>
              </select>
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Próximo cobro
              <input type="date" className="w-full mt-1" value={form.proximoCobro} onChange={(e) => setForm({ ...form, proximoCobro: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Responsable
              <input className="w-full mt-1" placeholder="Quién la administra" value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} />
            </label>
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              Sustento / justificación (para tu PPT: para qué se usa, qué avances permitió, por qué es necesaria)
              <textarea rows={3} className="w-full mt-1 resize-none" placeholder="Ej. Se usa para diseño de piezas gráficas de campaña. Permitió reducir el tiempo de entrega de artes en un 30%. Sin esta licencia, el equipo de diseño tendría que trabajar con herramientas gratuitas más limitadas." value={form.sustento} onChange={(e) => setForm({ ...form, sustento: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-2 mt-5">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg font-medium text-sm" style={{ background: T.panelAlt, color: T.dim }}>Cancelar</button>
            <button type="button" onClick={crear} className="flex-1 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.blue }}>Guardar</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: T.dim }}>Cargando…</p>
      ) : (licencias || []).length === 0 ? (
        <div className="text-sm text-center py-10 rounded-lg" style={{ color: "#94A3B8", border: `1px dashed ${T.border}` }}>Todavía no hay licencias registradas.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {licencias.map((l) => {
            const estado = ESTADOS_LICENCIA.find((s) => s.id === l.estado) || ESTADOS_LICENCIA[0];
            const abierto = expandidoId === l.id;
            return (
              <div key={l.id} className="rounded-xl p-4" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                <div className="flex items-start justify-between gap-3 cursor-pointer" onClick={() => setExpandidoId(abierto ? null : l.id)}>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold" style={{ color: T.text }}>{l.nombre}</p>
                      <select onClick={(e) => e.stopPropagation()} value={l.estado} onChange={(e) => cambiarEstado(l.id, e.target.value)} className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: estado.color + "22", color: estado.color, border: `1px solid ${estado.color}55` }}>
                        {ESTADOS_LICENCIA.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                      {!l.sustento && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: T.amber + "1A", color: T.amber }}>Falta sustento</span>
                      )}
                    </div>
                    <p className="text-[11px] mt-1 mono" style={{ color: "#94A3B8" }}>
                      {l.tarjeta ? `Tarjeta ${l.tarjeta}` : (l.vencimiento ? `Vence: ${l.vencimiento}` : "Sin fecha de vencimiento")}
                      {l.frecuencia ? ` · ${l.frecuencia}` : ""}
                      {l.proximoCobro ? ` · Próx. cobro: ${l.proximoCobro}` : ""}
                      {l.costo ? ` · ${fmtSoles(l.costo)}/mes` : ""}{l.responsable ? ` · ${l.responsable}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ChevronDown size={14} color="#8CA0C7" style={{ transform: abierto ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
                    <button onClick={(e) => { e.stopPropagation(); eliminar(l.id); }}><Trash2 size={14} color={T.rose} /></button>
                  </div>
                </div>
                {abierto && (
                  <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${T.border}` }}>
                    {editandoId === l.id ? (
                      <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                        <label className="text-xs" style={{ color: T.dim }}>
                          Sustento / justificación
                          <textarea rows={3} className="w-full mt-1 resize-none" placeholder="Para qué se usa, qué avances permitió, por qué es necesaria…" value={edicionInputs.sustento} onChange={(e) => setEdicionInputs({ ...edicionInputs, sustento: e.target.value })} />
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <label className="text-xs" style={{ color: T.dim }}>
                            Costo mensual (S/)
                            <input type="number" className="w-full mt-1" value={edicionInputs.costo} onChange={(e) => setEdicionInputs({ ...edicionInputs, costo: e.target.value })} />
                          </label>
                          <label className="text-xs" style={{ color: T.dim }}>
                            Vencimiento
                            <input type="date" className="w-full mt-1" value={edicionInputs.vencimiento} onChange={(e) => setEdicionInputs({ ...edicionInputs, vencimiento: e.target.value })} />
                          </label>
                          <label className="text-xs" style={{ color: T.dim }}>
                            Responsable
                            <input className="w-full mt-1" value={edicionInputs.responsable} onChange={(e) => setEdicionInputs({ ...edicionInputs, responsable: e.target.value })} />
                          </label>
                          <label className="text-xs" style={{ color: T.dim }}>
                            Tarjeta vinculada
                            <input className="w-full mt-1" value={edicionInputs.tarjeta} onChange={(e) => setEdicionInputs({ ...edicionInputs, tarjeta: e.target.value })} />
                          </label>
                          <label className="text-xs" style={{ color: T.dim }}>
                            Frecuencia
                            <select className="w-full mt-1" value={edicionInputs.frecuencia} onChange={(e) => setEdicionInputs({ ...edicionInputs, frecuencia: e.target.value })}>
                              <option value="Mensual">Mensual</option>
                              <option value="Anual">Anual</option>
                            </select>
                          </label>
                          <label className="text-xs" style={{ color: T.dim }}>
                            Próximo cobro
                            <input type="date" className="w-full mt-1" value={edicionInputs.proximoCobro} onChange={(e) => setEdicionInputs({ ...edicionInputs, proximoCobro: e.target.value })} />
                          </label>
                        </div>
                        <div className="flex gap-2 mt-1">
                          <button onClick={() => setEditandoId(null)} className="flex-1 py-2 rounded-lg text-xs font-medium" style={{ background: T.panelAlt, color: T.dim }}>Cancelar</button>
                          <button onClick={() => { guardarEdicion(l.id, edicionInputs); setEditandoId(null); }} className="flex-1 py-2 rounded-lg text-xs font-medium text-white" style={{ background: T.blue }}>Guardar</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold" style={{ color: T.dim }}>Sustento / justificación</p>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEdicionInputs({ sustento: l.sustento || "", costo: l.costo || "", vencimiento: l.vencimiento || "", responsable: l.responsable || "", tarjeta: l.tarjeta || "", frecuencia: l.frecuencia || "Mensual", proximoCobro: l.proximoCobro || "" }); setEditandoId(l.id); }}
                            className="text-[11px] font-medium"
                            style={{ color: T.blue }}
                          >
                            {l.sustento ? "Editar" : "+ Agregar sustento"}
                          </button>
                        </div>
                        <p className="text-xs" style={{ color: l.sustento ? T.text : "#94A3B8" }}>
                          {l.sustento || "Todavía no hay sustento cargado para esta licencia."}
                        </p>

                        <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${T.border}` }} onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold" style={{ color: T.dim }}>Facturas subidas ({(l.adjuntos || []).length})</p>
                            <button onClick={() => elegirArchivo(l.id)} className="text-[11px] font-medium flex items-center gap-1" style={{ color: T.blue }}>
                              <Upload size={11} /> Subir factura
                            </button>
                            <input
                              ref={(el) => { fileInputRefs.current[l.id] = el; }}
                              type="file" accept=".pdf,image/*" className="hidden"
                              onChange={(e) => onArchivoSeleccionado(l.id, e.target.files?.[0])}
                            />
                          </div>

                          {avisoCambio && avisoCambio.licenciaId === l.id && (
                            <div className="mb-2 text-xs px-3 py-2 rounded-lg flex items-center justify-between" style={{ background: T.amber + "1A", color: T.amber }}>
                              <span>⚠ El monto cambió: antes S/ {avisoCambio.antes?.toFixed(2)} → ahora S/ {avisoCambio.despues.toFixed(2)}. Ya actualicé la licencia.</span>
                              <button onClick={() => setAvisoCambio(null)}><X size={12} /></button>
                            </div>
                          )}

                          {subiendoId === l.id && (
                            <div className="mb-3 p-3 rounded-lg" style={{ background: T.panelAlt, border: `1px solid ${T.border}` }}>
                              {archivoTemp ? (
                                <>
                                  <p className="text-xs mb-2" style={{ color: T.text }}>{archivoTemp.nombre} · {archivoTemp.tamanoKB}KB</p>
                                  <label className="text-xs" style={{ color: T.dim }}>
                                    Monto que aparece en esta factura (S/)
                                    <input type="number" autoFocus className="w-full mt-1" placeholder="0.00" value={montoFactura} onChange={(e) => setMontoFactura(e.target.value)} />
                                  </label>
                                  <div className="flex gap-2 mt-3">
                                    <button onClick={() => { setSubiendoId(null); setArchivoTemp(null); }} className="flex-1 py-2 rounded-lg text-xs font-medium" style={{ background: T.panel, color: T.dim }}>Cancelar</button>
                                    <button onClick={() => confirmarSubidaFactura(l)} className="flex-1 py-2 rounded-lg text-xs font-medium text-white" style={{ background: T.blue }}>Guardar factura</button>
                                  </div>
                                </>
                              ) : (
                                <p className="text-xs" style={{ color: "#94A3B8" }}>Elige un archivo (PDF o imagen, máx. 800KB)…</p>
                              )}
                            </div>
                          )}

                          {(l.adjuntos || []).length === 0 ? (
                            <p className="text-xs" style={{ color: "#94A3B8" }}>Sin facturas subidas todavía.</p>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              {l.adjuntos.map((a) => (
                                <a key={a.id} href={a.dataUrl} download={a.nombre} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg" style={{ background: T.panelAlt, textDecoration: "none" }}>
                                  <span className="flex items-center gap-1.5" style={{ color: T.text }}>
                                    <Paperclip size={11} color={T.dim} /> {a.nombre}
                                  </span>
                                  <span style={{ color: T.dim }}>{a.fecha} · S/ {a.monto.toFixed(2)}</span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- GASTOS CONTABLES (domiciliados / no domiciliados) ---------------------------------- */
const emptyGastoContableForm = {
  tipoProveedor: "domiciliado", categoria: "Publicidad Digital", concepto: "", monto: "",
  fecha: localISO(), responsable: "", sustento: "",
};
const CATEGORIAS_GASTO_CONTABLE = [
  "Publicidad Digital", "Publicidad Digital (Meta/Google/TikTok)", "Publicidad Tradicional (Radio/TV)",
  "Campañas y Anuncios", "Merchandising", "Otros",
];

function GastosContablesPanel() {
  const [movimientos, setMovimientos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyGastoContableForm);
  const [formError, setFormError] = useState(null);
  const [expandidoId, setExpandidoId] = useState(null);
  const [tipoFiltro, setTipoFiltro] = useState("todos"); // todos | domiciliado | no_domiciliado
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("gastos-contables", true);
        setMovimientos(res ? JSON.parse(res.value) : []);
      } catch (e) {
        setMovimientos([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const crear = async () => {
    const monto = parseFloat(form.monto);
    if (!form.concepto.trim() || !monto || monto <= 0) { setFormError("Completa el concepto y un monto válido."); return; }
    const nuevo = { ...form, id: uid(), monto, creado: nowStamp() };
    const { next, ok } = await mutateShared("gastos-contables", true, (current) => [nuevo, ...current]);
    setMovimientos(next);
    setSaveError(ok ? null : "No se pudo guardar. Intenta de nuevo.");
    setForm(emptyGastoContableForm);
    setFormError(null);
    setShowForm(false);
  };

  const eliminar = async (id) => {
    const { next, ok } = await mutateShared("gastos-contables", true, (current) => current.filter((m) => m.id !== id));
    setMovimientos(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };

  const presetJulioAyer = () => {
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    setFechaDesde(`${hoy.getFullYear()}-07-15`);
    setFechaHasta(localISO(ayer));
  };

  const filtrados = useMemo(() => {
    return (movimientos || [])
      .filter((m) => tipoFiltro === "todos" || m.tipoProveedor === tipoFiltro)
      .filter((m) => (!fechaDesde || m.fecha >= fechaDesde) && (!fechaHasta || m.fecha <= fechaHasta))
      .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  }, [movimientos, tipoFiltro, fechaDesde, fechaHasta]);

  const resumen = useMemo(() => {
    const total = filtrados.reduce((a, m) => a + m.monto, 0);
    const domiciliados = filtrados.filter((m) => m.tipoProveedor === "domiciliado").reduce((a, m) => a + m.monto, 0);
    const noDomiciliados = filtrados.filter((m) => m.tipoProveedor === "no_domiciliado").reduce((a, m) => a + m.monto, 0);
    return { total, domiciliados, noDomiciliados, cantidad: filtrados.length };
  }, [filtrados]);

  const gastoPorCategoria = useMemo(() => {
    const map = {};
    filtrados.forEach((m) => {
      const cat = m.categoria || "Otros";
      map[cat] = (map[cat] || 0) + m.monto;
    });
    return Object.entries(map).map(([categoria, total]) => ({ categoria, total })).sort((a, b) => b.total - a.total);
  }, [filtrados]);

  const gastoPorMes = useMemo(() => {
    const map = {};
    filtrados.forEach((m) => {
      const mes = (m.fecha || "").slice(0, 7);
      map[mes] = (map[mes] || 0) + m.monto;
    });
    return Object.entries(map).map(([mes, total]) => ({ mes, total })).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [filtrados]);

  if (loading) return <div className="text-sm" style={{ color: T.dim }}>Cargando…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="disp text-lg font-semibold" style={{ color: T.text }}>Gastos contables</h2>
          <p className="text-sm mt-1" style={{ color: T.dim }}>Registro formal de gastos (cuenta contable), separado por proveedores domiciliados y no domiciliados.</p>
        </div>
        <button onClick={() => { setForm(emptyGastoContableForm); setFormError(null); setShowForm((s) => !s); }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-white shrink-0" style={{ background: showForm ? T.dim : T.blue }}>
          {showForm ? "Cancelar" : <><Plus size={16} strokeWidth={2.5} /> Nuevo gasto</>}
        </button>
      </div>

      {saveError && <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: T.rose + "1F", color: T.rose }}>{saveError}</div>}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {[{ id: "todos", label: "Todos" }, { id: "domiciliado", label: "Domiciliados" }, { id: "no_domiciliado", label: "No domiciliados" }].map((t) => (
          <button
            key={t.id}
            onClick={() => setTipoFiltro(t.id)}
            className="text-xs font-medium px-3 py-1.5 rounded-full"
            style={{
              background: tipoFiltro === t.id ? T.blue + "1F" : T.panelAlt,
              color: tipoFiltro === t.id ? T.blue : T.dim,
              border: `1px solid ${tipoFiltro === t.id ? T.blue + "66" : T.border}`,
            }}
          >
            {t.label}
          </button>
        ))}
        <span className="w-px h-4" style={{ background: T.border }} />
        <button onClick={presetJulioAyer} className="text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: T.panelAlt, color: T.dim, border: `1px solid ${T.border}` }}>
          15 jul – ayer
        </button>
        <button onClick={() => { setFechaDesde(""); setFechaHasta(""); }} className="text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: T.panelAlt, color: T.dim, border: `1px solid ${T.border}` }}>
          Todo el historial
        </button>
        <label className="text-xs flex items-center gap-1.5" style={{ color: T.dim }}>
          Desde
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        </label>
        <label className="text-xs flex items-center gap-1.5" style={{ color: T.dim }}>
          Hasta
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </label>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={<CircleDollarSign size={16} />} label="Total del periodo" value={fmtSoles(resumen.total)} color={T.blue} />
        <StatCard icon={<ClipboardList size={16} />} label="N° de gastos" value={resumen.cantidad} color={T.amber} />
        <StatCard icon={<Target size={16} />} label="Domiciliados" value={fmtSoles(resumen.domiciliados)} color={T.teal} />
        <StatCard icon={<TrendingUp size={16} />} label="No domiciliados" value={fmtSoles(resumen.noDomiciliados)} color={T.purple} />
      </div>

      {filtrados.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <div className="rounded-xl p-4" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
            <p className="text-xs font-medium mb-2" style={{ color: T.dim }}>Gasto por categoría</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={gastoPorCategoria} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: "#8CA0C7" }} />
                <YAxis type="category" dataKey="categoria" width={130} tick={{ fontSize: 10, fill: T.text }} />
                <Tooltip contentStyle={{ background: T.panelAlt, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} itemStyle={{ color: T.text }} labelStyle={{ color: T.text }} formatter={(v) => fmtSoles(v)} />
                <Bar dataKey="total" fill={T.blue} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl p-4" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
            <p className="text-xs font-medium mb-2" style={{ color: T.dim }}>Gasto por mes</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={gastoPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#8CA0C7" }} />
                <YAxis tick={{ fontSize: 10, fill: "#8CA0C7" }} />
                <Tooltip contentStyle={{ background: T.panelAlt, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} itemStyle={{ color: T.text }} labelStyle={{ color: T.text }} formatter={(v) => fmtSoles(v)} />
                <Line type="monotone" dataKey="total" stroke={T.teal} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {showForm && (
        <div className="rounded-xl p-5 mb-5" style={{ background: T.panel, border: `1px solid ${T.blue}55` }}>
          <h3 className="disp text-sm font-semibold mb-4" style={{ color: T.text }}>Nuevo gasto contable</h3>
          {formError && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: T.rose + "1F", color: T.rose }}>{formError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs" style={{ color: T.dim }}>
              Tipo de proveedor
              <select className="w-full mt-1" value={form.tipoProveedor} onChange={(e) => setForm({ ...form, tipoProveedor: e.target.value })}>
                <option value="domiciliado">Domiciliado</option>
                <option value="no_domiciliado">No domiciliado</option>
              </select>
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Fecha
              <input type="date" className="w-full mt-1" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Categoría
              <select className="w-full mt-1" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                {CATEGORIAS_GASTO_CONTABLE.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Monto total (S/) *
              <input type="number" className="w-full mt-1" placeholder="0" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
            </label>
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              Concepto *
              <input className="w-full mt-1" placeholder="Ej. Publicidad para redes sociales" value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Unidad de negocio / responsable
              <input className="w-full mt-1" placeholder="Ej. MODELO, ARCOS" value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} />
            </label>
            <div />
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              Sustento (proveedor, N° de documento, IGV, etc.)
              <textarea rows={2} className="w-full mt-1 resize-none" placeholder="Ej. Proveedor: Grupo RPP S.A.C. Documento: 01-F001-60872. Importe S/ 9,000 + IGV S/ 1,620 = Total S/ 10,620." value={form.sustento} onChange={(e) => setForm({ ...form, sustento: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-2 mt-5">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg font-medium text-sm" style={{ background: T.panelAlt, color: T.dim }}>Cancelar</button>
            <button type="button" onClick={crear} className="flex-1 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.blue }}>Guardar</button>
          </div>
        </div>
      )}

      {filtrados.length === 0 ? (
        <div className="text-sm text-center py-10 rounded-lg" style={{ color: "#94A3B8", border: `1px dashed ${T.border}` }}>No hay gastos registrados en este periodo.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtrados.map((m) => {
            const abierto = expandidoId === m.id;
            return (
              <div key={m.id} className="rounded-lg" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpandidoId(abierto ? null : m.id)}>
                  <span className="text-xs mono shrink-0" style={{ color: T.dim, width: 76 }}>{m.fecha}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate" style={{ color: T.text }}>{m.concepto}</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: T.slate + "44", color: T.dim }}>{m.categoria}</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: (m.tipoProveedor === "domiciliado" ? T.teal : T.purple) + "1A", color: m.tipoProveedor === "domiciliado" ? T.teal : T.purple }}>
                        {m.tipoProveedor === "domiciliado" ? "Domiciliado" : "No domiciliado"}
                      </span>
                    </div>
                    {m.responsable && <span className="text-[11px]" style={{ color: "#8CA0C7" }}>{m.responsable}</span>}
                  </div>
                  <span className="text-sm mono font-semibold shrink-0" style={{ color: T.rose }}>{fmtSoles(m.monto)}</span>
                  <ChevronDown size={14} color="#8CA0C7" style={{ transform: abierto ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
                  <button onClick={(e) => { e.stopPropagation(); eliminar(m.id); }}><Trash2 size={13} color={T.rose} /></button>
                </div>
                {abierto && (
                  <div className="px-4 pb-3 pt-0.5" style={{ borderTop: `1px solid ${T.border}` }}>
                    <p className="text-xs mt-2" style={{ color: T.dim }}>
                      {m.sustento ? <><b style={{ color: T.text }}>Sustento: </b>{m.sustento}</> : "Sin sustento registrado para este gasto."}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BibliotecaPanel({ permisos }) {
  const [vista, setVista] = useState("inicio"); // inicio | actas | nueva | detalle | informes
  const [actas, setActas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(null);
  const [form, setForm] = useState(emptyActaForm);
  const [presenteInput, setPresenteInput] = useState("");
  const [puntosTexto, setPuntosTexto] = useState("");
  const [detalleId, setDetalleId] = useState(null);
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("actas-reuniones", true);
        setActas(res ? JSON.parse(res.value) : []);
      } catch (e) {
        setActas([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persistActas = async (next) => {
    setActas(next);
    try {
      const res = await window.storage.set("actas-reuniones", JSON.stringify(next), true);
      setSaveError(res ? null : "No se pudo guardar el acta. Intenta de nuevo.");
    } catch (e) {
      setSaveError("No se pudo guardar el acta. Intenta de nuevo.");
    }
  };

  const addPresente = () => {
    const name = presenteInput.trim();
    if (!name) return;
    if (!form.presentes.includes(name)) setForm({ ...form, presentes: [...form.presentes, name] });
    setPresenteInput("");
  };
  const removePresente = (name) => setForm({ ...form, presentes: form.presentes.filter((p) => p !== name) });

  const procesarPuntos = () => {
    const lineas = puntosTexto.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lineas.length === 0) return;
    const nuevosPuntos = lineas.map((texto) => ({ id: uid(), texto, fecha: "" }));
    setForm({ ...form, puntos: [...form.puntos, ...nuevosPuntos] });
    setPuntosTexto("");
  };
  const removePunto = (id) => setForm({ ...form, puntos: form.puntos.filter((p) => p.id !== id) });
  const updatePuntoFecha = (id, fecha) => setForm({ ...form, puntos: form.puntos.map((p) => (p.id === id ? { ...p, fecha } : p)) });

  const guardarActa = async () => {
    if (form.puntos.length === 0 && Object.keys(form.firmas).length === 0) {
      setSaveError("Agrega al menos un punto tratado antes de guardar.");
      return;
    }
    const nueva = { ...form, id: uid(), creado: nowStamp() };
    const { next, ok } = await mutateShared("actas-reuniones", true, (current) => [nueva, ...current]);
    setActas(next);
    setSaveError(ok ? null : "No se pudo guardar. Intenta de nuevo.");
    setForm(emptyActaForm);
    setPuntosTexto("");
    setVista("actas");
  };

  const eliminarActa = async (id) => {
    const { next, ok } = await mutateShared("actas-reuniones", true, (current) => current.filter((a) => a.id !== id));
    setActas(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
    if (detalleId === id) setVista("actas");
  };

  const actaDetalle = (actas || []).find((a) => a.id === detalleId);
  const actasFiltradas = (actas || []).filter((a) => categoriaFiltro === "todas" || a.categoria === categoriaFiltro);

  return (
    <div>
      {saveError && <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: (T.rose + "1F"), color: T.rose, border: `1px solid ${T.rose}33` }}>{saveError}</div>}

      {vista === "inicio" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <p className="md:col-span-2 text-sm mb-1" style={{ color: T.dim }}>Documentos y registros de referencia del equipo.</p>
          <button onClick={() => setVista("actas")} className="rounded-xl p-5 flex items-center gap-4 text-left transition-transform hover:scale-[1.01]" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: T.blue }}>
              <LimablueDots color="#FFFFFF" size={26} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: T.text }}>Actas de Reuniones</p>
              <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>Acuerdos, presentes, firmas — incluye reuniones de sede y Paid Media</p>
            </div>
          </button>
          <button onClick={() => setVista("conflictos")} className="rounded-xl p-5 flex items-center gap-4 text-left transition-transform hover:scale-[1.01]" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: T.rose }}>
              <LimablueDots color="#FFFFFF" size={26} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: T.text }}>Resolución de Conflictos</p>
              <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>Base de datos de casos de mal servicio reportados</p>
            </div>
          </button>
          <button onClick={() => setVista("reportesDiarios")} className="rounded-xl p-5 flex items-center gap-4 text-left transition-transform hover:scale-[1.01]" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: T.purple }}>
              <LimablueDots color="#FFFFFF" size={26} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: T.text }}>Reportes Diarios</p>
              <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>Resumen del día por área, listo para exportar en PDF</p>
            </div>
          </button>
          {permisos?.acceso === "total" && (
            <button onClick={() => setVista("credenciales")} className="rounded-xl p-5 flex items-center gap-4 text-left transition-transform hover:scale-[1.01]" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: T.slate }}>
                <LimablueDots color="#FFFFFF" size={26} />
              </div>
              <div>
                <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: T.text }}>Cuentas y Contraseñas <Eye size={12} color="#94A3B8" /></p>
                <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>Redes sociales, usuarios y números anexados — solo Gerencia y Coordinación</p>
              </div>
            </button>
          )}
          {permisos?.acceso === "total" && (
            <button onClick={() => setVista("contratos")} className="rounded-xl p-5 flex items-center gap-4 text-left transition-transform hover:scale-[1.01]" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: T.blue }}>
                <LimablueDots color="#FFFFFF" size={26} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: T.text }}>Contratos</p>
                <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>Proveedores, clientes y servicios — vigencia y montos</p>
              </div>
            </button>
          )}
        </div>
      )}

      {vista === "conflictos" && <ConflictosPanel onBack={() => setVista("inicio")} />}
      {vista === "reportesDiarios" && <ReportesDiariosPanel onBack={() => setVista("inicio")} />}
      {vista === "credenciales" && permisos?.acceso === "total" && <CredencialesPanel onBack={() => setVista("inicio")} />}
      {vista === "contratos" && permisos?.acceso === "total" && <ContratosPanel onBack={() => setVista("inicio")} />}

      {vista === "actas" && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <button onClick={() => setVista("inicio")} className="text-xs font-medium flex items-center gap-1" style={{ color: T.dim }}>
              <ChevronLeft size={14} /> Biblioteca
            </button>
            <button onClick={() => { setForm(emptyActaForm); setPuntosTexto(""); setVista("nueva"); }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.blue }}>
              <Plus size={16} strokeWidth={2.5} /> Nueva acta
            </button>
          </div>
          <div className="mb-4">
            <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)} className="text-xs">
              <option value="todas">Todos los tipos de reunión</option>
              {CATEGORIAS_REUNION.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          {loading ? (
            <p className="text-sm" style={{ color: T.dim }}>Cargando…</p>
          ) : actasFiltradas.length === 0 ? (
            <div className="text-sm text-center py-10 rounded-lg" style={{ color: "#94A3B8", border: `1px dashed ${T.border}` }}>No hay actas para este filtro.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {actasFiltradas.map((a) => (
                <button key={a.id} onClick={() => { setDetalleId(a.id); setVista("detalle"); }} className="rounded-xl p-4 text-left flex items-center justify-between gap-3" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium" style={{ color: T.text }}>Reunión del {a.fechaReunion}</p>
                      {a.categoria && a.categoria !== "general" && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: T.blue + "14", color: T.blue }}>
                          {CATEGORIAS_REUNION.find((c) => c.id === a.categoria)?.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{a.presentes.length} presentes · {a.puntos.length} puntos tratados</p>
                  </div>
                  <ChevronRight size={16} color="#94A3B8" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {vista === "nueva" && (
        <div>
          <button onClick={() => setVista("actas")} className="text-xs font-medium flex items-center gap-1 mb-4" style={{ color: T.dim }}>
            <ChevronLeft size={14} /> Cancelar
          </button>
          <div className="rounded-xl p-5" style={{ background: T.panel, border: `1px solid ${T.blue}55` }}>
            <h3 className="disp text-sm font-semibold mb-4" style={{ color: T.text }}>Nueva acta de reunión</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <label className="text-xs" style={{ color: T.dim }}>
                Fecha de la reunión
                <input type="date" className="w-full mt-1" value={form.fechaReunion} onChange={(e) => setForm({ ...form, fechaReunion: e.target.value })} />
              </label>
              <label className="text-xs" style={{ color: T.dim }}>
                Tipo de reunión
                <select className="w-full mt-1" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                  {CATEGORIAS_REUNION.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </label>
              <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
                Personas presentes
                <div className="flex gap-2 mt-1">
                  <input className="flex-1" placeholder="Nombre y Enter" value={presenteInput} onChange={(e) => setPresenteInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPresente(); } }} />
                  <button type="button" onClick={addPresente} className="px-3 rounded-lg text-xs font-medium" style={{ background: T.panelAlt, color: T.blue, border: `1px solid ${T.border}` }}>+</button>
                </div>
              </label>
            </div>
            {form.presentes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {form.presentes.map((p) => (
                  <span key={p} className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full" style={{ background: T.blue + "14", color: T.blue }}>
                    {p}<button type="button" onClick={() => removePresente(p)}><X size={10} /></button>
                  </span>
                ))}
              </div>
            )}

            <p className="text-xs font-medium mb-2" style={{ color: T.dim }}>Puntos tratados</p>
            <p className="text-[11px] mb-2" style={{ color: "#94A3B8" }}>Escribe todos los puntos de la reunión en un solo bloque, uno por línea. Después podrás ponerle a cada uno su fecha tentativa de cierre.</p>
            <div className="flex gap-2 mb-3">
              <textarea
                rows={4}
                className="flex-1 resize-none"
                placeholder={"Ej.\nSe acuerda lanzar la campaña el 20 de julio\nDiseño entrega arte final la próxima semana\nCoordinación confirma proveedor de impresión"}
                value={puntosTexto}
                onChange={(e) => setPuntosTexto(e.target.value)}
              />
              <button type="button" onClick={procesarPuntos} className="px-3 rounded-lg text-xs font-medium self-start" style={{ background: T.panelAlt, color: T.blue, border: `1px solid ${T.border}` }}>Agregar puntos</button>
            </div>
            {form.puntos.length > 0 && (
              <div className="flex flex-col gap-2 mb-5">
                {form.puntos.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2 rounded-lg p-2" style={{ background: T.panelAlt }}>
                    <span className="text-xs mono shrink-0" style={{ color: "#94A3B8" }}>{i + 1}.</span>
                    <span className="text-xs flex-1" style={{ color: T.text }}>{p.texto}</span>
                    <input type="date" className="text-[11px] py-1 px-1.5" style={{ width: 130 }} value={p.fecha} onChange={(e) => updatePuntoFecha(p.id, e.target.value)} title="Fecha tentativa de cierre" />
                    <button type="button" onClick={() => removePunto(p.id)}><X size={12} color={T.rose} /></button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs font-medium mb-2" style={{ color: T.dim }}>Firmas</p>
            {form.presentes.length === 0 ? (
              <p className="text-xs mb-2" style={{ color: "#94A3B8" }}>Agrega personas presentes arriba para que cada una pueda firmar aquí.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {form.presentes.map((persona) => (
                  <div key={persona}>
                    <p className="text-[11px] font-medium mb-1 truncate" style={{ color: T.text }}>{persona}</p>
                    <SignaturePad
                      value={form.firmas[persona] || null}
                      onChange={(dataUrl) => setForm({ ...form, firmas: { ...form.firmas, [persona]: dataUrl } })}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <button type="button" onClick={() => setVista("actas")} className="flex-1 py-2.5 rounded-lg font-medium text-sm" style={{ background: T.panelAlt, color: T.dim }}>Cancelar</button>
              <button type="button" onClick={guardarActa} className="flex-1 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.blue }}>Guardar acta</button>
            </div>
          </div>
        </div>
      )}

      {vista === "detalle" && actaDetalle && (
        <div>
          <button onClick={() => setVista("actas")} className="text-xs font-medium flex items-center gap-1 mb-4" style={{ color: T.dim }}>
            <ChevronLeft size={14} /> Actas de Reuniones
          </button>
          <div className="rounded-xl p-5" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="disp text-base font-semibold" style={{ color: T.text }}>Reunión del {actaDetalle.fechaReunion}</h3>
                {actaDetalle.categoria && actaDetalle.categoria !== "general" && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full inline-block mt-1" style={{ background: T.blue + "14", color: T.blue }}>
                    {CATEGORIAS_REUNION.find((c) => c.id === actaDetalle.categoria)?.label}
                  </span>
                )}
                <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>Presentes: {actaDetalle.presentes.join(", ") || "—"}</p>
              </div>
              <button onClick={() => eliminarActa(actaDetalle.id)}><Trash2 size={15} color={T.rose} /></button>
            </div>
            <p className="text-xs font-medium mb-2" style={{ color: T.dim }}>Puntos tratados</p>
            <div className="flex flex-col gap-2 mb-5">
              {actaDetalle.puntos.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg p-2.5" style={{ background: T.panelAlt }}>
                  <span className="text-sm" style={{ color: T.text }}>{i + 1}. {p.texto}</span>
                  {p.fecha && <span className="text-[11px] mono shrink-0" style={{ color: T.blue }}>{p.fecha}</span>}
                </div>
              ))}
            </div>
            {actaDetalle.firmas && Object.keys(actaDetalle.firmas).length > 0 && (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: T.dim }}>Firmas</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(actaDetalle.firmas).filter(([, v]) => v).map(([persona, firma]) => (
                    <div key={persona}>
                      <p className="text-[11px] mb-1 truncate" style={{ color: "#94A3B8" }}>{persona}</p>
                      <img src={firma} alt={`Firma de ${persona}`} className="rounded-lg w-full" style={{ background: "#fff", border: `1px solid ${T.border}`, maxHeight: 80, objectFit: "contain" }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


/* ---------------------------------- ACCESO POR CARGO (sin contraseña) ---------------------------------- */
const EQUIPO_SEED = [
  { nombre: "Juan Carlos Vizcarra", cargo: "gerente" },
  { nombre: "Abel Gonzales", cargo: "coordinador" },
  { nombre: "Mayra Zelada", cargo: "disenador" },
  { nombre: "Sin agente", cargo: "edicion_audiovisual" },
];

async function cargarEquipo() {
  try {
    const res = await window.storage.get("usuarios-equipo", true);
    const lista = res ? JSON.parse(res.value) : null;
    if (lista && lista.length > 0) return lista;
  } catch (e) { /* no existía, la sembramos abajo */ }
  const semilla = EQUIPO_SEED.map((p) => ({ ...p, id: uid(), creado: nowStamp() }));
  try {
    await window.storage.set("usuarios-equipo", JSON.stringify(semilla), true);
  } catch (e) { /* no-op */ }
  return semilla;
}

function LoginScreen({ onLogin }) {
  const [equipo, setEquipo] = useState(null);

  useEffect(() => { (async () => setEquipo(await cargarEquipo()))(); }, []);

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6" style={{ background: T.bg, fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
        .disp { font-family: 'Space Grotesk', sans-serif; }
        input, select {
          background: ${T.panelAlt}; border: 1px solid ${T.border}; color: ${T.text};
          border-radius: 8px; padding: 10px 12px; font-size: 14px; outline: none; font-family: 'Inter', sans-serif; width: 100%;
        }
        input:focus, select:focus { border-color: ${T.blue}; }
      `}</style>
      <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: T.panel, border: `1px solid ${T.border}`, boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${T.blue}, ${T.blueDark})` }}>
            <LimablueDots color="#FFFFFF" size={20} />
          </div>
          <div>
            <p className="disp text-base font-semibold" style={{ color: T.text }}>Limablue · Marketing</p>
            <p className="text-xs" style={{ color: T.dim }}>¿Quién eres?</p>
          </div>
        </div>

        {equipo === null ? (
          <p className="text-sm" style={{ color: T.dim }}>Cargando…</p>
        ) : (
          <div className="flex flex-col gap-2">
            {equipo.map((p) => {
              const cm = cargoMeta(p.cargo);
              return (
                <button
                  key={p.id}
                  onClick={() => onLogin({ cargo: p.cargo, username: p.nombre, userId: p.id })}
                  className="flex items-center gap-3 p-3 rounded-xl text-left transition-transform hover:scale-[1.01]"
                  style={{ background: T.panelAlt, border: `1px solid ${T.border}` }}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ background: cm.color + "1A", color: cm.color }}>
                    {p.nombre.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: T.text }}>{p.nombre}</p>
                    <p className="text-[11px]" style={{ color: cm.color }}>{cm.label}</p>
                  </div>
                </button>
              );
            })}
            <button
              onClick={() => onLogin({ cargo: "visitante", username: "Visitante" })}
              className="flex items-center gap-3 p-3 rounded-xl text-left mt-1"
              style={{ background: "transparent", border: `1px dashed ${T.border}` }}
            >
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "#94A3B81A" }}>
                <Eye size={15} color="#94A3B8" />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: T.text }}>Entrar como Visitante</p>
                <p className="text-[11px]" style={{ color: "#94A3B8" }}>Solo puede ver el resumen de pendientes</p>
              </div>
            </button>
            <p className="text-[10px] mt-2" style={{ color: "#94A3B8" }}>
              Sin contraseña — solo identifica quién eres. Un Gerente o Coordinador puede agregar o quitar personas desde dentro del panel.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function RoleTransition({ cargo, username, onFinish }) {
  useEffect(() => {
    const t = setTimeout(onFinish, 1500);
    return () => clearTimeout(t);
  }, []);

  const variante = cargo.acceso === "total" ? "bounce" : cargo.acceso === "area" ? "slide" : "fade";

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${cargo.color}, ${cargo.color}CC)`, zIndex: 9999 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
        @keyframes lbBounceIn { 0% { opacity: 0; transform: scale(0) translateY(14px); } 60% { transform: scale(1.15) translateY(0); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes lbSlideIn { 0% { opacity: 0; transform: translateX(-24px); } 100% { opacity: 1; transform: translateX(0); } }
        @keyframes lbFadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes lbRingPulse { 0% { transform: scale(0.8); opacity: 0.5; } 100% { transform: scale(1.6); opacity: 0; } }
        @keyframes lbTextIn { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes lbFadeOutAll { 0% { opacity: 1; } 100% { opacity: 0; } }
        .lb-dot-bounce { opacity: 0; animation: lbBounceIn 0.55s cubic-bezier(.34,1.56,.64,1) forwards; transform-origin: center; transform-box: fill-box; }
        .lb-dot-slide { opacity: 0; animation: lbSlideIn 0.45s ease-out forwards; }
        .lb-dot-fade { opacity: 0; animation: lbFadeIn 0.7s ease-out forwards; }
        .lb-ring { animation: lbRingPulse 1.3s ease-out infinite; }
        .lb-role-text { opacity: 0; animation: lbTextIn 0.5s ease-out forwards; animation-delay: 0.55s; }
        .lb-role-wrap { animation: lbFadeOutAll 0.35s ease-in forwards; animation-delay: 1.15s; }
      `}</style>
      <div className="lb-role-wrap flex flex-col items-center relative">
        {variante === "bounce" && (
          <span className="lb-ring absolute rounded-full" style={{ width: 140, height: 140, border: "2px solid #FFFFFF88", top: "50%", left: "50%", marginTop: -70, marginLeft: -70 }} />
        )}
        <LimablueDots
          color="#FFFFFF"
          size={variante === "bounce" ? 150 : 120}
          animated
          delayStep={variante === "slide" ? 0.08 : 0.11}
          animClass={variante === "bounce" ? "lb-dot-bounce" : variante === "slide" ? "lb-dot-slide" : "lb-dot-fade"}
        />
        <p className="lb-role-text" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 22, color: "#FFFFFF", marginTop: 18 }}>
          {username}
        </p>
        <p className="lb-role-text" style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#FFFFFFC0", marginTop: 2, animationDelay: "0.68s" }}>
          {cargo.label}
        </p>
      </div>
    </div>
  );
}

function LoginGate() {
  // El login real (por cuenta) ocurre en main.jsx: la app solo se monta con un usuario autenticado.
  // Aqui tomamos ese usuario (cargo, nombre, id) en vez del antiguo selector de cargo sin contrasena.
  const authUser = typeof window !== "undefined" ? window.__AUTH_USER__ : null;
  const [session] = useState(
    authUser ? { cargo: authUser.cargo, username: authUser.nombre, userId: authUser.id } : null
  );
  const logout = () => { if (typeof window !== "undefined" && window.__LOGOUT__) window.__LOGOUT__(); };
  if (!session) return null;
  if (session.cargo === "visitante") return <VisitanteDashboard onLogout={logout} />;
  return <MainApp session={session} onLogout={logout} />;
}

/* ---------------------------------- DASHBOARD MENSUAL ---------------------------------- */
function DashboardPanel() {
  const [vista, setVista] = useState("mes"); // dia | semana | mes
  const [periodo, setPeriodo] = useState(() => localISO().slice(0, 7));
  const [tasks, setTasks] = useState(null);
  const [tickets, setTickets] = useState(null);
  const [adsData, setAdsData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r1 = await window.storage.get("marketing-tasks-v2", true);
        setTasks(r1 ? JSON.parse(r1.value) : []);
      } catch (e) { setTasks([]); }
      try {
        const rTix = await window.storage.get("ticket-inbox", true);
        setTickets(rTix ? JSON.parse(rTix.value) : []);
      } catch (e) { setTickets([]); }
      try {
        const r2 = await window.storage.get("ads-performance", true);
        setAdsData(r2 ? JSON.parse(r2.value) : null);
      } catch (e) { setAdsData(null); }
      setLoading(false);
    })();
  }, []);

  const cambiarVista = (v) => {
    setVista(v);
    const hoy = localISO();
    if (v === "dia") setPeriodo(hoy);
    else if (v === "semana") setPeriodo(lunesDeSemana(hoy));
    else setPeriodo(hoy.slice(0, 7));
  };

  const rango = useMemo(() => {
    if (vista === "dia") return { inicio: periodo, fin: periodo };
    if (vista === "semana") return { inicio: periodo, fin: domingoDeSemana(periodo) };
    return { inicio: periodo + "-01", fin: periodo + "-31" };
  }, [vista, periodo]);

  const etiquetaPeriodo = vista === "dia" ? "día" : vista === "semana" ? "semana" : "mes";

  const enRango = (stamp) => {
    if (!stamp) return false;
    const d = localISO(new Date(stamp));
    return d >= rango.inicio && d <= rango.fin;
  };

  const resumenTareas = useMemo(() => {
    const delPeriodo = (tasks || []).filter((t) => enRango(t.creado));
    return {
      total: delPeriodo.length,
      listos: delPeriodo.filter((t) => t.estado === "done").length,
      noListos: delPeriodo.filter((t) => t.estado === "todo" || t.estado === "doing").length,
      suspendidos: delPeriodo.filter((t) => t.estado === "suspendido").length,
      emergencias: delPeriodo.filter((t) => t.esEmergencia),
      porArea: DEPARTAMENTOS.filter((d) => d.id !== "bandeja").map((d) => ({
        area: d,
        total: delPeriodo.filter((t) => t.departamento === d.id).length,
        listos: delPeriodo.filter((t) => t.departamento === d.id && t.estado === "done").length,
      })),
    };
  }, [tasks, rango]);

  const ticketsDelMes = useMemo(() => (tickets || []).filter((t) => enRango(t.creado)), [tickets, rango]);
  const pieAreaData = useMemo(
    () => resumenTareas.porArea.filter((p) => p.total > 0).map((p) => ({ name: p.area.label, value: p.total, color: p.area.color })),
    [resumenTareas]
  );

  const resumenAds = useMemo(() => {
    const rows = (adsData?.rows || []).filter((r) => r.fecha && r.fecha >= rango.inicio && r.fecha <= rango.fin);
    const gasto = rows.reduce((a, r) => a + r.gasto, 0);
    const msgRows = rows.filter((r) => normalize(r.indicador).includes("messaging_conversation_started"));
    const conversaciones = msgRows.reduce((a, r) => a + r.resultados, 0);
    const gastoConv = msgRows.reduce((a, r) => a + r.gasto, 0);
    return { gasto, conversaciones, costoPorConversacion: conversaciones ? gastoConv / conversaciones : 0, filas: rows.length };
  }, [adsData, rango]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <p className="text-sm" style={{ color: T.dim }}>Resumen del {etiquetaPeriodo} — listo para el sustento de fin de mes.</p>
        <div className="flex flex-wrap items-center gap-2">
          {[{ id: "dia", label: "Diaria" }, { id: "semana", label: "Semanal" }, { id: "mes", label: "Mensual" }].map((v) => (
            <button
              key={v.id}
              onClick={() => cambiarVista(v.id)}
              className="text-xs font-medium px-3 py-1.5 rounded-full"
              style={{
                background: vista === v.id ? T.blue + "1F" : T.panelAlt,
                color: vista === v.id ? T.blue : T.dim,
                border: `1px solid ${vista === v.id ? T.blue + "66" : T.border}`,
              }}
            >
              {v.label}
            </button>
          ))}
          {vista === "dia" && <input type="date" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />}
          {vista === "semana" && (
            <input type="date" value={periodo} onChange={(e) => setPeriodo(lunesDeSemana(e.target.value))} />
          )}
          {vista === "mes" && <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />}
        </div>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: T.dim }}>Cargando…</p>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Pendientes */}
          <div>
            <h3 className="disp text-sm font-semibold mb-3" style={{ color: T.text }}>Pendientes del {etiquetaPeriodo}</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
              <StatCard icon={<ClipboardList size={16} />} label="Total registrados" value={resumenTareas.total} color={T.blue} />
              <StatCard icon={<CheckCircle2 size={16} />} label="Listos" value={resumenTareas.listos} color={T.teal} />
              <StatCard icon={<AlertTriangle size={16} />} label="No listos" value={resumenTareas.noListos} color={T.amber} />
              <StatCard icon={<X size={16} />} label="Suspendidos" value={resumenTareas.suspendidos} color={T.rose} />
              <StatCard icon={<MessageSquare size={16} />} label="Tickets sin asignar" value={ticketsDelMes.length} color={T.purple} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl overflow-hidden" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: "#94A3B8" }}>Área</th>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: "#94A3B8" }}>Registrados</th>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: "#94A3B8" }}>Completados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumenTareas.porArea.map(({ area, total, listos }) => (
                      <tr key={area.id} style={{ borderBottom: `1px solid ${T.panelAlt}` }}>
                        <td className="px-4 py-2" style={{ color: T.text }}><span className="w-1.5 h-1.5 rounded-full inline-block mr-1.5" style={{ background: area.color }} />{area.label}</td>
                        <td className="px-4 py-2 mono" style={{ color: T.dim }}>{total}</td>
                        <td className="px-4 py-2 mono" style={{ color: T.dim }}>{listos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-xl p-4" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                <p className="text-xs font-medium mb-2" style={{ color: T.dim }}>Distribución de pendientes por área</p>
                {pieAreaData.length === 0 ? (
                  <p className="text-xs py-8 text-center" style={{ color: "#94A3B8" }}>Sin pendientes registrados este mes.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieAreaData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={78} paddingAngle={2}>
                        {pieAreaData.map((entry, i) => <Cell key={i} fill={entry.color} stroke={T.panel} strokeWidth={2} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: T.panelAlt, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }}
                        itemStyle={{ color: T.text }}
                        labelStyle={{ color: T.text }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, color: T.dim }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Emergencias */}
          <div>
            <h3 className="disp text-sm font-semibold mb-3" style={{ color: T.text }}>Pendientes de emergencia ({resumenTareas.emergencias.length})</h3>
            {resumenTareas.emergencias.length === 0 ? (
              <p className="text-xs" style={{ color: "#94A3B8" }}>No hubo pendientes de emergencia este mes.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {resumenTareas.emergencias.map((t) => (
                  <div key={t.id} className="rounded-lg p-3" style={{ background: (T.rose + "1F"), border: `1px solid ${T.rose}33` }}>
                    <p className="text-sm font-medium" style={{ color: T.text }}>{t.titulo}</p>
                    <p className="text-xs mt-1" style={{ color: T.dim }}>{t.sustentoEmergencia}</p>
                    <p className="text-[11px] mt-1" style={{ color: T.rose }}>Solicitado por: {t.solicitadoPor || "—"} · {deptMeta(t.departamento).label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ads */}
          <div>
            <h3 className="disp text-sm font-semibold mb-3" style={{ color: T.text }}>Meta Ads del {etiquetaPeriodo}</h3>
            {resumenAds.filas === 0 ? (
              <p className="text-xs" style={{ color: "#94A3B8" }}>No hay datos de Meta Ads importados para este mes.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatCard icon={<CircleDollarSign size={16} />} label="Inversión" value={fmtSoles(resumenAds.gasto)} color={T.blue} />
                <StatCard icon={<MessageSquare size={16} />} label="Conversaciones" value={fmtNum(resumenAds.conversaciones)} color={T.purple} />
                <StatCard icon={<Target size={16} />} label="Costo por conversación" value={fmtSoles(resumenAds.costoPorConversacion)} color={T.amber} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EquipoAdminPanel({ onClose }) {
  const [equipo, setEquipo] = useState(null);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({ nombre: "", cargo: "gerente" });
  const [error, setError] = useState(null);

  useEffect(() => { (async () => setEquipo(await cargarEquipo()))(); }, []);

  const agregar = async () => {
    if (!form.nombre.trim()) { setError("Ponle un nombre a la persona."); return; }
    const nueva = { ...form, nombre: form.nombre.trim(), id: uid(), creado: nowStamp() };
    const { next, ok } = await mutateShared("usuarios-equipo", true, (current) => [...current, nueva]);
    setEquipo(next);
    setError(ok ? null : "No se pudo guardar. Intenta de nuevo.");
    setForm({ nombre: "", cargo: "gerente" });
    setMsg(ok ? `"${nueva.nombre}" agregado como ${cargoMeta(nueva.cargo).label}.` : null);
  };

  const eliminar = async (id) => {
    const { next, ok } = await mutateShared("usuarios-equipo", true, (current) => current.filter((p) => p.id !== id));
    setEquipo(next);
    setMsg(ok ? "Persona eliminada." : null);
    if (!ok) setError("No se pudo guardar. Intenta de nuevo.");
  };

  const cambiarCargo = async (id, cargo) => {
    const { next, ok } = await mutateShared("usuarios-equipo", true, (current) => current.map((p) => (p.id === id ? { ...p, cargo } : p)));
    setEquipo(next);
    if (!ok) setError("No se pudo guardar. Intenta de nuevo.");
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: "#0F172A55" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-2xl p-6 max-h-[85vh] overflow-y-auto" style={{ background: T.panel, border: `1px solid ${T.border}`, boxShadow: "0 20px 40px rgba(15,23,42,0.15)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="disp text-base font-semibold" style={{ color: T.text }}>Gestionar equipo</h2>
          <button onClick={onClose}><X size={18} color={T.dim} /></button>
        </div>

        {msg && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: T.teal + "14", color: T.teal }}>{msg}</div>}
        {error && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: (T.rose + "1F"), color: T.rose }}>{error}</div>}

        <div className="rounded-xl p-4 mb-5" style={{ background: T.panelAlt, border: `1px solid ${T.border}` }}>
          <p className="text-xs font-semibold mb-3" style={{ color: T.text }}>Agregar persona</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input placeholder="Nombre completo" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} onKeyDown={(e) => e.key === "Enter" && agregar()} />
            <select value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })}>
              {CARGOS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <button onClick={agregar} className="w-full mt-3 py-2 rounded-lg text-xs font-medium text-white" style={{ background: T.blue }}>+ Agregar persona</button>
        </div>

        <p className="text-xs font-semibold mb-2" style={{ color: T.text }}>Equipo actual</p>
        {equipo === null ? (
          <p className="text-xs" style={{ color: T.dim }}>Cargando…</p>
        ) : equipo.length === 0 ? (
          <p className="text-xs" style={{ color: "#94A3B8" }}>No hay nadie agregado todavía.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {equipo.map((p) => {
              const cm = cargoMeta(p.cargo);
              return (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg p-3" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cm.color }} />
                    <span className="text-sm font-medium truncate" style={{ color: T.text }}>{p.nombre}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select value={p.cargo} onChange={(e) => cambiarCargo(p.id, e.target.value)} className="text-[11px]" style={{ padding: "4px 8px" }}>
                      {CARGOS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <button onClick={() => eliminar(p.id)}><Trash2 size={13} color={T.rose} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function VisitanteDashboard({ onLogout }) {
  const [tasks, setTasks] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("marketing-tasks-v2", true);
        setTasks(res ? JSON.parse(res.value) : []);
      } catch (e) {
        setTasks([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const porArea = useMemo(() => {
    return DEPARTAMENTOS.map((d) => {
      const list = (tasks || []).filter((t) => t.departamento === d.id);
      return {
        area: d,
        total: list.length,
        listos: list.filter((t) => t.estado === "done").length,
        enCurso: list.filter((t) => t.estado === "doing").length,
        suspendidos: list.filter((t) => t.estado === "suspendido").length,
        pendientes: list.filter((t) => t.estado === "todo" || t.estado === "doing"),
      };
    });
  }, [tasks]);

  const totales = useMemo(() => {
    const list = tasks || [];
    return {
      total: list.length,
      listos: list.filter((t) => t.estado === "done").length,
      enCurso: list.filter((t) => t.estado === "doing").length,
      suspendidos: list.filter((t) => t.estado === "suspendido").length,
    };
  }, [tasks]);

  return (
    <div className="min-h-screen w-full" style={{ background: T.bg, fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
        .disp { font-family: 'Space Grotesk', sans-serif; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
      `}</style>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${T.blue}, ${T.blueDark})` }}>
              <LimablueDots color="#FFFFFF" size={22} />
            </div>
            <div>
              <h1 className="disp text-xl font-semibold" style={{ color: T.text }}>Limablue · Marketing</h1>
              <p className="text-xs flex items-center gap-1" style={{ color: T.dim }}><Eye size={12} /> Vista de visitante — solo lectura</p>
            </div>
          </div>
          <button onClick={onLogout} className="text-xs font-medium px-2.5 py-1.5 rounded-lg" style={{ background: T.panelAlt, color: T.dim, border: `1px solid ${T.border}` }}>
            Salir
          </button>
        </div>
        <p className="text-sm mb-6" style={{ color: T.dim }}>Resumen general de pendientes por área.</p>

        {loading ? (
          <p className="text-sm" style={{ color: T.dim }}>Cargando…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <StatCard icon={<ClipboardList size={16} />} label="Total" value={totales.total} color={T.blue} />
              <StatCard icon={<CheckCircle2 size={16} />} label="Completados" value={totales.listos} color={T.teal} />
              <StatCard icon={<AlertTriangle size={16} />} label="En curso" value={totales.enCurso} color={T.amber} />
              <StatCard icon={<X size={16} />} label="Suspendidos" value={totales.suspendidos} color={T.rose} />
            </div>

            <div className="flex flex-col gap-6">
              {porArea.map(({ area, total, listos, enCurso, suspendidos, pendientes }) => (
                <div key={area.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: area.color }} />
                    <h3 className="disp text-sm font-semibold" style={{ color: T.text }}>{area.label}</h3>
                    <span className="text-[11px] mono" style={{ color: "#94A3B8" }}>{listos}/{total} completados · {enCurso} en curso{suspendidos > 0 ? ` · ${suspendidos} suspendidos` : ""}</span>
                  </div>
                  {pendientes.length === 0 ? (
                    <p className="text-xs pl-4" style={{ color: "#94A3B8" }}>Sin pendientes activos.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5 pl-4" style={{ borderLeft: `2px solid ${T.border}` }}>
                      {pendientes.map((t) => {
                        const pMeta = priorityMeta(t.prioridad);
                        return (
                          <div key={t.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                            <div className="min-w-0">
                              <p className="text-sm truncate" style={{ color: T.text }}>{t.titulo}</p>
                              <p className="text-[11px]" style={{ color: "#94A3B8" }}>
                                {COLUMNS.find((c) => c.id === t.estado)?.label}
                                {t.responsables?.length > 0 && ` · ${t.responsables.join(", ")}`}
                                {t.fecha && ` · vence ${t.fecha}`}
                              </p>
                            </div>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: pMeta.color + "1A", color: pMeta.color }}>{pMeta.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- FLUJO GENERAL (Pendientes + Producción juntos) ---------------------------------- */
function FlujoPanel() {
  const [tasks, setTasks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtroArea, setFiltroArea] = useState("todas");
  const [filtroEstado, setFiltroEstado] = useState("activos");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const rT = await window.storage.get("marketing-tasks-v2", true);
        setTasks(rT ? JSON.parse(rT.value) : []);
      } catch (e) {
        setTasks([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const items = useMemo(() => {
    if (!tasks) return [];
    const hoy = new Date(new Date().toDateString());

    return tasks.map((t) => {
      const col = COLUMNS.find((c) => c.id === t.estado);
      const atrasado = t.estado !== "done" && t.estado !== "suspendido" && t.fecha && new Date(t.fecha) < hoy;
      return {
        id: "t-" + t.id,
        titulo: t.titulo,
        area: t.departamento,
        responsables: t.responsables || [],
        fecha: t.fecha || null,
        fechaOrden: t.fecha ? new Date(t.fecha).getTime() : Infinity,
        estadoLabel: col ? col.label : t.estado,
        estadoColor: col ? col.color : T.dim,
        esEmergencia: !!t.esEmergencia,
        atrasado,
        completado: t.estado === "done",
      };
    });
  }, [tasks]);

  const filtrados = useMemo(() => {
    return items
      .filter((it) => filtroArea === "todas" || it.area === filtroArea)
      .filter((it) => (filtroEstado === "activos" ? !it.completado : filtroEstado === "completados" ? it.completado : true))
      .filter((it) => !busqueda.trim() || normalize(it.titulo).includes(normalize(busqueda)))
      .sort((a, b) => {
        if (a.atrasado !== b.atrasado) return a.atrasado ? -1 : 1;
        if (a.esEmergencia !== b.esEmergencia) return a.esEmergencia ? -1 : 1;
        return a.fechaOrden - b.fechaOrden;
      });
  }, [items, filtroArea, filtroEstado, busqueda]);

  const resumen = useMemo(() => {
    const activos = items.filter((it) => !it.completado);
    return {
      activos: activos.length,
      atrasados: activos.filter((it) => it.atrasado).length,
      emergencias: activos.filter((it) => it.esEmergencia).length,
      completados: items.filter((it) => it.completado).length,
    };
  }, [items]);

  if (loading) return <div className="text-sm" style={{ color: T.dim }}>Cargando flujo…</div>;

  return (
    <div>
      <div className="mb-6">
        <h2 className="disp text-lg font-semibold" style={{ color: T.text }}>Flujo general</h2>
        <p className="text-sm mt-1" style={{ color: T.dim }}>
          Todos los pendientes del equipo, ordenados por urgencia, para ver todo el trabajo en un solo lugar.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={<LayoutGrid size={16} />} label="Activos" value={resumen.activos} color={T.blue} />
        <StatCard icon={<AlertTriangle size={16} />} label="Atrasados" value={resumen.atrasados} color={T.rose} />
        <StatCard icon={<Flag size={16} />} label="Emergencias" value={resumen.emergencias} color={T.amber} />
        <StatCard icon={<CheckCircle2 size={16} />} label="Completados" value={resumen.completados} color={T.teal} />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)}>
          <option value="todas">Todas las áreas</option>
          {DEPARTAMENTOS.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="activos">Activos</option>
          <option value="completados">Completados</option>
          <option value="todos">Todos</option>
        </select>
        <input
          placeholder="Buscar por título…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="flex-1"
          style={{ minWidth: 180 }}
        />
      </div>

      <div className="space-y-2">
        {filtrados.length === 0 && (
          <div className="text-sm text-center py-10" style={{ color: T.dim }}>No hay elementos con estos filtros.</div>
        )}
        {filtrados.map((it) => {
          const area = deptMeta(it.area);
          return (
            <div
              key={it.id}
              className="flex items-center gap-3 p-3 rounded-lg border"
              style={{ borderColor: it.atrasado ? T.rose : T.border, background: it.atrasado ? (T.rose + "1F") : T.panel }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: area.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate" style={{ color: T.text }}>{it.titulo || "(sin título)"}</span>
                  {it.esEmergencia && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: T.rose + "1A", color: T.rose }}>EMERGENCIA</span>
                  )}
                  {it.atrasado && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: T.rose + "1A", color: T.rose }}>ATRASADO</span>
                  )}
                </div>
                <div className="text-xs mt-0.5" style={{ color: T.dim }}>
                  {area.label}
                  {it.responsables.length > 0 ? ` · ${it.responsables.join(", ")}` : ""}
                  {it.fecha ? ` · Entrega: ${it.fecha}` : ""}
                </div>
              </div>
              <span className="text-[11px] font-semibold px-2 py-1 rounded-full shrink-0" style={{ background: it.estadoColor + "1A", color: it.estadoColor }}>
                {it.estadoLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------- FUNNEL DE MARKETING (por objetivo, con filtro de tiempo) ---------------------------------- */
function lunesDeSemana(fechaStr) {
  const d = new Date(fechaStr + "T00:00:00");
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return localISO(d);
}
function domingoDeSemana(lunesStr) {
  const d = new Date(lunesStr + "T00:00:00");
  d.setDate(d.getDate() + 6);
  return localISO(d);
}
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function labelMes(yyyyMm) {
  const [y, m] = yyyyMm.split("-");
  return `${MESES_CORTOS[parseInt(m, 10) - 1]} ${y}`;
}

const OBJETIVOS_FUNNEL = {
  conversaciones: { label: "Conversaciones", desc: "Campañas que buscan iniciar una conversación (leads de mensajes)", color: "#8B6BFF" },
  alcance: { label: "Alcance", desc: "Campañas de reconocimiento de marca — miden personas alcanzadas, no leads directos", color: "#2FB3FF" },
  compras: { label: "Compras directas", desc: "Campañas optimizadas para venta/compra en el sitio", color: "#20E4C0" },
  trafico: { label: "Tráfico (clics)", desc: "Campañas que buscan clics hacia el sitio o enlace", color: "#FFB020" },
  video: { label: "Reproducciones de video", desc: "Campañas de reconocimiento con contenido en video", color: "#EC4899" },
  otro: { label: "Otros objetivos", desc: "Indicador de resultado no reconocido en el reporte", color: "#8CA0C7" },
};
function objetivoDeFila(row) {
  const ind = normalize(row.indicador || "");
  if (ind.includes("reach")) return "alcance";
  if (ind.includes("messaging_conversation_started")) return "conversaciones";
  if (ind.includes("purchase") || (row.compras || 0) > 0) return "compras";
  if (ind.includes("link_click")) return "trafico";
  if (ind.includes("video_thruplay") || ind.includes("video_view")) return "video";
  return "otro";
}

function FunnelMarketingPanel() {
  const [data, setData] = useState(null);
  const [manualData, setManualData] = useState({});
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState("mes"); // dia | semana | mes
  const [periodo, setPeriodo] = useState("");
  const [editandoManual, setEditandoManual] = useState(null);
  const [manualInputs, setManualInputs] = useState({ citasRegistradas: "", citasAsistidas: "" });

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("ads-performance", true);
        setData(r ? JSON.parse(r.value) : null);
      } catch (e) {
        setData(null);
      }
      try {
        const rm = await window.storage.get("funnel-manual-data", true);
        setManualData(rm ? JSON.parse(rm.value) : {});
      } catch (e) {
        setManualData({});
      }
      setLoading(false);
    })();
  }, []);

  const allRows = data?.rows || [];

  const fechasDisponibles = useMemo(() => {
    const set = new Set(allRows.map((r) => r.fecha).filter(Boolean));
    return Array.from(set).sort();
  }, [allRows]);

  const semanasDisponibles = useMemo(() => {
    const map = new Map();
    fechasDisponibles.forEach((f) => {
      const lunes = lunesDeSemana(f);
      if (!map.has(lunes)) map.set(lunes, domingoDeSemana(lunes));
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [fechasDisponibles]);

  const mesesDisponibles = useMemo(() => {
    const set = new Set(fechasDisponibles.map((f) => f.slice(0, 7)));
    return Array.from(set).sort();
  }, [fechasDisponibles]);

  useEffect(() => {
    if (vista === "dia" && fechasDisponibles.length) setPeriodo((p) => (fechasDisponibles.includes(p) ? p : fechasDisponibles[fechasDisponibles.length - 1]));
    else if (vista === "semana" && semanasDisponibles.length) setPeriodo((p) => (semanasDisponibles.some(([l]) => l === p) ? p : semanasDisponibles[semanasDisponibles.length - 1][0]));
    else if (vista === "mes" && mesesDisponibles.length) setPeriodo((p) => (mesesDisponibles.includes(p) ? p : mesesDisponibles[mesesDisponibles.length - 1]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, fechasDisponibles.length, semanasDisponibles.length, mesesDisponibles.length]);

  const rowsFiltradas = useMemo(() => {
    if (!periodo) return allRows;
    if (vista === "dia") return allRows.filter((r) => r.fecha === periodo);
    if (vista === "semana") {
      const domingo = domingoDeSemana(periodo);
      return allRows.filter((r) => r.fecha >= periodo && r.fecha <= domingo);
    }
    if (vista === "mes") return allRows.filter((r) => (r.fecha || "").slice(0, 7) === periodo);
    return allRows;
  }, [allRows, vista, periodo]);

  const funnels = useMemo(() => {
    const porObjetivo = {};
    rowsFiltradas.forEach((r) => {
      const obj = objetivoDeFila(r);
      if (!porObjetivo[obj]) porObjetivo[obj] = { gasto: 0, leads: 0 };
      porObjetivo[obj].gasto += r.gasto || 0;
      if (obj === "alcance") porObjetivo[obj].leads += r.alcance || 0;
      else if (obj === "compras") porObjetivo[obj].leads += r.compras || 0;
      else porObjetivo[obj].leads += r.resultados || 0;
    });
    return Object.keys(porObjetivo)
      .filter((k) => k !== "otro" && OBJETIVOS_FUNNEL[k] && (porObjetivo[k].gasto > 0 || porObjetivo[k].leads > 0))
      .map((k) => ({ objetivo: k, meta: OBJETIVOS_FUNNEL[k], ...porObjetivo[k] }));
  }, [rowsFiltradas]);

  const claveManual = (objetivo) => `${vista}:${periodo}:${objetivo}`;

  const abrirEdicionManual = (objetivo) => {
    const actual = manualData[claveManual(objetivo)] || {};
    setManualInputs({ citasRegistradas: actual.citasRegistradas || "", citasAsistidas: actual.citasAsistidas || "" });
    setEditandoManual(objetivo);
  };

  const guardarManual = async (objetivo) => {
    const clave = claveManual(objetivo);
    const nuevo = {
      ...manualData,
      [clave]: {
        citasRegistradas: parseFloat(manualInputs.citasRegistradas) || 0,
        citasAsistidas: parseFloat(manualInputs.citasAsistidas) || 0,
      },
    };
    setManualData(nuevo);
    try {
      await window.storage.set("funnel-manual-data", JSON.stringify(nuevo), true);
    } catch (e) {
      // si falla el guardado remoto, el valor sigue disponible en esta sesión
    }
    setEditandoManual(null);
  };

  const labelPeriodo = (() => {
    if (vista === "dia") return periodo || "—";
    if (vista === "semana" && periodo) return `${periodo} al ${domingoDeSemana(periodo)}`;
    if (vista === "mes" && periodo) return labelMes(periodo);
    return "—";
  })();

  if (loading) return <div className="text-sm" style={{ color: T.dim }}>Cargando…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="disp text-lg font-semibold" style={{ color: T.text }}>Funnel de marketing</h2>
          <p className="text-sm mt-1" style={{ color: T.dim }}>Un embudo separado por objetivo de campaña, con los datos que subes en Ads.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {[{ id: "dia", label: "Diaria" }, { id: "semana", label: "Semanal" }, { id: "mes", label: "Mensual" }].map((v) => (
          <button
            key={v.id}
            onClick={() => setVista(v.id)}
            className="text-xs font-medium px-3 py-1.5 rounded-full"
            style={{
              background: vista === v.id ? T.blue + "1F" : T.panelAlt,
              color: vista === v.id ? T.blue : T.dim,
              border: `1px solid ${vista === v.id ? T.blue + "66" : T.border}`,
            }}
          >
            {v.label}
          </button>
        ))}
        {vista === "dia" && fechasDisponibles.length > 0 && (
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            {fechasDisponibles.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        )}
        {vista === "semana" && semanasDisponibles.length > 0 && (
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            {semanasDisponibles.map(([lunes, domingo]) => <option key={lunes} value={lunes}>{lunes} al {domingo}</option>)}
          </select>
        )}
        {vista === "mes" && mesesDisponibles.length > 0 && (
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            {mesesDisponibles.map((m) => <option key={m} value={m}>{labelMes(m)}</option>)}
          </select>
        )}
      </div>

      {!data || allRows.length === 0 ? (
        <div className="text-sm text-center py-10 rounded-lg" style={{ color: "#94A3B8", border: `1px dashed ${T.border}` }}>
          Todavía no hay datos de Ads importados. Sube tu reporte de Meta Ads en <b>Marketing → Gestión de Ads</b> y este funnel se llena automáticamente.
        </div>
      ) : funnels.length === 0 ? (
        <div className="text-sm text-center py-10 rounded-lg" style={{ color: "#94A3B8", border: `1px dashed ${T.border}` }}>
          No hay datos de Ads para {labelPeriodo}. Prueba otro periodo.
        </div>
      ) : (
        funnels.map((f) => {
          const clave = claveManual(f.objetivo);
          const manual = manualData[clave];
          const editando = editandoManual === f.objetivo;
          return (
            <div key={f.objetivo} className="rounded-xl p-5 mb-5" style={{ background: T.panel, border: `1px solid ${f.meta.color}44` }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ background: f.meta.color }} />
                <h3 className="disp text-sm font-semibold" style={{ color: f.meta.color }}>Funnel de {f.meta.label}</h3>
              </div>
              <p className="text-xs mb-4" style={{ color: "#8CA0C7" }}>{f.meta.desc}</p>

              <div className="flex flex-col gap-1">
                <div className="rounded-lg py-3 px-4" style={{ background: f.meta.color + "1A", border: `1px solid ${f.meta.color}55` }}>
                  <p className="text-xs font-semibold" style={{ color: f.meta.color }}>Inversión de publicidad</p>
                  <p className="disp text-lg font-bold mono" style={{ color: T.text }}>{fmtSoles(f.gasto)}</p>
                </div>
                <div className="flex items-center gap-2 my-0.5 pl-2">
                  <ChevronDown size={13} color="#8CA0C7" />
                  <span className="text-[11px]" style={{ color: "#8CA0C7" }}>
                    {f.gasto > 0 ? `${fmtSoles(f.gasto / (f.leads || 1))} por ${f.objetivo === "alcance" ? "persona alcanzada" : "lead"}` : ""}
                  </span>
                </div>

                <div className="rounded-lg py-3 px-4" style={{ background: f.meta.color + "10", border: `1px solid ${f.meta.color}33`, width: "88%" }}>
                  <p className="text-xs font-semibold" style={{ color: f.meta.color }}>{f.objetivo === "alcance" ? "Alcance conseguido" : "Leads"}</p>
                  <p className="disp text-lg font-bold mono" style={{ color: T.text }}>{fmtNum(f.leads)}</p>
                </div>
                <div className="flex items-center gap-2 my-0.5 pl-2">
                  <ChevronDown size={13} color="#8CA0C7" />
                </div>

                {f.objetivo !== "alcance" && (
                  <>
                    <div className="rounded-lg py-3 px-4" style={{ background: T.panelAlt, border: `1px dashed ${T.border}`, width: "76%" }}>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold" style={{ color: T.dim }}>Citas registradas</p>
                          <p className="text-[10px] mt-0.5" style={{ color: "#8CA0C7" }}>Pendiente de conectar con tu data real</p>
                        </div>
                        {!editando && (
                          <button onClick={() => abrirEdicionManual(f.objetivo)} className="text-xs font-semibold shrink-0" style={{ color: T.blue }}>
                            {manual ? fmtNum(manual.citasRegistradas) : "+ Agregar"}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 my-0.5 pl-2">
                      <ChevronDown size={13} color="#8CA0C7" />
                    </div>

                    <div className="rounded-lg py-3 px-4" style={{ background: T.panelAlt, border: `1px dashed ${T.border}`, width: "64%" }}>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold" style={{ color: T.dim }}>Citas asistidas en sede</p>
                          <p className="text-[10px] mt-0.5" style={{ color: "#8CA0C7" }}>Pendiente de conectar con tu data real</p>
                        </div>
                        {!editando && (
                          <button onClick={() => abrirEdicionManual(f.objetivo)} className="text-xs font-semibold shrink-0" style={{ color: T.blue }}>
                            {manual ? fmtNum(manual.citasAsistidas) : "+ Agregar"}
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {editando && (
                <div className="mt-3 p-3 rounded-lg flex flex-wrap items-end gap-3" style={{ background: T.panelAlt, border: `1px solid ${T.border}` }}>
                  <label className="text-xs" style={{ color: T.dim }}>
                    Citas registradas
                    <input type="number" className="w-32 mt-1 block" value={manualInputs.citasRegistradas} onChange={(e) => setManualInputs({ ...manualInputs, citasRegistradas: e.target.value })} />
                  </label>
                  <label className="text-xs" style={{ color: T.dim }}>
                    Citas asistidas en sede
                    <input type="number" className="w-32 mt-1 block" value={manualInputs.citasAsistidas} onChange={(e) => setManualInputs({ ...manualInputs, citasAsistidas: e.target.value })} />
                  </label>
                  <button onClick={() => setEditandoManual(null)} className="text-xs font-medium px-3 py-2 rounded-lg" style={{ background: T.panel, color: T.dim }}>Cancelar</button>
                  <button onClick={() => guardarManual(f.objetivo)} className="text-xs font-medium px-3 py-2 rounded-lg text-white" style={{ background: T.blue }}>Guardar</button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function DesempenoPanel() {
  const [vista, setVista] = useState("mes"); // dia | semana | mes
  const [periodo, setPeriodo] = useState(() => localISO().slice(0, 7));
  const [tasks, setTasks] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("marketing-tasks-v2", true);
        setTasks(res ? JSON.parse(res.value) : []);
      } catch (e) {
        setTasks([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cambiarVista = (v) => {
    setVista(v);
    const hoy = localISO();
    if (v === "dia") setPeriodo(hoy);
    else if (v === "semana") setPeriodo(lunesDeSemana(hoy));
    else setPeriodo(hoy.slice(0, 7));
  };

  const rango = useMemo(() => {
    if (vista === "dia") return { inicio: periodo, fin: periodo };
    if (vista === "semana") return { inicio: periodo, fin: domingoDeSemana(periodo) };
    return { inicio: periodo + "-01", fin: periodo + "-31" };
  }, [vista, periodo]);

  const etiquetaPeriodo = vista === "dia" ? "día" : vista === "semana" ? "semana" : "mes";

  const porPersona = useMemo(() => {
    if (!tasks) return [];
    const map = {};
    const ensure = (nombre) => {
      if (!map[nombre]) map[nombre] = { nombre, completadas: 0, enCurso: 0, atrasadas: 0, suspendidas: 0, sumaDias: 0, conteoDias: 0 };
      return map[nombre];
    };
    const hoy = new Date(new Date().toDateString());
    tasks.forEach((t) => {
      const fechaCreado = t.creado ? localISO(new Date(t.creado)) : null;
      if (fechaCreado && (fechaCreado < rango.inicio || fechaCreado > rango.fin)) return;
      const responsables = t.responsables && t.responsables.length > 0 ? t.responsables : ["Sin asignar"];
      responsables.forEach((r) => {
        const p = ensure(r);
        if (t.estado === "done") {
          p.completadas++;
          if (t.creado && t.estadoActualizadoEn) {
            const dias = (new Date(t.estadoActualizadoEn) - new Date(t.creado)) / 86400000;
            if (dias >= 0) { p.sumaDias += dias; p.conteoDias++; }
          }
        } else if (t.estado === "doing") {
          p.enCurso++;
          if (t.fecha && new Date(t.fecha) < hoy) p.atrasadas++;
        } else if (t.estado === "todo") {
          if (t.fecha && new Date(t.fecha) < hoy) p.atrasadas++;
        } else if (t.estado === "suspendido") {
          p.suspendidas++;
        }
      });
    });
    return Object.values(map)
      .map((p) => ({ ...p, tiempoPromedio: p.conteoDias > 0 ? p.sumaDias / p.conteoDias : null }))
      .sort((a, b) => b.completadas - a.completadas);
  }, [tasks, rango]);

  const motivosSuspension = useMemo(() => {
    if (!tasks) return [];
    return tasks
      .filter((t) => t.estado === "suspendido" && t.motivoSuspension)
      .map((t) => ({ id: t.id, titulo: t.titulo, motivo: t.motivoSuspension, area: t.departamento, responsables: t.responsables }));
  }, [tasks]);

  if (loading) return <div className="text-sm" style={{ color: T.dim }}>Cargando…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="disp text-lg font-semibold" style={{ color: T.text }}>Desempeño por persona</h2>
          <p className="text-sm mt-1" style={{ color: T.dim }}>Completadas, atrasos y tiempo promedio de cierre del {etiquetaPeriodo}, por responsable.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[{ id: "dia", label: "Diaria" }, { id: "semana", label: "Semanal" }, { id: "mes", label: "Mensual" }].map((v) => (
            <button
              key={v.id}
              onClick={() => cambiarVista(v.id)}
              className="text-xs font-medium px-3 py-1.5 rounded-full"
              style={{
                background: vista === v.id ? T.blue + "1F" : T.panelAlt,
                color: vista === v.id ? T.blue : T.dim,
                border: `1px solid ${vista === v.id ? T.blue + "66" : T.border}`,
              }}
            >
              {v.label}
            </button>
          ))}
          {vista === "dia" && <input type="date" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />}
          {vista === "semana" && <input type="date" value={periodo} onChange={(e) => setPeriodo(lunesDeSemana(e.target.value))} />}
          {vista === "mes" && <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />}
        </div>
      </div>

      {porPersona.length === 0 ? (
        <p className="text-sm" style={{ color: T.dim }}>No hay tareas asignadas en este {etiquetaPeriodo}.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: T.border }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: T.panelAlt }}>
                <th className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: T.dim }}>Persona</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold" style={{ color: T.dim }}>Completadas</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold" style={{ color: T.dim }}>En curso</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold" style={{ color: T.dim }}>Atrasadas</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold" style={{ color: T.dim }}>Suspendidas</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold" style={{ color: T.dim }}>Tiempo prom. cierre</th>
              </tr>
            </thead>
            <tbody>
              {porPersona.map((p) => (
                <tr key={p.nombre} className="border-t" style={{ borderColor: T.border }}>
                  <td className="px-4 py-2.5 font-medium" style={{ color: T.text }}>{p.nombre}</td>
                  <td className="px-4 py-2.5 text-right mono" style={{ color: T.teal }}>{p.completadas}</td>
                  <td className="px-4 py-2.5 text-right mono" style={{ color: T.amber }}>{p.enCurso}</td>
                  <td className="px-4 py-2.5 text-right mono" style={{ color: p.atrasadas > 0 ? T.rose : T.dim }}>{p.atrasadas}</td>
                  <td className="px-4 py-2.5 text-right mono" style={{ color: p.suspendidas > 0 ? T.rose : T.dim }}>{p.suspendidas}</td>
                  <td className="px-4 py-2.5 text-right mono" style={{ color: T.dim }}>{p.tiempoPromedio != null ? `${p.tiempoPromedio.toFixed(1)} días` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {motivosSuspension.length > 0 && (
        <div className="mt-8">
          <h3 className="disp text-sm font-semibold mb-3" style={{ color: T.text }}>Motivos de tareas suspendidas</h3>
          <div className="space-y-2">
            {motivosSuspension.map((m) => (
              <div key={m.id} className="p-3 rounded-lg border text-sm" style={{ borderColor: T.border, background: T.panel }}>
                <p className="font-medium" style={{ color: T.text }}>{m.titulo}</p>
                <p className="text-xs mt-0.5" style={{ color: T.dim }}>
                  {deptMeta(m.area).label}{m.responsables?.length > 0 ? ` · ${m.responsables.join(", ")}` : ""}
                </p>
                <p className="text-xs mt-1.5" style={{ color: T.rose }}>Motivo: {m.motivo}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- PROMOCIONES E INFLUENCERS (KPI) ---------------------------------- */
const TIPOS_PROMO = [
  { id: "descuento", label: "Descuento" },
  { id: "2x1", label: "2x1" },
  { id: "sorteo", label: "Sorteo" },
  { id: "lanzamiento", label: "Lanzamiento de producto" },
  { id: "otro", label: "Otro" },
];
const PLATAFORMAS_INFLUENCER = ["Instagram", "TikTok", "YouTube", "Facebook", "Otra"];
const emptyPromoForm = { nombre: "", descripcion: "", tipo: "descuento", fechaInicio: localISO(), fechaFin: "", estado: "activa" };

/* ---------------------------------- INFLUENCERS (directorio propio) ---------------------------------- */
const emptyInfluencerPerfilForm = {
  nombre: "", usuario: "", plataforma: "Instagram", whatsapp: "",
  seguidores: "", likesPromedio: "", comentariosPromedio: "",
  categoria: "", notas: "", contratoId: "",
};

function calcularEngagement(seguidores, likes, comentarios) {
  const s = parseFloat(seguidores) || 0;
  const l = parseFloat(likes) || 0;
  const c = parseFloat(comentarios) || 0;
  if (s <= 0) return null;
  return ((l + c) / s) * 100;
}
function nivelEngagement(rate) {
  if (rate == null) return { label: "Sin datos", color: T.dim };
  if (rate >= 6) return { label: "Excelente", color: T.teal };
  if (rate >= 3) return { label: "Bueno", color: T.blue };
  if (rate >= 1) return { label: "Promedio", color: T.amber };
  return { label: "Bajo", color: T.rose };
}

function InfluencersPanel() {
  const [influencers, setInfluencers] = useState(null);
  const [contratos, setContratos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyInfluencerPerfilForm);
  const [formError, setFormError] = useState(null);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("influencers-directorio", true);
        setInfluencers(res ? JSON.parse(res.value) : []);
      } catch (e) {
        setInfluencers([]);
      }
      try {
        const resC = await window.storage.get("contratos-admin", true);
        setContratos(resC ? JSON.parse(resC.value) : []);
      } catch (e) {
        setContratos([]);
      }
      setLoading(false);
    })();
  }, []);

  const crear = async () => {
    if (!form.nombre.trim()) { setFormError("Ponle un nombre o usuario al influencer."); return; }
    const nuevo = { ...form, id: uid(), creado: nowStamp() };
    const { next, ok } = await mutateShared("influencers-directorio", true, (current) => [nuevo, ...current]);
    setInfluencers(next);
    setSaveError(ok ? null : "No se pudo guardar. Intenta de nuevo.");
    setForm(emptyInfluencerPerfilForm);
    setFormError(null);
    setShowForm(false);
  };

  const eliminar = async (id) => {
    const { next, ok } = await mutateShared("influencers-directorio", true, (current) => current.filter((i) => i.id !== id));
    setInfluencers(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };

  const contratosInfluencer = (contratos || []).filter((c) => c.tipo === "influencer");

  const resumen = useMemo(() => {
    const list = influencers || [];
    const totalSeguidores = list.reduce((a, i) => a + (parseFloat(i.seguidores) || 0), 0);
    const conContrato = list.filter((i) => i.contratoId).length;
    const engagements = list.map((i) => calcularEngagement(i.seguidores, i.likesPromedio, i.comentariosPromedio)).filter((v) => v != null);
    const engagementProm = engagements.length ? engagements.reduce((a, v) => a + v, 0) / engagements.length : null;
    return { total: list.length, totalSeguidores, conContrato, engagementProm };
  }, [influencers]);

  if (loading) return <div className="text-sm" style={{ color: T.dim }}>Cargando…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="disp text-lg font-semibold" style={{ color: T.text }}>Influencers</h2>
          <p className="text-sm mt-1" style={{ color: T.dim }}>Directorio de creadores: métricas de engagement, contacto y contrato asociado.</p>
        </div>
        <button onClick={() => { setForm(emptyInfluencerPerfilForm); setFormError(null); setShowForm((s) => !s); }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: showForm ? T.dim : T.blue }}>
          {showForm ? "Cancelar" : <><Plus size={16} strokeWidth={2.5} /> Nuevo influencer</>}
        </button>
      </div>

      {saveError && <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: T.rose + "1F", color: T.rose }}>{saveError}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={<Users size={16} />} label="Influencers registrados" value={resumen.total} color={T.blue} />
        <StatCard icon={<TrendingUp size={16} />} label="Seguidores conectados" value={fmtNum(resumen.totalSeguidores)} color={T.purple} />
        <StatCard icon={<CheckCircle2 size={16} />} label="Con contrato vinculado" value={resumen.conContrato} color={T.teal} />
        <StatCard icon={<Target size={16} />} label="Engagement promedio" value={resumen.engagementProm != null ? `${resumen.engagementProm.toFixed(1)}%` : "—"} color={T.amber} />
      </div>

      {showForm && (
        <div className="rounded-xl p-5 mb-6" style={{ background: T.panel, border: `1px solid ${T.blue}55` }}>
          <h3 className="disp text-sm font-semibold mb-1" style={{ color: T.text }}>Nuevo perfil de influencer</h3>
          <p className="text-xs mb-4" style={{ color: "#94A3B8" }}>
            El contrato en sí se gestiona en <b>Recursos → Biblioteca → Contratos</b> (créalo ahí primero como tipo "Influencer"); aquí solo lo enlazas a este perfil.
          </p>
          {formError && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: T.rose + "1F", color: T.rose }}>{formError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs" style={{ color: T.dim }}>
              Nombre *
              <input className="w-full mt-1" placeholder="Ej. Carla Beauty" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Usuario / @handle
              <input className="w-full mt-1" placeholder="@carla.beauty" value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Plataforma
              <select className="w-full mt-1" value={form.plataforma} onChange={(e) => setForm({ ...form, plataforma: e.target.value })}>
                {PLATAFORMAS_INFLUENCER.map((pl) => <option key={pl} value={pl}>{pl}</option>)}
              </select>
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              WhatsApp
              <input className="w-full mt-1" placeholder="+51 9xx xxx xxx" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Categoría / nicho
              <input className="w-full mt-1" placeholder="Ej. Belleza, Fitness" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Contrato asociado
              <select className="w-full mt-1" value={form.contratoId} onChange={(e) => setForm({ ...form, contratoId: e.target.value })}>
                <option value="">Sin contrato vinculado</option>
                {contratosInfluencer.map((c) => <option key={c.id} value={c.id}>{c.nombre} · {c.contraparte}</option>)}
              </select>
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Seguidores
              <input type="number" className="w-full mt-1" placeholder="0" value={form.seguidores} onChange={(e) => setForm({ ...form, seguidores: e.target.value })} />
            </label>
            <div />
            <label className="text-xs" style={{ color: T.dim }}>
              Likes promedio (últimos posts)
              <input type="number" className="w-full mt-1" placeholder="0" value={form.likesPromedio} onChange={(e) => setForm({ ...form, likesPromedio: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Comentarios promedio
              <input type="number" className="w-full mt-1" placeholder="0" value={form.comentariosPromedio} onChange={(e) => setForm({ ...form, comentariosPromedio: e.target.value })} />
            </label>
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              Notas
              <textarea rows={2} className="w-full mt-1 resize-none" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
            </label>
          </div>

          {(() => {
            const er = calcularEngagement(form.seguidores, form.likesPromedio, form.comentariosPromedio);
            const nivel = nivelEngagement(er);
            return (
              <div className="mt-4 flex items-center gap-2 text-xs px-3 py-2.5 rounded-lg flex-wrap" style={{ background: T.panelAlt }}>
                <span style={{ color: T.dim }}>Engagement calculado:</span>
                {er != null ? (
                  <span className="font-semibold" style={{ color: nivel.color }}>{er.toFixed(1)}% · {nivel.label}</span>
                ) : (
                  <span style={{ color: "#94A3B8" }}>Ingresa seguidores y promedios para calcularlo</span>
                )}
              </div>
            );
          })()}

          <div className="flex gap-2 mt-5">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg font-medium text-sm" style={{ background: T.panelAlt, color: T.dim }}>Cancelar</button>
            <button type="button" onClick={crear} className="flex-1 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.blue }}>Guardar</button>
          </div>
        </div>
      )}

      {(influencers || []).length === 0 ? (
        <div className="text-sm text-center py-10 rounded-lg" style={{ color: "#94A3B8", border: `1px dashed ${T.border}` }}>Todavía no hay influencers registrados.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {influencers.map((i) => {
            const er = calcularEngagement(i.seguidores, i.likesPromedio, i.comentariosPromedio);
            const nivel = nivelEngagement(er);
            const contrato = (contratos || []).find((c) => c.id === i.contratoId);
            return (
              <div key={i.id} className="rounded-xl p-4" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: T.text }}>{i.nombre}</p>
                    <p className="text-xs" style={{ color: T.dim }}>{i.usuario || "—"} · {i.plataforma}{i.categoria ? ` · ${i.categoria}` : ""}</p>
                  </div>
                  <button onClick={() => eliminar(i.id)}><Trash2 size={14} color={T.rose} /></button>
                </div>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className="text-xs" style={{ color: T.dim }}>{fmtNum(i.seguidores)} seguidores</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: nivel.color + "1A", color: nivel.color }}>
                    {er != null ? `${er.toFixed(1)}% engagement · ${nivel.label}` : "Sin datos de engagement"}
                  </span>
                </div>
                {i.whatsapp && <p className="text-xs mt-2" style={{ color: T.dim }}>WhatsApp: {i.whatsapp}</p>}
                <p className="text-xs mt-1" style={{ color: contrato ? T.teal : "#94A3B8" }}>
                  {contrato ? `Contrato: ${contrato.nombre} (${(ESTADOS_CONTRATO.find((e) => e.id === contrato.estado) || {}).label || contrato.estado})` : "Sin contrato vinculado"}
                </p>
                {i.notas && <p className="text-xs mt-1.5" style={{ color: T.dim }}>{i.notas}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PromocionesPanel() {
  const [promos, setPromos] = useState(null);
  const [influencersDirectorio, setInfluencersDirectorio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyPromoForm);
  const [formError, setFormError] = useState(null);
  const [expandido, setExpandido] = useState(null);
  const [influencerSeleccionado, setInfluencerSeleccionado] = useState("");
  const [costoInfluencer, setCostoInfluencer] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("promociones-influencers", true);
        setPromos(res ? JSON.parse(res.value) : []);
      } catch (e) {
        setPromos([]);
      } finally {
        setLoading(false);
      }
    })();
    (async () => {
      try {
        const res = await window.storage.get("influencers-directorio", true);
        setInfluencersDirectorio(res ? JSON.parse(res.value) : []);
      } catch (e) {
        setInfluencersDirectorio([]);
      }
    })();
  }, []);

  const crear = async () => {
    if (!form.nombre.trim()) { setFormError("Ponle un nombre a la promoción."); return; }
    const nueva = { ...form, id: uid(), influencers: [], creado: nowStamp() };
    const { next, ok } = await mutateShared("promociones-influencers", true, (current) => [nueva, ...current]);
    setPromos(next);
    setSaveError(ok ? null : "No se pudo guardar. Intenta de nuevo.");
    setForm(emptyPromoForm);
    setFormError(null);
    setShowForm(false);
  };

  const eliminarPromo = async (id) => {
    const { next, ok } = await mutateShared("promociones-influencers", true, (current) => current.filter((p) => p.id !== id));
    setPromos(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };

  const cambiarEstado = async (id, estado) => {
    const { next, ok } = await mutateShared("promociones-influencers", true, (current) => current.map((p) => (p.id === id ? { ...p, estado } : p)));
    setPromos(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };

  const agregarInfluencer = async (promoId) => {
    if (!influencerSeleccionado) return;
    const perfil = (influencersDirectorio || []).find((i) => i.id === influencerSeleccionado);
    if (!perfil) return;
    const nuevo = {
      id: uid(), influencerId: perfil.id, nombre: perfil.nombre, plataforma: perfil.plataforma,
      seguidores: parseFloat(perfil.seguidores) || 0, costo: parseFloat(costoInfluencer) || 0,
    };
    const { next, ok } = await mutateShared("promociones-influencers", true, (current) =>
      current.map((p) => (p.id === promoId ? { ...p, influencers: [...(p.influencers || []), nuevo] } : p))
    );
    setPromos(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
    setInfluencerSeleccionado("");
    setCostoInfluencer("");
  };

  const quitarInfluencer = async (promoId, influencerId) => {
    const { next, ok } = await mutateShared("promociones-influencers", true, (current) =>
      current.map((p) => (p.id === promoId ? { ...p, influencers: (p.influencers || []).filter((i) => i.id !== influencerId) } : p))
    );
    setPromos(next);
    if (!ok) setSaveError("No se pudo guardar. Intenta de nuevo.");
  };

  const resumen = useMemo(() => {
    const list = promos || [];
    const activas = list.filter((p) => p.estado === "activa").length;
    const influencersUnicos = new Set();
    let inversionInfluencers = 0;
    list.forEach((p) => (p.influencers || []).forEach((i) => {
      influencersUnicos.add(i.influencerId || normalize(i.nombre));
      inversionInfluencers += i.costo || 0;
    }));
    return { total: list.length, activas, influencers: influencersUnicos.size, inversionInfluencers };
  }, [promos]);

  if (loading) return <div className="text-sm" style={{ color: T.dim }}>Cargando…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="disp text-lg font-semibold" style={{ color: T.text }}>Promociones</h2>
          <p className="text-sm mt-1" style={{ color: T.dim }}>Registro de campañas promocionales y qué influencers colaboran en cada una.</p>
        </div>
        <button onClick={() => { setForm(emptyPromoForm); setFormError(null); setShowForm((s) => !s); }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: showForm ? T.dim : T.blue }}>
          {showForm ? "Cancelar" : <><Plus size={16} strokeWidth={2.5} /> Nueva promoción</>}
        </button>
      </div>

      {saveError && <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: (T.rose + "1F"), color: T.rose, border: `1px solid ${T.rose}33` }}>{saveError}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={<Megaphone size={16} />} label="Promociones activas" value={resumen.activas} color={T.blue} />
        <StatCard icon={<ClipboardList size={16} />} label="Total histórico" value={resumen.total} color={T.dim} />
        <StatCard icon={<Users size={16} />} label="Influencers distintos" value={resumen.influencers} color={T.purple} />
        <StatCard icon={<CircleDollarSign size={16} />} label="Inversión en influencers" value={fmtSoles(resumen.inversionInfluencers)} color={T.teal} />
      </div>

      {showForm && (
        <div className="rounded-xl p-5 mb-6" style={{ background: T.panel, border: `1px solid ${T.blue}55` }}>
          <h3 className="disp text-sm font-semibold mb-4" style={{ color: T.text }}>Nueva promoción</h3>
          {formError && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: (T.rose + "1F"), color: T.rose }}>{formError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              Nombre de la promoción *
              <input className="w-full mt-1" placeholder="Ej. Descuento por aniversario" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </label>
            <label className="md:col-span-2 text-xs" style={{ color: T.dim }}>
              Descripción
              <textarea rows={2} className="w-full mt-1 resize-none" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Tipo
              <select className="w-full mt-1" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {TIPOS_PROMO.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Estado
              <select className="w-full mt-1" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                <option value="activa">Activa</option>
                <option value="finalizada">Finalizada</option>
              </select>
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Fecha inicio
              <input type="date" className="w-full mt-1" value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} />
            </label>
            <label className="text-xs" style={{ color: T.dim }}>
              Fecha fin
              <input type="date" className="w-full mt-1" value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-2 mt-5">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg font-medium text-sm" style={{ background: T.panelAlt, color: T.dim }}>Cancelar</button>
            <button type="button" onClick={crear} className="flex-1 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.blue }}>Crear</button>
          </div>
        </div>
      )}

      {(promos || []).length === 0 ? (
        <p className="text-sm" style={{ color: T.dim }}>Aún no registras promociones.</p>
      ) : (
        <div className="space-y-3">
          {promos.map((p) => {
            const tipo = TIPOS_PROMO.find((t) => t.id === p.tipo) || TIPOS_PROMO[TIPOS_PROMO.length - 1];
            const abierto = expandido === p.id;
            return (
              <div key={p.id} className="rounded-xl p-4" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandido(abierto ? null : p.id)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold" style={{ color: T.text }}>{p.nombre}</p>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: T.blue + "14", color: T.blue }}>{tipo.label}</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: p.estado === "activa" ? T.teal + "14" : T.dim + "14", color: p.estado === "activa" ? T.teal : T.dim }}>
                        {p.estado === "activa" ? "Activa" : "Finalizada"}
                      </span>
                    </div>
                    {p.descripcion && <p className="text-xs mt-1" style={{ color: T.dim }}>{p.descripcion}</p>}
                    <p className="text-[11px] mt-1 mono" style={{ color: "#94A3B8" }}>
                      {p.fechaInicio || "?"}{p.fechaFin ? ` → ${p.fechaFin}` : ""} · {(p.influencers || []).length} influencer{(p.influencers || []).length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.estado === "activa" && (
                      <button onClick={() => cambiarEstado(p.id, "finalizada")} className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg" style={{ background: T.panelAlt, color: T.dim }}>Marcar finalizada</button>
                    )}
                    <button onClick={() => eliminarPromo(p.id)}><Trash2 size={14} color={T.rose} /></button>
                  </div>
                </div>

                {abierto && (
                  <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${T.border}` }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: T.dim }}>Influencers en esta promoción</p>
                    {(p.influencers || []).length === 0 ? (
                      <p className="text-xs mb-3" style={{ color: "#94A3B8" }}>Sin influencers asignados todavía.</p>
                    ) : (
                      <div className="space-y-1.5 mb-3">
                        {p.influencers.map((i) => (
                          <div key={i.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg" style={{ background: T.panelAlt }}>
                            <span style={{ color: T.text }}>
                              <b>{i.nombre}</b> · {i.plataforma}{i.seguidores ? ` · ${fmtNum(i.seguidores)} seguidores` : ""}{i.costo ? ` · ${fmtSoles(i.costo)}` : ""}
                            </span>
                            <button onClick={() => quitarInfluencer(p.id, i.id)}><X size={12} color={T.rose} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    {(influencersDirectorio || []).length === 0 ? (
                      <p className="text-xs" style={{ color: "#94A3B8" }}>
                        Todavía no hay influencers en el directorio. Créalos primero en la pestaña <b>Influencers</b> dentro de Marketing.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <select className="md:col-span-2" value={influencerSeleccionado} onChange={(e) => setInfluencerSeleccionado(e.target.value)}>
                          <option value="">Elegir influencer del directorio…</option>
                          {influencersDirectorio.map((i) => (
                            <option key={i.id} value={i.id}>{i.nombre} ({i.usuario || i.plataforma})</option>
                          ))}
                        </select>
                        <input placeholder="Costo (S/)" type="number" value={costoInfluencer} onChange={(e) => setCostoInfluencer(e.target.value)} />
                      </div>
                    )}
                    <button onClick={() => agregarInfluencer(p.id)} className="mt-2 text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: T.blue + "14", color: T.blue }}>+ Agregar a la promoción</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Convierte en pendiente (bloqueado, no borrable) cualquier reunión cuya fecha ya llegó y que
// todavía no se haya convertido. Se llama una sola vez al iniciar la app, encadenada después
// de cualquier otra migración que también toque "marketing-tasks-v2" (para no pisarse entre sí).
export async function convertirReunionesVencidas() {
  try {
    const hoy = localISO();
    const resReuniones = await window.storage.get("reuniones-agendadas", true);
    const reuniones = resReuniones ? JSON.parse(resReuniones.value) : [];
    const porConvertir = reuniones.filter((r) => !r.pendienteGeneradoId && r.fecha <= hoy);
    if (porConvertir.length === 0) return;

    const resTareas = await window.storage.get("marketing-tasks-v2", true);
    const tareas = resTareas ? JSON.parse(resTareas.value) : [];

    const nuevasTareas = [];
    const reunionesActualizadas = reuniones.map((r) => {
      if (!porConvertir.includes(r)) return r;
      const nuevaTarea = {
        id: uid(),
        titulo: `Reunión: ${r.titulo}`,
        descripcion: r.descripcion || "",
        responsables: r.participantes ? r.participantes.split(",").map((p) => p.trim()).filter(Boolean) : [],
        fechaInicio: r.fecha,
        fecha: r.fecha,
        prioridad: "media",
        departamento: r.area,
        esEmergencia: false,
        sustentoEmergencia: "",
        solicitadoPor: "Reuniones",
        firmaSolicitante: null,
        estado: "todo",
        creado: nowStamp(),
        estadoActualizadoEn: nowStamp(),
        bloqueada: true,
        origenReunionId: r.id,
      };
      nuevasTareas.push(nuevaTarea);
      return { ...r, pendienteGeneradoId: nuevaTarea.id };
    });

    await window.storage.set("marketing-tasks-v2", JSON.stringify([...nuevasTareas, ...tareas]), true);
    await window.storage.set("reuniones-agendadas", JSON.stringify(reunionesActualizadas), true);
  } catch (e) {
    console.warn("No se pudo convertir reuniones vencidas:", e);
  }
}

function MainApp({ session, onLogout }) {
  const cargo = cargoMeta(session.cargo);
  const totalAcceso = cargo.acceso === "total";

  // Cada puesto tiene su propia entrada directa dentro de "Gestión", en vez de un tablero único.
  const PENDIENTES_SUBTABS = [
    { id: "pend_tickets", dept: "bandeja", color: T.rose },
    { id: "pend_gerencia", dept: "gerencia" },
    { id: "pend_coordinacion", dept: "coordinacion" },
    { id: "pend_diseno", dept: "diseno" },
    { id: "pend_realizador", dept: "productor_audiovisual" },
    { id: "pend_edicion", dept: "edicion_audiovisual" },
    { id: "pend_productor_ia", dept: "productor_ia" },
  ];
  const PEND_DEPT_BY_TAB = { pendientes: cargo.acceso === "area" ? cargo.area : cargo.acceso === "minimo" ? "bandeja" : "gerencia" };
  PENDIENTES_SUBTABS.forEach((t) => { PEND_DEPT_BY_TAB[t.id] = t.dept; });

  const tabsPermitidas = totalAcceso
    ? ["flujo", "grillas", ...PENDIENTES_SUBTABS.map((t) => t.id), "ads", "influencers", "promociones", "contable_gastos", "contable_pagos", "contable_caja", "contable_licencias", "calendario", "reuniones", "biblioteca", "funnel", "desempeno", "dashboard"]
    : cargo.acceso === "area"
    ? ["flujo", "pendientes", "calendario", "biblioteca"]
    : ["pendientes"]; // minimo (otros)

  const [mainTab, setMainTab] = useState(tabsPermitidas.includes("flujo") ? "flujo" : "pendientes");
  const [showEquipo, setShowEquipo] = useState(false);
  const isTicketHash = typeof window !== "undefined" && window.location.hash === "#ticket";
  const initialDeptTicket = isTicketHash ? "bandeja" : null;

  const TAB_META = {
    flujo: { label: "Flujo general", desc: "Vista completa del flujo de trabajo" },
    grillas: { label: "Contenido", desc: "Grilla de redes, actividades e ideas de video" },
    reuniones: { label: "Reuniones", desc: "Se agendan aparte; al llegar la fecha, pasan solas a pendientes" },
    pendientes: { label: "Mis pendientes", desc: "Tablero de tu área y tickets entrantes" },
    pend_tickets: { label: "Tickets", desc: "Pendientes que reportan otras áreas, listos para distribuir" },
    pend_gerencia: { label: "Gerencia", desc: "Tablero de pendientes de Gerencia" },
    pend_coordinacion: { label: "Coordinación", desc: "Tablero de pendientes de Coordinación" },
    pend_diseno: { label: "Diseño Gráfico", desc: "Tablero de pendientes de Diseño Gráfico" },
    pend_realizador: { label: "Realizador Audiovisual", desc: "Tablero de pendientes de Realización" },
    pend_edicion: { label: "Edición Audiovisual", desc: "Tablero de pendientes de Edición" },
    pend_productor_ia: { label: "Productor IA", desc: "Tablero de pendientes de Productor IA" },
    ads: { label: "Gestión de Ads", desc: "Inversión y rendimiento publicitario" },
    influencers: { label: "Influencers", desc: "Directorio, engagement y contacto" },
    promociones: { label: "Promociones", desc: "Campañas activas del área" },
    calendario: { label: "Calendario", desc: "Agenda de contenidos y reuniones" },
    biblioteca: { label: "Biblioteca", desc: "Actas, contratos, licencias y más" },
    contable_gastos: { label: "Gastos", desc: "Gastos formales, domiciliados y no domiciliados" },
    contable_pagos: { label: "Pagos Programados", desc: "Suscripciones y pagos recurrentes" },
    contable_caja: { label: "Caja Chica", desc: "Ingresos, gastos y saldo acumulado" },
    contable_licencias: { label: "Licencias", desc: "Software y plataformas, con tarjeta y sustento" },
    funnel: { label: "Funnel", desc: "Alcance, resultados, ventas e ingresos estimados" },
    desempeno: { label: "Desempeño", desc: "KPIs de cada persona del equipo" },
    dashboard: { label: "Dashboard", desc: "Resumen ejecutivo del mes" },
  };

  const NAV_GROUPS_ALL = [
    { id: "flujo", label: "Flujo general", icon: <LayoutGrid size={18} />, caption: "Vista completa del flujo de trabajo", tabs: ["flujo"] },
    { id: "gestion", label: "Gestión", icon: <ClipboardList size={18} />, caption: "Pendientes de cada área del equipo", tabs: ["pendientes", "grillas", ...PENDIENTES_SUBTABS.map((t) => t.id)] },
    { id: "marketing", label: "Marketing", icon: <Megaphone size={18} />, caption: "Publicidad, influencers y promociones", tabs: ["ads", "influencers", "promociones"] },
    { id: "contable", label: "Contable", icon: <CircleDollarSign size={18} />, caption: "Gastos y pagos formales del área", tabs: ["contable_gastos", "contable_pagos", "contable_caja", "contable_licencias"] },
    { id: "recursos", label: "Recursos", icon: <BookOpen size={18} />, caption: "Calendario y materiales de referencia", tabs: ["calendario", "reuniones", "biblioteca"] },
    { id: "metricas", label: "Métricas", icon: <TrendingUp size={18} />, caption: "Reportes, KPIs y resumen ejecutivo", tabs: ["funnel", "desempeno", "dashboard"] },
  ];

  const NAV_GROUPS = NAV_GROUPS_ALL
    .map((g) => ({ ...g, tabs: g.tabs.filter((t) => tabsPermitidas.includes(t)) }))
    .filter((g) => g.tabs.length > 0);

  const grupoDeTab = (tabId) => NAV_GROUPS.find((g) => g.tabs.includes(tabId))?.id;
  const [openGroup, setOpenGroup] = useState(() => grupoDeTab(mainTab));

  const seleccionarTab = (tabId) => {
    setMainTab(tabId);
    setOpenGroup(grupoDeTab(tabId));
  };

  const clickGrupo = (grupo) => {
    if (grupo.tabs.length === 1) {
      seleccionarTab(grupo.tabs[0]);
      return;
    }
    setOpenGroup((cur) => (cur === grupo.id ? cur : grupo.id));
  };

  const grupoActivo = NAV_GROUPS.find((g) => g.id === openGroup) || NAV_GROUPS[0];

  return (
    <div className="min-h-screen w-full" style={{ background: T.bg, fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
        .disp { font-family: 'Space Grotesk', sans-serif; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
        input, select, textarea {
          background: ${T.panelAlt}; border: 1px solid ${T.border}; color: ${T.text};
          border-radius: 8px; padding: 8px 10px; font-size: 13px; outline: none; font-family: 'Inter', sans-serif;
        }
        input:focus, select:focus, textarea:focus { border-color: ${T.blue}; }
        ::placeholder { color: #94A3B8; }
        .task-card { cursor: grab; }
        .task-card:active { cursor: grabbing; }

        @keyframes lbNavGroupIn {
          0% { opacity: 0; transform: translateY(-6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .lb-nav-submenu { animation: lbNavGroupIn 0.22s ease; }

        @keyframes lbTabIn {
          0% { opacity: 0; transform: translateY(10px); filter: brightness(1.6) blur(3px); }
          55% { opacity: 1; }
          100% { opacity: 1; transform: translateY(0); filter: brightness(1) blur(0); }
        }
        .lb-tab-transition { animation: lbTabIn 0.45s cubic-bezier(.22,.9,.32,1); }

        @keyframes lbParticleRise {
          0% { transform: translateY(0) scale(0.8); opacity: 0; }
          12% { opacity: var(--lb-particle-opacity, 0.7); }
          82% { opacity: var(--lb-particle-opacity, 0.7); }
          100% { transform: translateY(-105vh) scale(1); opacity: 0; }
        }
        .lb-particles { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
        .lb-particle {
          position: absolute; bottom: -12px; border-radius: 50%;
          background: radial-gradient(circle, rgba(160,215,255,0.95), rgba(80,170,255,0.15) 70%, transparent 100%);
          box-shadow: 0 0 6px 1.5px rgba(80,170,255,0.55);
          animation-name: lbParticleRise;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      `}</style>

      <div className="lb-particles" aria-hidden="true">
        {BG_PARTICLES.map((p, i) => (
          <span
            key={i}
            className="lb-particle"
            style={{
              left: `${p.left}%`,
              width: p.size, height: p.size,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              "--lb-particle-opacity": p.opacity,
            }}
          />
        ))}
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8" style={{ position: "relative", zIndex: 1 }}>
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${T.blue}, ${T.blueDark})` }}>
              <LimablueDots color="#FFFFFF" size={22} />
            </div>
            <div>
              <h1 className="disp text-xl font-semibold" style={{ color: T.text }}>Limablue · Marketing</h1>
              <p className="text-xs" style={{ color: T.dim }}>Pendientes del equipo y rendimiento de Ads en un solo lugar</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-2.5 py-1.5 rounded-full flex items-center gap-1.5" style={{ background: cargo.color + "14", color: cargo.color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: cargo.color }} />
              {session.username} · {cargo.label}
            </span>
            {totalAcceso && (
              <button onClick={() => setShowEquipo(true)} className="text-xs font-medium px-2.5 py-1.5 rounded-lg" style={{ background: T.panelAlt, color: T.dim, border: `1px solid ${T.border}` }}>
                Gestionar equipo
              </button>
            )}
            <button onClick={onLogout} className="text-xs font-medium px-2.5 py-1.5 rounded-lg" style={{ background: T.panelAlt, color: T.dim, border: `1px solid ${T.border}` }}>
              Cambiar de persona
            </button>
          </div>
        </div>
        {showEquipo && <EquipoAdminPanel onClose={() => setShowEquipo(false)} />}

        <div className="rounded-2xl mb-8 overflow-hidden" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
          <div className="flex items-stretch overflow-x-auto">
            {NAV_GROUPS.map((grupo) => {
              const activo = openGroup === grupo.id;
              const contieneTabActivo = grupo.tabs.includes(mainTab);
              return (
                <button
                  key={grupo.id}
                  onClick={() => clickGrupo(grupo)}
                  className="flex items-center gap-2.5 px-4 py-3.5 text-left shrink-0"
                  style={{
                    background: activo ? T.panelAlt : "transparent",
                    borderBottom: contieneTabActivo ? `2px solid ${T.blue}` : "2px solid transparent",
                    minWidth: 150,
                  }}
                >
                  <span style={{ color: contieneTabActivo ? T.blue : T.dim }}>{grupo.icon}</span>
                  <span>
                    <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: contieneTabActivo ? T.blue : T.text }}>
                      {grupo.label}
                      {grupo.tabs.length > 1 && <ChevronRight size={12} style={{ transform: activo ? "rotate(90deg)" : "none", transition: "transform 0.15s ease" }} />}
                    </span>
                    <span className="block text-[10px] mt-0.5" style={{ color: "#8CA0C7" }}>{grupo.caption}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {grupoActivo && grupoActivo.tabs.length > 1 && openGroup === grupoActivo.id && (
            <div className="lb-nav-submenu px-4 py-3 flex flex-wrap gap-2" style={{ borderTop: `1px solid ${T.border}`, background: T.panelAlt }}>
              {grupoActivo.tabs.map((tabId, idx) => {
                const meta = TAB_META[tabId];
                const activo = mainTab === tabId;
                const esTickets = tabId === "pend_tickets";
                const color = esTickets ? T.rose : T.blue;
                return (
                  <button
                    key={tabId}
                    onClick={() => seleccionarTab(tabId)}
                    className="text-left px-3 py-2 rounded-lg"
                    style={{
                      background: esTickets ? color + "14" : activo ? color + "1F" : "transparent",
                      border: esTickets ? `1px solid ${color}55` : activo ? `1px solid ${color}66` : "1px solid transparent",
                      marginRight: esTickets ? 6 : 0,
                    }}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: activo || esTickets ? color : T.text }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: activo || esTickets ? color : T.dim }} />
                      {meta.label}
                    </span>
                    <span className="block text-[10px] mt-0.5 ml-3" style={{ color: "#8CA0C7" }}>{meta.desc}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div key={mainTab} className="lb-tab-transition">
          {mainTab === "flujo" ? <FlujoPanel />
            : mainTab === "grillas" ? <ContenidoPanel />
            : mainTab in PEND_DEPT_BY_TAB ? <PendientesPanel key={mainTab} initialDept={initialDeptTicket || PEND_DEPT_BY_TAB[mainTab]} permisos={cargo} />
            : mainTab === "ads" ? <AdsPanel />
            : mainTab === "influencers" ? <InfluencersPanel />
            : mainTab === "promociones" ? <PromocionesPanel />
            : mainTab === "calendario" ? <CalendarioPanel />
            : mainTab === "reuniones" ? <ReunionesPanel />
            : mainTab === "contable_gastos" ? <GastosContablesPanel />
            : mainTab === "contable_pagos" ? <PagosProgramadosPanel />
            : mainTab === "contable_caja" ? <CajaChicaPanel />
            : mainTab === "contable_licencias" ? <LicenciasPanel />
            : mainTab === "funnel" ? <FunnelMarketingPanel />
            : mainTab === "desempeno" ? <DesempenoPanel />
            : mainTab === "dashboard" ? <DashboardPanel />
            : <BibliotecaPanel permisos={cargo} />}
        </div>
      </div>
    </div>
  );
}

function RevisionPublica({ taskId }) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Subida de material
  const [subiendo, setSubiendo] = useState(false);
  const [archivoTemp, setArchivoTemp] = useState(null); // { nombre, tipo, tamanoKB, dataUrl }
  const [enlaceExterno, setEnlaceExterno] = useState("");
  const [subidoPor, setSubidoPor] = useState("");
  const [errorArchivo, setErrorArchivo] = useState(null);
  const fileInputRef = useRef(null);

  // Decisión
  const [decision, setDecision] = useState(null); // "aprobado" | "rechazado" | null
  const [comentario, setComentario] = useState("");
  const [nombreRevisor, setNombreRevisor] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(null);
  const [errorDecision, setErrorDecision] = useState(null);

  const usaApiRef = useRef(false); // true si /api/revision respondió (producción); false = demo offline (window.storage)

  const cargarTarea = async () => {
    try {
      const res = await fetch(`/api/revision?id=${encodeURIComponent(taskId)}`);
      if (res.ok) {
        const data = await res.json();
        usaApiRef.current = true;
        setTask(data);
        if (data.revisionEstado) setEnviado(data.revisionEstado);
        setLoading(false);
        return;
      }
      if (res.status === 404) { setTask(null); setLoading(false); return; }
    } catch (e) { /* sin servidor: es la demo offline, sigue abajo con window.storage */ }
    try {
      const res = await window.storage.get("marketing-tasks-v2", true);
      const tareas = res ? JSON.parse(res.value) : [];
      const t = tareas.find((x) => x.id === taskId);
      usaApiRef.current = false;
      setTask(t || null);
      if (t?.revisionEstado) setEnviado(t.revisionEstado);
    } catch (e) {
      setError("No se pudo cargar este pendiente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarTarea(); }, [taskId]);

  const onArchivoSeleccionado = (file) => {
    setErrorArchivo(null);
    if (!file) return;
    const LIMITE_KB = file.type.startsWith("video/") ? 4000 : 1200;
    const tamanoKB = Math.round(file.size / 1024);
    if (tamanoKB > LIMITE_KB) {
      setErrorArchivo(`"${file.name}" pesa ${(tamanoKB / 1024).toFixed(1)}MB — el máximo aquí es ${(LIMITE_KB / 1024).toFixed(1)}MB (queda guardado en la base de datos, con espacio limitado). Si el archivo es más pesado, sube el video a Drive/Instagram y pega el enlace abajo en vez de adjuntarlo.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setArchivoTemp({ nombre: file.name, tipo: file.type, tamanoKB, dataUrl: reader.result });
    reader.readAsDataURL(file);
  };

  const guardarMaterial = async () => {
    if (!archivoTemp && !enlaceExterno.trim()) { setErrorArchivo("Adjunta un archivo o pega un enlace al material."); return; }
    if (!subidoPor.trim()) { setErrorArchivo("Escribe tu nombre — queda registrado quién subió el material."); return; }
    setSubiendo(true);
    const nuevoMaterial = {
      nombre: archivoTemp?.nombre || null,
      tipo: archivoTemp?.tipo || null,
      dataUrl: archivoTemp?.dataUrl || null,
      enlaceExterno: enlaceExterno.trim() || null,
      subidoPor: subidoPor.trim(),
      subidoEn: nowStamp(),
    };

    if (usaApiRef.current) {
      try {
        const res = await fetch(`/api/revision?id=${encodeURIComponent(taskId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion: "material", ...nuevoMaterial }),
        });
        const data = await res.json();
        if (!res.ok) { setErrorArchivo(data.error || "No se pudo guardar el material."); setSubiendo(false); return; }
        setTask(data);
      } catch (e) {
        setErrorArchivo("No se pudo guardar el material. Revisa tu conexión.");
      }
    } else {
      const { next } = await mutateShared("marketing-tasks-v2", true, (current) =>
        current.map((t) => (t.id === taskId ? { ...t, archivoRevision: nuevoMaterial } : t))
      );
      setTask(next.find((t) => t.id === taskId));
    }
    setArchivoTemp(null);
    setEnlaceExterno("");
    setSubiendo(false);
  };

  const confirmarDecision = async () => {
    if (!decision) { setErrorDecision("Elige Aprobado o Necesita corrección."); return; }
    if (!nombreRevisor.trim()) { setErrorDecision("Escribe tu nombre — queda registrado quién tomó la decisión."); return; }
    setEnviando(true);
    setErrorDecision(null);

    if (usaApiRef.current) {
      try {
        const res = await fetch(`/api/revision?id=${encodeURIComponent(taskId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion: "decision", revisionEstado: decision, comentarioRevision: comentario.trim(), revisadoPorNombre: nombreRevisor.trim() }),
        });
        const data = await res.json();
        if (!res.ok) { setErrorDecision(data.error || "No se pudo guardar tu decisión."); setEnviando(false); return; }
        setTask(data);
        setEnviado(data.revisionEstado); // el servidor manda: si ya había decisión, respeta esa (una sola vez, de verdad)
      } catch (e) {
        setErrorDecision("No se pudo guardar tu decisión. Revisa tu conexión.");
      } finally {
        setEnviando(false);
      }
      return;
    }

    try {
      const { next } = await mutateShared("marketing-tasks-v2", true, (current) =>
        current.map((t) => (t.id === taskId && !t.revisionEstado ? {
          ...t,
          revisionEstado: decision,
          comentarioRevision: comentario.trim(),
          revisadoPorNombre: nombreRevisor.trim(),
          revisadoEn: nowStamp(),
          estado: decision === "aprobado" ? "done" : "doing",
          estadoActualizadoEn: nowStamp(),
        } : t))
      );
      const actualizada = next.find((t) => t.id === taskId);
      setTask(actualizada);
      setEnviado(actualizada?.revisionEstado || decision);
    } catch (e) {
      setErrorDecision("No se pudo guardar tu decisión. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  const inputStyle = `
    textarea, input[type=text] { background: ${T.panelAlt}; border: 1px solid ${T.border}; color: ${T.text}; border-radius: 8px; padding: 10px 12px; font-size: 14px; outline: none; font-family: 'Inter', sans-serif; width: 100%; }
    textarea:focus, input[type=text]:focus { border-color: ${T.blue}; }
  `;

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6" style={{ background: T.bg, fontFamily: "'Inter', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap'); .disp { font-family: 'Space Grotesk', sans-serif; } ${inputStyle}`}</style>
      <div className="w-full max-w-lg rounded-2xl p-6" style={{ background: T.panel, border: `1px solid ${T.border}`, boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${T.blue}, ${T.blueDark})` }}>
            <LimablueDots color="#FFFFFF" size={20} />
          </div>
          <div>
            <p className="disp text-base font-semibold" style={{ color: T.text }}>Limablue · Marketing</p>
            <p className="text-xs" style={{ color: T.dim }}>Revisión de material</p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-center py-6" style={{ color: T.dim }}>Cargando…</p>
        ) : error || !task ? (
          <p className="text-sm text-center py-6" style={{ color: T.rose }}>{error || "No se encontró este pendiente. Puede que ya no exista, o que este enlace se abra desde otra computadora distinta a la que lo generó."}</p>
        ) : enviado ? (
          <div>
            <div className="text-center py-4">
              {enviado === "aprobado" ? <CheckCircle2 size={32} color={T.teal} className="mx-auto mb-3" /> : <X size={32} color={T.rose} className="mx-auto mb-3" />}
              <p className="text-sm font-medium" style={{ color: T.text }}>
                {enviado === "aprobado" ? "Aprobado." : "Marcado para corrección."}
              </p>
              <p className="text-xs mt-1" style={{ color: T.dim }}>
                Decisión de <b>{task.revisadoPorNombre}</b> · {task.revisadoEn ? new Date(task.revisadoEn).toLocaleString("es-PE") : ""}
              </p>
              {task.comentarioRevision && <p className="text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: T.panelAlt, color: T.text }}>"{task.comentarioRevision}"</p>}
              <p className="text-[11px] mt-3" style={{ color: "#94A3B8" }}>Este enlace ya no permite cambiar la decisión.</p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold mb-1" style={{ color: T.dim }}>{deptMeta(task.departamento).label}</p>
            <p className="text-base font-semibold mb-2" style={{ color: T.text }}>{task.titulo}</p>
            {task.descripcion && <p className="text-sm mb-3" style={{ color: T.dim }}>{task.descripcion}</p>}
            <div className="flex items-center gap-3 text-xs mb-4" style={{ color: "#94A3B8" }}>
              {task.responsables?.length > 0 && <span className="flex items-center gap-1"><User size={12} />{task.responsables.join(", ")}</span>}
              {task.fecha && <span className="flex items-center gap-1"><Calendar size={12} />{task.fecha}</span>}
            </div>

            {/* Material para revisar */}
            <div className="rounded-xl p-4 mb-4" style={{ background: T.panelAlt, border: `1px solid ${T.border}` }}>
              <p className="text-xs font-semibold mb-3" style={{ color: T.dim }}>MATERIAL PARA REVISAR</p>

              {task.archivoRevision ? (
                <div className="mb-3">
                  {task.archivoRevision.dataUrl && task.archivoRevision.tipo?.startsWith("image/") && (
                    <img src={task.archivoRevision.dataUrl} alt={task.archivoRevision.nombre} className="w-full rounded-lg mb-2" style={{ maxHeight: 280, objectFit: "contain", background: "#000" }} />
                  )}
                  {task.archivoRevision.dataUrl && task.archivoRevision.tipo?.startsWith("video/") && (
                    <video src={task.archivoRevision.dataUrl} controls className="w-full rounded-lg mb-2" style={{ maxHeight: 280 }} />
                  )}
                  {task.archivoRevision.enlaceExterno && (
                    <a href={task.archivoRevision.enlaceExterno} target="_blank" rel="noreferrer" className="text-xs font-medium flex items-center gap-1 mb-2" style={{ color: T.blue }}>
                      <Link2 size={12} /> Ver material en enlace externo
                    </a>
                  )}
                  <p className="text-[11px]" style={{ color: "#94A3B8" }}>Subido por {task.archivoRevision.subidoPor} · {new Date(task.archivoRevision.subidoEn).toLocaleString("es-PE")}</p>
                  <button onClick={() => setSubiendo(true)} className="text-[11px] font-medium mt-1" style={{ color: T.blue }}>Reemplazar material</button>
                </div>
              ) : (
                <p className="text-xs mb-3" style={{ color: "#94A3B8" }}>Todavía no se subió nada. Adjunta una imagen, video, o pega el enlace donde está el material.</p>
              )}

              {(subiendo || !task.archivoRevision) && (
                <div className="flex flex-col gap-2">
                  {errorArchivo && <div className="text-xs px-3 py-2 rounded-lg" style={{ background: T.rose + "1F", color: T.rose }}>{errorArchivo}</div>}
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/jpg,video/mp4" className="hidden" onChange={(e) => onArchivoSeleccionado(e.target.files?.[0])} />
                  <button onClick={() => fileInputRef.current?.click()} className="text-xs font-medium py-2 rounded-lg flex items-center justify-center gap-1.5" style={{ background: T.panel, color: T.blue, border: `1px dashed ${T.blue}55` }}>
                    <Upload size={13} /> {archivoTemp ? archivoTemp.nombre : "Elegir imagen (JPG/PNG) o video (MP4)"}
                  </button>
                  <p className="text-[10px] text-center" style={{ color: "#94A3B8" }}>— o —</p>
                  <input type="text" placeholder="Pega un enlace (Drive, Instagram, WeTransfer…)" value={enlaceExterno} onChange={(e) => setEnlaceExterno(e.target.value)} />
                  <input type="text" placeholder="Tu nombre (quién sube esto)" value={subidoPor} onChange={(e) => setSubidoPor(e.target.value)} />
                  <button onClick={guardarMaterial} disabled={subiendo} className="text-xs font-medium py-2 rounded-lg text-white" style={{ background: T.blue }}>
                    {subiendo ? "Guardando…" : "Guardar material"}
                  </button>
                </div>
              )}
            </div>

            {/* Decisión */}
            <div className="rounded-xl p-4" style={{ background: T.panelAlt, border: `1px solid ${T.border}` }}>
              <p className="text-xs font-semibold mb-3" style={{ color: T.dim }}>TU DECISIÓN</p>
              {errorDecision && <div className="mb-2 text-xs px-3 py-2 rounded-lg" style={{ background: T.rose + "1F", color: T.rose }}>{errorDecision}</div>}

              <input type="text" placeholder="Tu nombre (quién aprueba o rechaza)" value={nombreRevisor} onChange={(e) => setNombreRevisor(e.target.value)} className="mb-2" />
              <textarea rows={2} className="resize-none mb-2" placeholder="Comentario (opcional)" value={comentario} onChange={(e) => setComentario(e.target.value)} />

              <div className="flex gap-2">
                <button
                  onClick={() => setDecision("rechazado")}
                  className="flex-1 py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-1.5"
                  style={{ background: decision === "rechazado" ? T.rose : T.panel, color: decision === "rechazado" ? "#FFF" : T.rose, border: `1px solid ${T.rose}55` }}
                >
                  <X size={14} /> Necesita corrección
                </button>
                <button
                  onClick={() => setDecision("aprobado")}
                  className="flex-1 py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-1.5"
                  style={{ background: decision === "aprobado" ? T.teal : T.panel, color: decision === "aprobado" ? "#FFF" : T.teal, border: `1px solid ${T.teal}55` }}
                >
                  <CheckCircle2 size={14} /> Aprobado
                </button>
              </div>

              <button
                onClick={confirmarDecision}
                disabled={!decision || enviando}
                className="w-full mt-3 py-2.5 rounded-lg font-medium text-sm text-white"
                style={{ background: decision ? T.blue : T.panel, opacity: decision ? 1 : 0.5, cursor: decision ? "pointer" : "not-allowed" }}
              >
                {enviando ? "Guardando…" : "Confirmar decisión (una sola vez)"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  // Se vuelve a evaluar el hash en cada cambio, para que un enlace de #ticket o #revisar-
  // funcione también si se pega en una pestaña que ya tenía la app abierta (no solo al abrir una nueva).
  const [hash, setHash] = useState(typeof window !== "undefined" ? window.location.hash : "");
  const [showIntro, setShowIntro] = useState(true);
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (hash === "#ticket") return <TicketOnlyView />;
  const revisarMatch = hash.match(/^#revisar-(.+)$/);
  if (revisarMatch) return <RevisionPublica taskId={revisarMatch[1]} />;
  if (showIntro) return <IntroSplash onFinish={() => setShowIntro(false)} />;
  return <LoginGate />;
}
