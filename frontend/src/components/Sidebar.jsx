export default function Sidebar({ services, onNewService }) {
  const active = services.filter((s) => s.status === "active").length;
  const building = services.filter((s) => s.status === "building").length;
  const disabled = services.filter((s) => s.status === "inactive").length;

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 flex flex-col bg-slate-900 border-r border-slate-700/60">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-700/60">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-cyan-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-100">MicroDock</p>
          <p className="text-xs text-slate-500">Docker Manager</p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex-1 px-4 py-4 space-y-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Clúster
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            {
              label: "Activos",
              val: active,
              color: "text-emerald-400 bg-emerald-900/30 border-emerald-800/50",
            },
            
            {
              label: "Off",
              val: disabled,
              color: "text-slate-400 bg-slate-800/60 border-slate-700/50",
            },
          ].map((s) => (
            <div
              key={s.label}
              className={`flex flex-col items-center py-2 rounded-lg border text-center ${s.color}`}
            >
              <span className="text-lg font-bold leading-none">{s.val}</span>
              <span className="text-[10px] mt-0.5 opacity-80">{s.label}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs px-1">
          <span className="text-slate-500">Total</span>
          <span className="font-bold text-slate-200">{services.length}</span>
        </div>
      </div>

      {/* Botón nuevo */}
      <div className="px-4 pb-5">
        <button
          onClick={onNewService}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Nuevo Servicio
        </button>
      </div>
    </aside>
  );
}
