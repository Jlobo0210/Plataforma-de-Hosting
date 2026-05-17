import { useState } from "react";
import ProjectCard from "../components/ServiceCard";
import { minutesSinceActivity } from "../services/mockData";

/**
 * Dashboard.jsx
 * Vista principal de proyectos de hosting.
 * Filtros: Todos / Activos / Inactivos (>30 min) / Apagados
 */
export default function Dashboard({ projects, onDelete, onToggle }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = projects.filter((p) => {
    // Filtro por estado
    let matchFilter = false;
    if (filter === "all") {
      matchFilter = true;
    } else if (filter === "active") {
      matchFilter = p.status === "active" && minutesSinceActivity(p.lastActivity) < 30;
    } else if (filter === "inactive") {
      // Inactivo = activo/inactive pero sin actividad hace más de 30 min
      matchFilter =
        (p.status === "active" || p.status === "inactive") &&
        minutesSinceActivity(p.lastActivity) >= 30;
    } else if (filter === "stopped") {
      matchFilter = p.status === "stopped";
    } else if (filter === "building") {
      matchFilter = p.status === "building";
    }

    // Filtro por búsqueda (nombre o URL de GitHub)
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.githubUrl || "").toLowerCase().includes(q);

    return matchFilter && matchSearch;
  });

  const filterButtons = [
    { key: "all",      label: "Todos"     },
    { key: "active",   label: "Activos"   },
    { key: "inactive", label: "Inactivos" },
    { key: "stopped",  label: "Apagados"  },
    { key: "building", label: "Building"  },
  ];

  return (
    <div className="flex flex-col gap-5">

      {/* ── Búsqueda y filtros ──────────────────────── */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600"
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar proyecto o repositorio…"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-600 placeholder:text-slate-600"
          />
        </div>

        {filterButtons.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold border transition-colors
              ${filter === f.key
                ? "bg-cyan-600/20 text-cyan-300 border-cyan-600/40"
                : "bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300"
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Grid de proyectos ──────────────────────── */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onDelete={onDelete}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-3">
          <svg className="w-12 h-12 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-base">Sin proyectos</p>
          <p className="text-sm text-center max-w-xs">
            {search
              ? `No se encontraron proyectos para "${search}"`
              : "Crea tu primer proyecto de hosting con el botón + Nuevo proyecto"
            }
          </p>
        </div>
      )}
    </div>
  );
}