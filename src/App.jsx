import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Plus, X, Trash2, Calendar, User, Flag, LayoutGrid, CheckCircle2, AlertTriangle,
  TrendingUp, Upload, FileSpreadsheet, Check, Users, CircleDollarSign, Target,
  ChevronDown, MessageSquare, ShoppingBag, Megaphone, ClipboardList, ImagePlus,
  ChevronLeft, ChevronRight, CalendarDays, Paperclip, Pencil, Download, BookOpen,
  PenTool, FolderOpen, Link2, Copy, ExternalLink, Eraser, Eye
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import Papa from "papaparse";

const uid = () => "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
const normalize = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const localISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const nowStamp = () => new Date().toISOString();

// Vuelve a leer el dato COMPARTIDO más reciente justo antes de escribir, en vez de confiar
// en el estado local (que puede estar desactualizado si otra persona guardó algo mientras tanto).
// Esto evita que una carga inicial lenta/fallida termine borrando datos de otros al agregar algo nuevo.
async function mutateShared(key, shared, mutatorFn) {
  let current = [];
  try {
    const res = await window.storage.get(key, shared);
    current = res ? JSON.parse(res.value) : [];
  } catch (e) {
    current = [];
  }
  const next = mutatorFn(current);
  const res = await window.storage.set(key, JSON.stringify(next), shared);
  return { next, ok: !!res };
}

const fmtSoles = (n) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 0 }).format(n || 0);
const fmtNum = (n) => new Intl.NumberFormat("es-PE").format(Math.round(n || 0));

/* ---------------------------------- THEME ---------------------------------- */
const T = {
  bg: "#F5F8FC",
  panel: "#FFFFFF",
  panelAlt: "#F0F4FA",
  border: "#E2E8F0",
  text: "#0F172A",
  dim: "#64748B",
  blue: "#1E63F0",
  blueDark: "#0B3FA0",
  teal: "#0E9F8E",
  amber: "#D97706",
  rose: "#DC2626",
  purple: "#7C3AED",
};

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

function IntroSplash({ onFinish }) {
  useEffect(() => {
    const t = setTimeout(onFinish, 2200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${T.blueDark}, ${T.blue})`, zIndex: 9999 }} onClick={onFinish}>
      <style>{`
        @keyframes lbDotIn { 0% { opacity: 0; transform: scale(0) translateY(14px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes lbFadeOut { 0% { opacity: 1; } 100% { opacity: 0; } }
        .lb-dot-anim { opacity: 0; animation: lbDotIn 0.5s cubic-bezier(.34,1.56,.64,1) forwards; transform-origin: center; transform-box: fill-box; }
        .lb-splash-wrap { animation: lbFadeOut 0.4s ease-in forwards; animation-delay: 1.8s; }
      `}</style>
      <div className="lb-splash-wrap flex flex-col items-center">
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
  { id: "productor_audiovisual", label: "Productor Audiovisual", color: "#0891B2", acceso: "area", area: "productor_audiovisual" },
  { id: "disenador", label: "Diseñador", color: T.amber, acceso: "area", area: "diseno" },
  { id: "paid_media", label: "Paid Media", color: "#EC4899", acceso: "area_ads", area: "paid_media" },
  { id: "otros", label: "Otros", color: T.dim, acceso: "minimo" },
  { id: "visitante", label: "Visitante", color: "#94A3B8", acceso: "dashboard_pendientes" },
];
const cargoMeta = (id) => CARGOS.find((c) => c.id === id) || CARGOS[CARGOS.length - 1];


const DEPARTAMENTOS = [
  { id: "gerencia", label: "Gerencia", color: T.purple },
  { id: "coordinacion", label: "Coordinación", color: T.blue },
  { id: "diseno", label: "Diseño Gráfico", color: T.amber },
  { id: "edicion_audiovisual", label: "Edición Audiovisual", color: T.teal },
  { id: "productor_audiovisual", label: "Productor Audiovisual", color: "#0891B2" },
  { id: "paid_media", label: "Paid Media", color: "#EC4899" },
];

const COLUMNS = [
  { id: "todo", label: "Por hacer", color: T.blue },
  { id: "doing", label: "En curso", color: T.amber },
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

const makeEmptyTaskForm = (dept) => ({ titulo: "", descripcion: "", responsables: [], fechaInicio: localISO(), fecha: "", prioridad: "media", departamento: dept, esEmergencia: false, sustentoEmergencia: "", solicitadoPor: "", firmaSolicitante: null });
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

function PendientesPanel({ initialDept, permisos }) {
  const [tasks, setTasks] = useState(null);
  const [tickets, setTickets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeDept, setActiveDept] = useState(initialDept || "bandeja");
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

  const esTotal = !permisos || permisos.acceso === "total";
  const tabsVisibles = esTotal
    ? TABS_PENDIENTES
    : permisos.acceso === "minimo"
    ? TABS_PENDIENTES.filter((d) => d.id === "bandeja")
    : TABS_PENDIENTES.filter((d) => d.id === permisos.area);

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
      prioridad: task.prioridad || "media", departamento: task.departamento,
      esEmergencia: task.esEmergencia || false, sustentoEmergencia: task.sustentoEmergencia || "",
      solicitadoPor: task.solicitadoPor || "", firmaSolicitante: task.firmaSolicitante || null,
    });
    setEditingId(task.id);
    setResponsableInput("");
    setFormError(null);
    setShowForm(true);
  };

  const moveTask = async (id, estado) => {
    const { next, ok } = await mutateShared("marketing-tasks-v2", true, (current) =>
      current.map((t) => (t.id === id ? { ...t, estado, estadoActualizadoEn: nowStamp() } : t))
    );
    setTasks(next);
    if (!ok) setSaveError("No se pudo guardar en el servidor. Intenta de nuevo.");
  };
  const removeTask = async (id) => {
    const { next, ok } = await mutateShared("marketing-tasks-v2", true, (current) => current.filter((t) => t.id !== id));
    setTasks(next);
    if (!ok) setSaveError("No se pudo guardar en el servidor. Intenta de nuevo.");
  };
  const onDrop = (colId) => { if (dragId) moveTask(dragId, colId); setDragId(null); setDragOverCol(null); };
  const isOverdue = (fecha, estado) => estado !== "done" && estado !== "suspendido" && fecha && new Date(fecha) < new Date(new Date().toDateString());
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
        <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: T.rose, border: `1px solid ${T.rose}33` }}>
          {saveError}
        </div>
      )}

      {showForm && activeDept === "bandeja" && (
        <div className="rounded-xl p-5 mb-6" style={{ background: T.panel, border: `1px solid ${T.rose}55`, boxShadow: "0 1px 3px rgba(15,23,42,0.06)" }}>
          <h3 className="disp text-sm font-semibold mb-1" style={{ color: T.text }}>Reportar un pendiente de otra área</h3>
          <p className="text-xs mb-4" style={{ color: "#94A3B8" }}>Este ticket no tiene fecha de finalización — el equipo de Marketing lo asignará luego a la persona y semana que corresponda.</p>
          {formError && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: T.rose, border: `1px solid ${T.rose}33` }}>{formError}</div>}
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
            <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: T.rose, border: `1px solid ${T.rose}33` }}>{formError}</div>
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
          </div>

          <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${T.border}` }}>
            <label className="flex items-center gap-2 text-xs" style={{ color: T.rose }}>
              <input type="checkbox" className="w-auto" checked={form.esEmergencia} onChange={(e) => setForm({ ...form, esEmergencia: e.target.checked })} />
              <AlertTriangle size={13} /> Marcar como pendiente de EMERGENCIA (interrumpe el flujo del día a día)
            </label>
            {form.esEmergencia && (
              <div className="mt-3 p-3 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-3" style={{ background: "#FEF2F2", border: `1px solid ${T.rose}33` }}>
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

      {/* Pestañas: Bandeja de tickets + áreas (filtradas por permiso de cargo) */}
      <div className="flex items-center gap-1 mb-5 border-b overflow-x-auto" style={{ borderColor: T.border }}>
        {tabsVisibles.map((d) => {
          const isBandeja = d.id === "bandeja";
          const k = isBandeja ? { total: (tickets || []).length, overdue: 0 } : (kpisByDept[d.id] || { total: 0, overdue: 0 });
          const active = activeDept === d.id;
          return (
            <button key={d.id} onClick={() => setActiveDept(d.id)} className="relative px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap" style={{ color: active ? d.color : T.dim }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: d.color }} />
              {d.label}
              {k.total > 0 && (
                <span className="mono text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: active ? d.color + "1A" : T.panelAlt, color: active ? d.color : T.dim }}>{k.total}</span>
              )}
              {k.overdue > 0 && <span className="w-1.5 h-1.5 rounded-full" style={{ background: T.rose }} title={`${k.overdue} vencida(s)`} />}
              {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 rounded-full" style={{ background: d.color }} />}
            </button>
          );
        })}
      </div>

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = deptTasks.filter((t) => t.estado === col.id);
            return (
              <div key={col.id} onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.id); }} onDragLeave={() => setDragOverCol(null)} onDrop={() => onDrop(col.id)}
                className="rounded-xl p-3 min-h-[360px] transition-colors" style={{ background: dragOverCol === col.id ? T.panelAlt : T.panel, border: `1px solid ${dragOverCol === col.id ? col.color : T.border}` }}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: T.dim }}>{col.label}</span>
                  </div>
                  <span className="mono text-xs" style={{ color: T.dim }}>{colTasks.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {colTasks.length === 0 && <div className="text-xs text-center py-8 rounded-lg" style={{ color: "#94A3B8", border: `1px dashed ${T.border}` }}>Sin tareas</div>}
                  {colTasks.map((t) => {
                    const pMeta = priorityMeta(t.prioridad);
                    const overdue = isOverdue(t.fecha, t.estado);
                    return (
                      <div key={t.id} draggable onDragStart={() => setDragId(t.id)} className="task-card rounded-lg p-3 group" style={{ background: T.panel, border: `1px solid ${T.border}`, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <button onClick={() => startEdit(t)} className="text-left flex-1">
                            <p className="text-sm font-medium leading-snug hover:underline" style={{ color: T.text }}>{t.titulo}</p>
                          </button>
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button onClick={() => startEdit(t)} title="Editar"><Pencil size={12} color={T.dim} /></button>
                            <button onClick={() => removeTask(t.id)} title="Eliminar"><Trash2 size={13} color={T.rose} /></button>
                          </div>
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
                        </div>
                        <div className="flex items-center justify-between text-[11px]" style={{ color: overdue ? T.rose : T.dim }}>
                          <span className="flex items-center gap-1 flex-wrap">{t.responsables?.length > 0 && (<><User size={11} />{t.responsables.join(", ")}</>)}</span>
                          {(t.fechaInicio || t.fecha) && (
                            <span className="flex items-center gap-1 mono">
                              <Calendar size={11} />
                              {t.fechaInicio ? t.fechaInicio.slice(5) : ""}{t.fechaInicio && t.fecha ? " → " : ""}{t.fecha ? t.fecha.slice(5) : ""}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1 mt-2 pt-2" style={{ borderTop: `1px solid ${T.border}` }}>
                          {COLUMNS.filter((c) => c.id !== col.id).map((c) => (
                            <button key={c.id} onClick={() => moveTask(t.id, c.id)} className="text-[10px] px-2 py-1 rounded font-medium flex-1 hover:opacity-80 transition-opacity" style={{ background: T.panelAlt, color: c.color }}>
                              → {c.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
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

function AdsMetaSection({ data, loading, importError, setImportError, onFile, thumbnails, onUploadThumbnail }) {
  const fileInputRef = useRef(null);
  const allRows = data?.rows || [];
  const etiqueta = data?.etiqueta || "Anuncio";
  const [sedeFiltro, setSedeFiltro] = useState("todas");

  const sedesDisponibles = useMemo(() => {
    const codes = new Set();
    allRows.forEach((r) => {
      const code = (r.conjunto || "").trim().toUpperCase();
      if (SEDES[code]) codes.add(code);
    });
    return Array.from(codes);
  }, [allRows]);

  const rows = useMemo(() => {
    if (sedeFiltro === "todas") return allRows;
    if (sedeFiltro === "otras") return allRows.filter((r) => !SEDES[(r.conjunto || "").trim().toUpperCase()]);
    return allRows.filter((r) => (r.conjunto || "").trim().toUpperCase() === sedeFiltro);
  }, [allRows, sedeFiltro]);

  const totals = useMemo(() => {
    const gasto = rows.reduce((a, r) => a + r.gasto, 0);
    const nuevosContactos = rows.reduce((a, r) => a + r.nuevosContactos, 0);
    const contactosTotales = rows.reduce((a, r) => a + r.contactosTotales, 0);
    const compras = rows.reduce((a, r) => a + r.compras, 0);
    const msgRows = rows.filter((r) => normalize(r.indicador).includes("messaging_conversation_started"));
    const conversaciones = msgRows.reduce((a, r) => a + r.resultados, 0);
    const gastoConversaciones = msgRows.reduce((a, r) => a + r.gasto, 0);
    const costoPorConversacion = conversaciones ? gastoConversaciones / conversaciones : 0;
    return { gasto, nuevosContactos, contactosTotales, compras, conversaciones, costoPorConversacion };
  }, [rows]);

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
        {sedesDisponibles.length > 0 && (
          <select value={sedeFiltro} onChange={(e) => setSedeFiltro(e.target.value)} className="text-xs">
            <option value="todas">Todas las sedes</option>
            {sedesDisponibles.map((code) => <option key={code} value={code}>{SEDES[code]} ({code})</option>)}
            <option value="otras">Sin sede identificada</option>
          </select>
        )}
      </div>

      {importError && (
        <div className="mb-4 text-xs px-3 py-2 rounded-lg flex items-center justify-between" style={{ background: "#FEF2F2", color: T.rose, border: `1px solid ${T.rose}33` }}>
          {importError}
          <button onClick={() => setImportError(null)}><X size={14} /></button>
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
              Último archivo: <span className="mono" style={{ color: T.dim }}>{data.lastFileName}</span> · {new Date(data.lastImportedAt).toLocaleString("es-PE")} · <span className="mono">{allRows.length}</span> filas (datos del último archivo subido)
            </p>
            {data.history?.length > 1 && (
              <details className="text-xs">
                <summary className="cursor-pointer select-none" style={{ color: T.blue }}>Ver historial de subidas ({data.history.length})</summary>
                <ul className="mt-2 space-y-1">
                  {data.history.map((h, i) => (
                    <li key={i} className="mono" style={{ color: "#94A3B8" }}>
                      {new Date(h.importedAt).toLocaleString("es-PE")} — {h.fileName} ({h.rowCount} filas)
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard icon={<CircleDollarSign size={16} />} label="Inversión total" value={fmtSoles(totals.gasto)} color={T.blue} />
            <StatCard icon={<MessageSquare size={16} />} label="Conversaciones iniciadas" value={fmtNum(totals.conversaciones)} color={T.purple} />
            <StatCard icon={<Target size={16} />} label="Costo por conversación" value={fmtSoles(totals.costoPorConversacion)} color={T.amber} />
            <StatCard icon={<Users size={16} />} label="Nuevos contactos" value={fmtNum(totals.nuevosContactos)} color={T.teal} />
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
                    <Tooltip contentStyle={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} />
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
                    <Tooltip contentStyle={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} />
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

      {saveError && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: T.rose }}>{saveError}</div>}

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
  const [thumbnails, setThumbnails] = useState({});

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
  }, []);

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
              clics: map.clics ? parseFloat(r[map.clics]) || 0 : 0,
              contactosTotales: map.contactosTotales ? parseFloat(r[map.contactosTotales]) || 0 : 0,
              nuevosContactos: map.nuevosContactos ? parseFloat(r[map.nuevosContactos]) || 0 : 0,
              compras: map.compras ? parseFloat(r[map.compras]) || 0 : 0,
            }));
          if (!newRows.length) {
            setImportError("El archivo no tiene filas reconocibles.");
            return;
          }

          // Cada archivo nuevo REEMPLAZA los datos (el CSV de Meta ya trae el acumulado
          // completo del rango que exportaste), así no se duplican ni se suman de más.
          // Solo se conserva el historial de cuándo subiste cada archivo, como registro.
          const prevHistory = data?.history || [];
          const history = [{ fileName: file.name, importedAt: nowStamp(), rowCount: newRows.length }, ...prevHistory].slice(0, 30);

          persist({ rows: newRows, history, lastFileName: file.name, lastImportedAt: nowStamp(), etiqueta: nivelInfo.etiqueta, etiquetaPlural: nivelInfo.etiquetaPlural });
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
        onFile={handleFile}
        thumbnails={thumbnails}
        onUploadThumbnail={uploadThumbnail}
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
const emptyContenidoForm = { titulo: "", descripcion: "", area: "diseno", responsables: [] };

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

      {saveError && <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: T.rose, border: `1px solid ${T.rose}33` }}>{saveError}</div>}

      {showForm && (
        <div className="rounded-xl p-5 mb-6" style={{ background: T.panel, border: `1px solid ${T.blue}55` }}>
          <h3 className="disp text-sm font-semibold mb-4" style={{ color: T.text }}>Nueva pieza de contenido</h3>
          {formError && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: T.rose }}>{formError}</div>}
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
                <option value="productor_audiovisual">Productor Audiovisual</option>
              </select>
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
                  {enEtapa.map((item) => (
                    <div key={item.id} className="rounded-lg p-3" style={{ background: T.panelAlt, border: `1px solid ${T.border}` }}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-medium" style={{ color: T.text }}>{item.titulo}</p>
                        <button onClick={() => eliminar(item.id)}><Trash2 size={12} color={T.rose} /></button>
                      </div>
                      {item.descripcion && <p className="text-xs mb-1.5" style={{ color: T.dim }}>{item.descripcion}</p>}
                      <p className="text-[10px] mb-2" style={{ color: "#94A3B8" }}>{deptMeta(item.area).label}{item.responsables?.length > 0 && ` · ${item.responsables.join(", ")}`}</p>
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
                  ))}
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

      {saveError && <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: T.rose }}>{saveError}</div>}

      {showForm && (
        <div className="rounded-xl p-5 mb-6" style={{ background: T.panel, border: `1px solid ${T.blue}55` }}>
          <h3 className="disp text-sm font-semibold mb-4" style={{ color: T.text }}>Nuevo proyecto</h3>
          {formError && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: T.rose }}>{formError}</div>}
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

      {saveError && <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: T.rose, border: `1px solid ${T.rose}33` }}>{saveError}</div>}

      {showForm && (
        <div className="rounded-xl p-5 mb-6" style={{ background: T.panel, border: `1px solid ${T.blue}55` }}>
          <h3 className="disp text-sm font-semibold mb-4" style={{ color: T.text }}>Nuevo evento</h3>
          {formError && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: T.rose, border: `1px solid ${T.rose}33` }}>{formError}</div>}
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
          background: #FFFFFF; border: 1px solid ${T.border}; color: ${T.text};
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
            {error && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: T.rose, border: `1px solid ${T.rose}33` }}>{error}</div>}
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
      {saveError && <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: T.rose, border: `1px solid ${T.rose}33` }}>{saveError}</div>}

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
      {saveError && <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: T.rose, border: `1px solid ${T.rose}33` }}>{saveError}</div>}

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
        <button onClick={() => { setForm(emptyCredencialForm); setFormError(null); setShowForm((s) => !s); }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: showForm ? T.dim : T.text }}>
          {showForm ? "Cancelar" : <><Plus size={16} strokeWidth={2.5} /> Guardar acceso</>}
        </button>
      </div>

      <div className="mb-4 text-xs px-3 py-2 rounded-lg flex items-start gap-2" style={{ background: T.amber + "14", color: "#92620A", border: `1px solid ${T.amber}33` }}>
        <AlertTriangle size={13} className="shrink-0 mt-0.5" />
        <span>Solo Gerencia y Coordinación pueden ver esta sección. Aun así, no es un gestor de contraseñas con cifrado real — evita guardar aquí accesos bancarios u otros extremadamente sensibles.</span>
      </div>

      {saveError && <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: T.rose }}>{saveError}</div>}

      {showForm && (
        <div className="rounded-xl p-5 mb-5" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
          <h3 className="disp text-sm font-semibold mb-4" style={{ color: T.text }}>Guardar acceso</h3>
          {formError && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: T.rose }}>{formError}</div>}
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
            <button type="button" onClick={crear} className="flex-1 py-2.5 rounded-lg font-medium text-sm text-white" style={{ background: T.text }}>Guardar</button>
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
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: T.text + "0F", color: T.text }}>{c.redSocial}</span>
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
      {saveError && <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: T.rose, border: `1px solid ${T.rose}33` }}>{saveError}</div>}

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
          <button onClick={() => setVista("informes")} className="rounded-xl p-5 flex items-center gap-4 text-left transition-transform hover:scale-[1.01]" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: T.teal }}>
              <LimablueDots color="#FFFFFF" size={26} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: T.text }}>Informes de Avance</p>
              <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>Sigue el progreso de proyectos con terceros, paso a paso</p>
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
              <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: T.text }}>
                <LimablueDots color="#FFFFFF" size={26} />
              </div>
              <div>
                <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: T.text }}>Cuentas y Contraseñas <Eye size={12} color="#94A3B8" /></p>
                <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>Redes sociales, usuarios y números anexados — solo Gerencia y Coordinación</p>
              </div>
            </button>
          )}
        </div>
      )}

      {vista === "informes" && <InformesPanel onBack={() => setVista("inicio")} />}
      {vista === "conflictos" && <ConflictosPanel onBack={() => setVista("inicio")} />}
      {vista === "reportesDiarios" && <ReportesDiariosPanel onBack={() => setVista("inicio")} />}
      {vista === "credenciales" && permisos?.acceso === "total" && <CredencialesPanel onBack={() => setVista("inicio")} />}

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
          background: #FFFFFF; border: 1px solid ${T.border}; color: ${T.text};
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

  const variante = cargo.acceso === "total" ? "bounce" : cargo.acceso === "area" || cargo.acceso === "area_ads" ? "slide" : "fade";

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
  const [mes, setMes] = useState(() => localISO().slice(0, 7)); // YYYY-MM
  const [tasks, setTasks] = useState(null);
  const [adsData, setAdsData] = useState(null);
  const [informes, setInformes] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r1 = await window.storage.get("marketing-tasks-v2", true);
        setTasks(r1 ? JSON.parse(r1.value) : []);
      } catch (e) { setTasks([]); }
      try {
        const r2 = await window.storage.get("ads-performance", true);
        setAdsData(r2 ? JSON.parse(r2.value) : null);
      } catch (e) { setAdsData(null); }
      try {
        const r3 = await window.storage.get("informes-avance", true);
        setInformes(r3 ? JSON.parse(r3.value) : []);
      } catch (e) { setInformes([]); }
      setLoading(false);
    })();
  }, []);

  const enMes = (stamp) => stamp && localISO(new Date(stamp)).slice(0, 7) === mes;

  const resumenTareas = useMemo(() => {
    const delMes = (tasks || []).filter((t) => enMes(t.creado));
    return {
      total: delMes.length,
      listos: delMes.filter((t) => t.estado === "done").length,
      noListos: delMes.filter((t) => t.estado === "todo" || t.estado === "doing").length,
      suspendidos: delMes.filter((t) => t.estado === "suspendido").length,
      emergencias: delMes.filter((t) => t.esEmergencia),
      porArea: DEPARTAMENTOS.filter((d) => d.id !== "bandeja").map((d) => ({
        area: d,
        total: delMes.filter((t) => t.departamento === d.id).length,
        listos: delMes.filter((t) => t.departamento === d.id && t.estado === "done").length,
      })),
    };
  }, [tasks, mes]);

  const resumenAds = useMemo(() => {
    const rows = (adsData?.rows || []).filter((r) => (r.fecha || "").slice(0, 7) === mes);
    const gasto = rows.reduce((a, r) => a + r.gasto, 0);
    const msgRows = rows.filter((r) => normalize(r.indicador).includes("messaging_conversation_started"));
    const conversaciones = msgRows.reduce((a, r) => a + r.resultados, 0);
    const gastoConv = msgRows.reduce((a, r) => a + r.gasto, 0);
    return { gasto, conversaciones, costoPorConversacion: conversaciones ? gastoConv / conversaciones : 0, filas: rows.length };
  }, [adsData, mes]);

  const informesDelMes = useMemo(() => (informes || []).filter((i) => enMes(i.creado)), [informes, mes]);
  const informesPorNivel = useMemo(() => {
    return NIVELES_IMPORTANCIA.map((n) => ({ nivel: n, count: informesDelMes.filter((i) => i.nivelImportancia === n.id).length }));
  }, [informesDelMes]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <p className="text-sm" style={{ color: T.dim }}>Resumen del mes — listo para el sustento de fin de mes.</p>
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: T.dim }}>Cargando…</p>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Pendientes */}
          <div>
            <h3 className="disp text-sm font-semibold mb-3" style={{ color: T.text }}>Pendientes del mes</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <StatCard icon={<ClipboardList size={16} />} label="Total registrados" value={resumenTareas.total} color={T.blue} />
              <StatCard icon={<CheckCircle2 size={16} />} label="Listos" value={resumenTareas.listos} color={T.teal} />
              <StatCard icon={<AlertTriangle size={16} />} label="No listos" value={resumenTareas.noListos} color={T.amber} />
              <StatCard icon={<X size={16} />} label="Suspendidos" value={resumenTareas.suspendidos} color={T.rose} />
            </div>
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
          </div>

          {/* Emergencias */}
          <div>
            <h3 className="disp text-sm font-semibold mb-3" style={{ color: T.text }}>Pendientes de emergencia ({resumenTareas.emergencias.length})</h3>
            {resumenTareas.emergencias.length === 0 ? (
              <p className="text-xs" style={{ color: "#94A3B8" }}>No hubo pendientes de emergencia este mes.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {resumenTareas.emergencias.map((t) => (
                  <div key={t.id} className="rounded-lg p-3" style={{ background: "#FEF2F2", border: `1px solid ${T.rose}33` }}>
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
            <h3 className="disp text-sm font-semibold mb-3" style={{ color: T.text }}>Meta Ads del mes</h3>
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

          {/* Informes */}
          <div>
            <h3 className="disp text-sm font-semibold mb-3" style={{ color: T.text }}>Informes del mes por nivel de importancia</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {informesPorNivel.map(({ nivel, count }) => (
                <div key={nivel.id} className="rounded-xl p-4" style={{ background: T.panel, border: `1px solid ${T.border}` }}>
                  <p className="text-xs font-medium mb-1" style={{ color: nivel.color }}>{nivel.label}</p>
                  <p className="disp text-xl font-semibold mono" style={{ color: T.text }}>{count}</p>
                </div>
              ))}
            </div>
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
        {error && <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: T.rose }}>{error}</div>}

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

function MainApp({ session, onLogout }) {
  const cargo = cargoMeta(session.cargo);
  const totalAcceso = cargo.acceso === "total";
  const tabsPermitidas = totalAcceso
    ? ["pendientes", "produccion", "proyectos", "ads", "calendario", "biblioteca", "dashboard"]
    : cargo.acceso === "area_ads"
    ? ["pendientes", "ads", "calendario", "biblioteca"]
    : cargo.acceso === "area"
    ? ["pendientes", "produccion", "calendario", "biblioteca"]
    : ["pendientes"]; // minimo (otros)

  const [mainTab, setMainTab] = useState("pendientes");
  const [showEquipo, setShowEquipo] = useState(false);
  const isTicketHash = typeof window !== "undefined" && window.location.hash === "#ticket";
  const [initialDept] = useState(() => (isTicketHash ? "bandeja" : (cargo.acceso === "area" || cargo.acceso === "area_ads" ? cargo.area : "gerencia")));

  const TABS_ALL = [
    { id: "pendientes", label: "GESTIÓN DE PENDIENTES" },
    { id: "produccion", label: "PRODUCCIÓN" },
    { id: "proyectos", label: "PROYECTOS" },
    { id: "ads", label: "GESTIÓN DE ADS" },
    { id: "calendario", label: "CALENDARIO" },
    { id: "biblioteca", label: "BIBLIOTECA" },
    { id: "dashboard", label: "DASHBOARD" },
  ];

  return (
    <div className="min-h-screen w-full" style={{ background: T.bg, fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
        .disp { font-family: 'Space Grotesk', sans-serif; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
        input, select, textarea {
          background: #FFFFFF; border: 1px solid ${T.border}; color: ${T.text};
          border-radius: 8px; padding: 8px 10px; font-size: 13px; outline: none; font-family: 'Inter', sans-serif;
        }
        input:focus, select:focus, textarea:focus { border-color: ${T.blue}; }
        ::placeholder { color: #94A3B8; }
        .task-card { cursor: grab; }
        .task-card:active { cursor: grabbing; }
      `}</style>

      <div className="max-w-6xl mx-auto px-6 py-8">
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

        <div className="flex items-center gap-1 mb-8 border-b" style={{ borderColor: T.border }}>
          {TABS_ALL.filter((t) => tabsPermitidas.includes(t.id)).map((tab) => (
            <button key={tab.id} onClick={() => setMainTab(tab.id)} className="relative px-5 py-3 text-sm font-semibold tracking-wide transition-colors" style={{ color: mainTab === tab.id ? T.blue : T.dim }}>
              {tab.label}
              {mainTab === tab.id && <span className="absolute left-0 right-0 -bottom-px h-0.5 rounded-full" style={{ background: T.blue }} />}
            </button>
          ))}
        </div>

        {mainTab === "pendientes" ? <PendientesPanel initialDept={initialDept} permisos={cargo} />
          : mainTab === "produccion" ? <ProduccionPanel permisos={cargo} />
          : mainTab === "proyectos" ? <ProyectosPanel />
          : mainTab === "ads" ? <AdsPanel />
          : mainTab === "calendario" ? <CalendarioPanel />
          : mainTab === "dashboard" ? <DashboardPanel />
          : <BibliotecaPanel permisos={cargo} />}
      </div>
    </div>
  );
}

export default function App() {
  const isTicketMode = typeof window !== "undefined" && window.location.hash === "#ticket";
  if (isTicketMode) return <TicketOnlyView />;
  const [showIntro, setShowIntro] = useState(true);
  if (showIntro) return <IntroSplash onFinish={() => setShowIntro(false)} />;
  return <LoginGate />;
}
