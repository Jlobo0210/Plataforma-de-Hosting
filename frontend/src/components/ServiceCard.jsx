import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { minutesSinceActivity } from "../services/mockData";

/**
 * ServiceCard.jsx (ahora ProjectCard)
 * Tarjeta de proyecto de hosting.
 * Muestra: nombre, URL de GitHub, URL asignada, tipo de contenedor,
 * puerto, estado y controles de encendido/apagado.
 */

function StatusBadge({ status, lastActivity }) {
  const mins = minutesSinceActivity(lastActivity);
  const isAboutToSleep = (status === "active" || status === "inactive") && mins >= 30;

  if (status === "building") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded border bg-amber-900/30 text-amber-300 border-amber-700/40">
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
          <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        Desplegando
      </span>
    );
  }
  if (status === "stopped") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded border bg-slate-800 text-slate-500 border-slate-700">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
        Apagado
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded border bg-red-900/30 text-red-300 border-red-700/40">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        Error
      </span>
    );
  }
  if (isAboutToSleep) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded border bg-amber-900/20 text-amber-400 border-amber-700/30"
        title={`Sin actividad hace ${mins} minutos`}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        Inactivo ({mins}m)
      </span>
    );
  }
  // Activo
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded border bg-emerald-900/30 text-emerald-400 border-emerald-700/40">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      Activo
    </span>
  );
}

export default function ServiceCard({ project, isDeleting = false, onDelete, onToggle }) {
  const [confirming, setConfirming] = useState(false);
  const navigate = useNavigate();

  const handleDelete = () => {
    if (isDeleting) return;
    if (confirming) {
      onDelete(project.id);
      setConfirming(false);
    } else {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
    }
  };

  const isBuilding = project.status === "building";
  const isStopped  = project.status === "stopped";
  const isError    = project.status === "error";
  const canToggle  = !isBuilding && !isError;

  // Badge de tipo de contenedor
  const containerBadge = project.containerType === "compose"
    ? { label: "Compose",    color: "bg-violet-900/30 text-violet-300 border-violet-700/40" }
    : { label: "Dockerfile", color: "bg-sky-900/30    text-sky-300    border-sky-700/40"    };

  return (
    <div className={`relative flex flex-col gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 transition-opacity
      ${isStopped || isDeleting ? "opacity-60" : ""}`}
    >
      {/* ── Top: badges + switch ────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${containerBadge.color}`}>
            {containerBadge.label}
          </span>
          <StatusBadge status={project.status} lastActivity={project.lastActivity} />
        </div>

        {/* Toggle encendido/apagado */}
        <button
          onClick={() => canToggle && !isDeleting && onToggle(project.id, !project.enabled)}
          disabled={!canToggle || isDeleting}
          title={project.enabled ? "Apagar contenedor" : "Encender contenedor"}
          className="relative inline-flex items-center w-11 h-6 rounded-full transition-colors duration-300 disabled:opacity-40 focus:outline-none shrink-0"
          style={{ backgroundColor: project.enabled && !isStopped ? "#10b981" : "#475569" }}
        >
          <span
            className="inline-block w-4 h-4 bg-white rounded-full shadow transition-transform duration-300"
            style={{ transform: project.enabled && !isStopped ? "translateX(22px)" : "translateX(4px)" }}
          />
        </button>
      </div>

      {/* ── Nombre del proyecto ──────────────────── */}
      <div>
        <p className="font-mono font-bold text-slate-100 text-sm">{project.name}</p>
        <a
          href={project.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors truncate block max-w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {project.githubUrl?.replace("https://", "") || "—"}
        </a>
      </div>

      {/* ── URL asignada ─────────────────────────── */}
      <div
        onClick={() => !isStopped && !isBuilding && navigate(`/projects/${project.id}`)}
        className={`flex items-center gap-2 bg-slate-900/60 rounded-lg px-3 py-2 border border-slate-700/40 transition-colors group
          ${!isStopped && !isBuilding
            ? "hover:border-cyan-700/50 cursor-pointer"
            : "cursor-not-allowed opacity-50"
          }`}
      >
        <svg className="w-3 h-3 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <span className="text-xs font-mono text-cyan-400 truncate group-hover:text-cyan-300 transition-colors">
          {project.assignedUrl}
        </span>
      </div>

      {/* ── Puerto ───────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Puerto expuesto</span>
        <span className="font-mono text-slate-300">:{project.port}</span>
      </div>

      {isError && project.deployError && (
        <p className="text-xs text-red-400/90 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2 line-clamp-3">
          {project.deployError}
        </p>
      )}

      {/* ── Botón eliminar ───────────────────────── */}
      <div className="flex justify-end">
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-all disabled:opacity-50 disabled:cursor-not-allowed
            ${confirming
              ? "bg-red-600 text-white border-red-600"
              : "text-slate-500 border-slate-700 hover:text-red-400 hover:border-red-800"
            }`}
        >
          {isDeleting ? "Eliminando…" : confirming ? "¿Confirmar?" : "Eliminar"}
        </button>
      </div>

      {/* ── Overlay: building ────────────────────── */}
      {isBuilding && (
        <div className="absolute inset-0 rounded-xl bg-slate-900/50 flex items-center justify-center">
          <div className="flex items-center gap-2 bg-slate-900/95 px-4 py-2 rounded-full border border-amber-700/50 text-xs text-amber-300">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Desplegando contenedor…
          </div>
        </div>
      )}

      {/* ── Overlay: deleting ──────────────────── */}
      {isDeleting && (
        <div className="absolute inset-0 rounded-xl bg-slate-900/60 flex items-center justify-center z-10">
          <div className="flex items-center gap-2 bg-slate-900/95 px-4 py-2 rounded-full border border-red-700/50 text-xs text-red-300">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Eliminando proyecto…
          </div>
        </div>
      )}
    </div>
  );
}