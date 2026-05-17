const CONFIG = {
  active:   { label: 'Activo',        color: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50', pulse: true },
  building: { label: 'Construyendo',  color: 'bg-amber-900/40 text-amber-300 border-amber-700/50',     pulse: true },
  disabled: { label: 'Deshabilitado', color: 'bg-slate-800 text-slate-500 border-slate-700',            pulse: false },
  error:    { label: 'Error',         color: 'bg-red-900/40 text-red-300 border-red-700/50',            pulse: false },
};

export default function StatusBadge({ status }) {
  const c = CONFIG[status] || CONFIG.disabled;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.color}`}>
      <span className="relative flex h-2 w-2">
        {c.pulse && <span className={`animate-ping absolute h-full w-full rounded-full opacity-75 ${status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />}
        <span className={`relative rounded-full h-2 w-2 ${status === 'active' ? 'bg-emerald-400' : status === 'building' ? 'bg-amber-400' : 'bg-slate-500'}`} />
      </span>
      {c.label}
    </span>
  );
}