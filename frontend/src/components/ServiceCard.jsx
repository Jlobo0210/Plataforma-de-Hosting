import { useState } from "react";
import { useNavigate } from "react-router-dom";
import StatusBadge from "./StatusBadge";

export default function ServiceCard({ service, onDelete, onToggle }) {
  const [confirming, setConfirming] = useState(false);
  const navigate = useNavigate();
  const handleDelete = () => {
    if (confirming) {
      onDelete(service.id);
    } else {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
    }
  };

  const isBuilding = service.status === "building";
  const langColor =
    service.language === "python"
      ? "bg-blue-900/30 text-blue-300 border-blue-700/40"
      : "bg-yellow-900/30 text-yellow-300 border-yellow-700/40";

  return (
    <div
      className={`relative flex flex-col gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 transition-opacity ${!service.enabled ? "opacity-50" : ""}`}
    >
      {/* Top: badges + switch */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2 flex-wrap">
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded border ${langColor}`}
          >
            {service.language === "python" ? "🐍" : "🟨"} {service.language}
          </span>
          <StatusBadge status={service.status} />
        </div>

        {/* Switch arreglado */}
        <button
          onClick={() => !isBuilding && onToggle(service.id, !service.enabled)}
          disabled={isBuilding}
          className="relative inline-flex items-center w-11 h-6 rounded-full transition-colors duration-300 disabled:opacity-40 focus:outline-none"
          style={{ backgroundColor: service.enabled ? "#10b981" : "#475569" }}
        >
          <span
            className="inline-block w-4 h-4 bg-white rounded-full shadow transition-transform duration-300"
            style={{
              transform: service.enabled
                ? "translateX(22px)"
                : "translateX(4px)",
            }}
          />
        </button>
      </div>

      {/* Nombre y descripción */}
      <div>
        <p className="font-mono font-semibold text-slate-100">{service.name}</p>
        <p className="text-xs text-slate-400 mt-0.5">{service.description}</p>
      </div>

      {/* Endpoint clickeable */}
      <div
        onClick={() => service.enabled && navigate(`/services/${service.id}`)}
        className={`flex items-center gap-2 bg-slate-900/60 rounded-lg px-3 py-2 border border-slate-700/40 transition-colors
          ${service.enabled 
            ? "hover:border-cyan-700/50 cursor-pointer group" 
            : "cursor-not-allowed opacity-50" 
          }`}
      >
        <span className="text-xs text-slate-500 shrink-0">Endpoint:</span>
        <span className="text-xs font-mono text-cyan-400 truncate group-hover:text-cyan-300">
          {service.endpoint}
        </span>
      </div>

      {/* Botón eliminar */}
      <div className="flex justify-end">
        <button
          onClick={handleDelete}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${confirming ? "bg-red-600 text-white border-red-600" : "text-slate-500 border-slate-700 hover:text-red-400 hover:border-red-800"}`}
        >
          {confirming ? "¿Confirmar?" : "Eliminar"}
        </button>
      </div>

      {/* Overlay building */}
      {isBuilding && (
        <div className="absolute inset-0 rounded-xl bg-slate-900/40 flex items-center justify-center">
          <div className="flex items-center gap-2 bg-slate-900/90 px-4 py-2 rounded-full border border-amber-700/50 text-xs text-amber-300">
            <svg
              className="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                className="opacity-25"
              />
              <path
                fill="currentColor"
                className="opacity-75"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            Construyendo imagen…
          </div>
        </div>
      )}
    </div>
  );
}
