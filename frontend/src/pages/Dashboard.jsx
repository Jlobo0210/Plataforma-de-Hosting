import { useState } from "react";
import ServiceCard from "../components/ServiceCard";

export default function Dashboard({ services, onDelete, onToggle }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = services.filter((s) => {
    const matchFilter = filter === "all" || (filter === "disabled" ? s.status === "inactive" : s.status === filter);
    const q = search.toLowerCase();
    const matchSearch = !q || s.name.toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Búsqueda y filtros */}
      <div className="flex gap-3 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar servicio…"
          className="flex-1 min-w-[200px] bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-600 placeholder:text-slate-600"
        />
        {["all", "active",  "disabled"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold border transition-colors
              ${filter === f ? "bg-cyan-600/20 text-cyan-300 border-cyan-600/40" : "bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300"}`}
          >
            {
              {
                all: "Todos",
                active: "Activos",
                disabled: "Off",
              }[f]
            }
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <ServiceCard
              key={s.id}
              service={s}
              onDelete={onDelete}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
          <p className="text-lg">Sin resultados</p>
          <p className="text-sm">
            Crea tu primer microservicio o ajusta los filtros
          </p>
        </div>
      )}
    </div>
  );
}
