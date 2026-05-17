import { minutesSinceActivity } from "../services/mockData";

/**
 * Sidebar.jsx
 * Barra lateral de la plataforma de hosting.
 * Muestra stats de proyectos, usuario actual y botón de logout.
 */
export default function Sidebar({ user, projects, onNewProject, onLogout }) {
  const active   = projects.filter((p) => p.status === "active").length;
  const inactive = projects.filter((p) => {
    if (p.status !== "active" && p.status !== "inactive") return false;
    return minutesSinceActivity(p.lastActivity) >= 30;
  }).length;
  const stopped  = projects.filter((p) => p.status === "stopped").length;
  const building = projects.filter((p) => p.status === "building").length;

  const stats = [
    { label: "Activos",     val: active,   color: "text-emerald-400 bg-emerald-900/30 border-emerald-800/50" },
    { label: "Inactivos",   val: inactive,  color: "text-amber-400   bg-amber-900/30   border-amber-800/50"   },
    { label: "Apagados",    val: stopped,   color: "text-slate-400   bg-slate-800/60   border-slate-700/50"   },
  ];

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 flex flex-col bg-slate-900 border-r border-slate-700/60">

      {/* ── Logo ──────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-700/60">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
          <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-100">HostDock</p>
          <p className="text-xs text-slate-500">Hosting Platform</p>
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────── */}
      <div className="px-4 py-4 space-y-3 border-b border-slate-700/60">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Clúster
        </p>
        <div className="grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className={`flex flex-col items-center py-2 rounded-lg border text-center ${s.color}`}
            >
              <span className="text-lg font-bold leading-none">{s.val}</span>
              <span className="text-[10px] mt-0.5 opacity-80 leading-tight">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-between text-xs px-1">
          <span className="text-slate-500">Total proyectos</span>
          <span className="font-bold text-slate-200">{projects.length}</span>
        </div>

        {building > 0 && (
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-900/20 border border-amber-800/40 rounded-lg px-3 py-1.5">
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            {building} desplegando…
          </div>
        )}
      </div>

      {/* ── Info de política de recursos ──────────── */}
      <div className="px-4 py-4 flex-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
          Política de recursos
        </p>
        <div className="space-y-2">
          {[
            { icon: "⏱", text: "Auto-apagado tras 30 min inactivo" },
            { icon: "🔄", text: "Reinicio automático al recibir petición" },
            { icon: "⚡", text: "Límite: 60 req/min por contenedor" },
            { icon: "💾", text: "Máx 512 MB RAM por proyecto" },
          ].map((item) => (
            <div key={item.text} className="flex items-start gap-2 text-xs text-slate-600">
              <span className="text-base leading-none">{item.icon}</span>
              <span className="leading-relaxed">{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Usuario + Logout ───────────────────────── */}
      <div className="px-4 pb-4 space-y-3 border-t border-slate-700/60 pt-4">
        {user && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user.avatarInitials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{user.fullName || user.username}</p>
              <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
        )}

        <button
          onClick={onNewProject}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo proyecto
        </button>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-700 text-slate-500 text-xs hover:text-red-400 hover:border-red-800/50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}