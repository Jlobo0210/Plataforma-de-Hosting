import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import { minutesSinceActivity } from "../services/mockData";

/**
 * ServiceDetail.jsx (ahora ProjectDetail)
 * Vista de detalle de un proyecto de hosting. Muestra:
 *  - URL asignada (nombreProyecto.nombreUsuario.localhost)
 *  - Información del repositorio y configuración
 *  - Métricas simuladas: CPU, Memoria
 *  - Control de Rate Limiting (solicitudes por minuto)
 *  - Estado de actividad y tiempo hasta auto-apagado
 */

// ── Componente de métrica circular ─────────────────────────
function GaugeBar({ label, value, max, unit, color }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const isHigh = pct > 80;
  const isMed  = pct > 50;

  const barColor = isHigh ? "bg-red-500" : isMed ? "bg-amber-500" : color;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-baseline text-xs">
        <span className="text-slate-400 font-medium">{label}</span>
        <span className={`font-mono font-bold ${isHigh ? "text-red-400" : isMed ? "text-amber-400" : "text-slate-200"}`}>
          {value}{unit} <span className="text-slate-600 font-normal">/ {max}{unit}</span>
        </span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-right text-[10px] text-slate-600 font-mono">{pct}%</div>
    </div>
  );
}

// ── Componente de métrica simple ────────────────────────────
function MetricItem({ icon, label, value, sub }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-800 last:border-0">
      <span className="text-base w-5 text-center">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-mono text-slate-200 truncate">{value}</p>
        {sub && <p className="text-[10px] text-slate-600">{sub}</p>}
      </div>
    </div>
  );
}

export default function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  // Edición de variables de entorno
  const [envContent, setEnvContent]   = useState("");
  const [envDirty, setEnvDirty]       = useState(false);
  const [envSaving, setEnvSaving]     = useState(false);
  const [envSaved, setEnvSaved]       = useState(false);
  const [envError, setEnvError]       = useState("");

  // Simula actualización de métricas en tiempo real
  const [metrics, setMetrics] = useState(null);
  const metricsInterval = useRef(null);

  useEffect(() => {
    api.getById(id)
      .then((p) => {
        setProject(p);
        setMetrics(p.metrics);
        setEnvContent(p.envContent || "");
      })
      .catch(() => setError("Proyecto no encontrado"))
      .finally(() => setLoading(false));
  }, [id]);

  // Polling de métricas reales cada 4 segundos
  useEffect(() => {
    if (!project || project.status !== "active") return;

    const pollMetrics = () => {
      api.getById(id)
        .then((p) => {
          setMetrics(p.metrics);
          setProject((prev) => prev ? {
            ...prev,
            status: p.status,
            enabled: p.enabled,
            lastActivity: p.lastActivity,
          } : p);
        })
        .catch((err) => console.error("Error cargando métricas:", err));
    };

    pollMetrics();
    metricsInterval.current = setInterval(pollMetrics, 4000);

    return () => clearInterval(metricsInterval.current);
  }, [id, project?.status]);

  const handleSaveEnv = async () => {
    setEnvSaving(true);
    setEnvSaved(false);
    setEnvError("");
    try {
      await api.updateEnv(project.id, envContent);
      setProject((p) => ({ ...p, envContent }));
      setEnvDirty(false);
      setEnvSaved(true);
      setTimeout(() => setEnvSaved(false), 3000);
    } catch (err) {
      console.error("❌ Error guardando variables:", err);
      setEnvError(err.message || "No se pudieron guardar las variables de entorno");
    } finally {
      setEnvSaving(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex items-center gap-3 text-slate-400">
        <svg className="w-5 h-5 animate-spin text-cyan-500" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
          <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        Cargando proyecto…
      </div>
    </div>
  );

  if (!project) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-red-400">
      {error || "Proyecto no encontrado"}
    </div>
  );

  const mins = minutesSinceActivity(project.lastActivity);
  const isActive = project.status === "active";
  const minsToSleep = Math.max(0, 30 - mins);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">

      {/* ── Header ────────────────────────────────────── */}
      <div className="border-b border-slate-800 px-8 py-5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>
          <div className="w-px h-5 bg-slate-700" />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-bold font-mono">{project.name}</h1>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded border
                  ${project.containerType === "compose"
                    ? "bg-violet-900/30 text-violet-300 border-violet-700/40"
                    : "bg-sky-900/30 text-sky-300 border-sky-700/40"
                  }`}>
                  {project.containerType === "compose" ? "📦 Compose" : "🐋 Dockerfile"}
                </span>
                {isActive && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded border bg-emerald-900/30 text-emerald-400 border-emerald-700/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Activo
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{project.assignedUrl}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Contenido ─────────────────────────────────── */}
      <div className="px-8 py-6 grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Col 1: Información del proyecto ─────────── */}
        <div className="lg:col-span-1 flex flex-col gap-5">

          {/* URL asignada */}
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-cyan-500 rounded-full" />
              <h2 className="text-sm font-semibold text-slate-200">URL del sitio</h2>
            </div>
            <div className="bg-slate-950 border border-slate-700/40 rounded-xl p-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <span className="text-xs font-mono text-cyan-400 break-all">{project.assignedUrl}</span>
            </div>
            <p className="text-xs text-slate-600 mt-2">
              Accesible localmente vía reverse proxy
            </p>
          </div>

          {/* Detalles de configuración */}
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 bg-slate-500 rounded-full" />
              <h2 className="text-sm font-semibold text-slate-200">Configuración</h2>
            </div>
            <MetricItem icon="🐙" label="Repositorio"
              value={project.githubUrl?.replace("https://github.com/", "") || "—"}
              sub={project.githubUrl}
            />
            <MetricItem icon="🔌" label="Puerto expuesto"
              value={`:${project.port}`}
            />
            <MetricItem icon="📅" label="Creado"
              value={new Date(project.createdAt).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
            />
          </div>

          {/* Actividad y auto-apagado */}
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 bg-amber-500 rounded-full" />
              <h2 className="text-sm font-semibold text-slate-200">Actividad</h2>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-500">Inactividad</span>
                  <span className={`font-mono font-semibold ${mins >= 25 ? "text-amber-400" : "text-slate-300"}`}>
                    {mins} min
                  </span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${mins >= 25 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${Math.min(100, (mins / 30) * 100)}%` }}
                  />
                </div>
                <p className="text-right text-[10px] text-slate-600 mt-0.5 font-mono">
                  {mins >= 30
                    ? "Auto-apagado activado"
                    : `Auto-apagado en ${minsToSleep} min`
                  }
                </p>
              </div>

              <div className="flex justify-between text-xs pt-1">
                <span className="text-slate-500">Última actividad</span>
                <span className="text-slate-400 font-mono">
                  {new Date(project.lastActivity).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Col 2-3: Métricas y Rate Limiting ───────── */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Métricas de recursos */}
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                <h2 className="text-sm font-semibold text-slate-200">Recursos del contenedor</h2>
              </div>
              {isActive && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  En vivo
                </span>
              )}
            </div>

            {!isActive ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-600 gap-2">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2}
                    d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                </svg>
                <p className="text-sm">Contenedor detenido · métricas no disponibles</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">CPU</p>
                  <GaugeBar
                    label="Uso de CPU"
                    value={metrics ? Math.round(metrics.cpuPercent * 10) / 10 : 0}
                    max={100}
                    unit="%"
                    color="bg-cyan-500"
                  />
                  <p className="text-xs text-slate-600 mt-2">
                    Límite: {metrics?.cpuLimitVcpu ?? 0.5} vCPU (--cpus={metrics?.cpuLimitVcpu ?? 0.5})
                  </p>
                </div>
                <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Memoria</p>
                  <GaugeBar
                    label="RAM usada"
                    value={metrics ? Math.round(metrics.memoryMB) : 0}
                    max={metrics?.memoryLimitMB || 256}
                    unit=" MB"
                    color="bg-violet-500"
                  />
                  <p className="text-xs text-slate-600 mt-2">Límite: {metrics?.memoryLimitMB || 256} MB (--memory)</p>
                </div>
              </div>
            )}
          </div>

          {/* Rate Limiting */}
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-1 h-4 bg-orange-500 rounded-full" />
              <h2 className="text-sm font-semibold text-slate-200">Rate Limiting</h2>
              <span className="text-xs text-slate-600 ml-auto">Ventana: 1 minuto</span>
            </div>

            {!isActive ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-600 gap-2">
                <p className="text-sm">Contenedor detenido · Rate limiter inactivo</p>
              </div>
            ) : (
              <div className="space-y-4">
                <GaugeBar
                  label="Solicitudes / minuto"
                  value={metrics ? Math.round(metrics.requestsPerMin) : 0}
                  max={metrics?.requestsLimitPerMin || 60}
                  unit=" req"
                  color="bg-orange-500"
                />

                <div className="grid grid-cols-3 gap-3 pt-2">
                  {[
                    { label: "Límite",    value: `${metrics?.requestsLimitPerMin || 60} req/min`, color: "text-slate-300" },
                    { label: "Actuales",  value: `${Math.round(metrics?.requestsPerMin || 0)} req/min`, color: metrics?.requestsPerMin > (metrics?.requestsLimitPerMin * 0.8) ? "text-red-400" : "text-emerald-400" },
                    { label: "Disponib.", value: `${Math.max(0, (metrics?.requestsLimitPerMin || 60) - Math.round(metrics?.requestsPerMin || 0))} req/min`, color: "text-slate-400" },
                  ].map((item) => (
                    <div key={item.label} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-slate-600 uppercase tracking-wider">{item.label}</p>
                      <p className={`text-xs font-mono font-bold mt-1 ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>

                {metrics?.requestsPerMin > (metrics?.requestsLimitPerMin * 0.8) && (
                  <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-900/20 border border-amber-800/40 rounded-lg px-3 py-2">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Cerca del límite de solicitudes. El backend retornará 429 al superarlo.
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* ── Variables de entorno (ancho completo) ───── */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-700/60 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-emerald-600 rounded-full" />
              <h2 className="text-sm font-semibold text-slate-200">Variables de entorno</h2>
              {envContent && (
                <span className="text-xs text-slate-600 font-mono">
                  {envContent.split("\n").filter((l) => l.trim() && !l.startsWith("#")).length} variable(s)
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {envSaved && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Guardado
                </span>
              )}
              <button
                onClick={handleSaveEnv}
                disabled={!envDirty || envSaving}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {envSaving ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                      <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Guardando…
                  </>
                ) : (
                  "Guardar cambios"
                )}
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-600 mb-3">
            Edita el contenido de tu <span className="font-mono">.env</span> directamente.{" "}
            {project.containerType === "compose"
              ? "El backend bajará y volverá a levantar el stack docker-compose con el nuevo .env."
              : "El backend lo re-inyectará al reconstruir y recrear el contenedor."}
          </p>

          <textarea
            value={envContent}
            onChange={(e) => {
              setEnvContent(e.target.value);
              setEnvDirty(true);
              setEnvSaved(false);
              setEnvError("");
            }}
            rows={8}
            spellCheck={false}
            placeholder={"NODE_ENV=production\nPORT=3000\nDB_URL=postgres://...\nSECRET_KEY=..."}
            className="w-full bg-slate-950 border border-slate-700/40 rounded-xl px-4 py-3 text-xs font-mono text-emerald-400 focus:outline-none focus:border-cyan-600 placeholder:text-slate-700 resize-y transition-colors leading-relaxed"
          />

          {envError && (
            <p className="text-xs text-red-400 mt-2 flex items-center gap-1.5">
              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {envError}
            </p>
          )}

          {envDirty && !envSaving && !envError && (
            <p className="text-xs text-amber-500 mt-2 flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Hay cambios sin guardar
            </p>
          )}
        </div>

      </div>
    </div>
  );
}