import { useState } from "react";

/**
 * CreateServiceModal.jsx
 * Modal para crear un nuevo proyecto de hosting.
 * Campos según el PDF:
 *  1. Nombre del proyecto
 *  2. URL del repositorio de GitHub
 *  3. Tipo de contenedor: Dockerfile | Docker Compose
 *  4. Puerto a exponer
 */

const EMPTY = {
  name: "",
  githubUrl: "",
  containerType: "dockerfile",  // "dockerfile" | "compose"
  rootPath: ".",
  port: "",
  envContent: "",
};

// Puerto TCP del contenedor: cualquier valor 1-65535 vale.
// Es interno al network de Docker, no al host, asi que no hay conflicto
// con puertos "privilegiados" del sistema host.
const MIN_PORT = 1;
const MAX_PORT = 65535;

export default function CreateServiceModal({ isOpen, user, onClose, onSubmit }) {
  const [form, setForm]     = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const username = user?.username || "usuario";

  const set = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: "" }));
  };

  const validate = () => {
    const e = {};

    // Nombre: solo letras minúsculas, números y guiones
    if (!form.name.trim()) {
      e.name = "El nombre es requerido";
    } else if (!/^[a-z0-9-]+$/.test(form.name)) {
      e.name = "Solo minúsculas, números y guiones (sin espacios)";
    } else if (form.name.length > 30) {
      e.name = "Máximo 30 caracteres";
    }

    // GitHub URL
    if (!form.githubUrl.trim()) {
      e.githubUrl = "La URL del repositorio es requerida";
    } else if (!/^https?:\/\/(www\.)?github\.com\/.+\/.+/.test(form.githubUrl)) {
      e.githubUrl = "Debe ser una URL válida de GitHub (https://github.com/usuario/repo)";
    }

    // Puerto
    const portNum = Number(form.port);
    if (!form.port) {
      e.port = "El puerto es requerido";
    } else if (!Number.isInteger(portNum) || portNum < MIN_PORT || portNum > MAX_PORT) {
      e.port = `Puerto entre ${MIN_PORT} y ${MAX_PORT}`;
    }

    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      await onSubmit({
        name: form.name,
        githubUrl: form.githubUrl.trim(),
        containerType: form.containerType,
        rootPath: form.rootPath.trim() || ".",
        port: Number(form.port),
        envContent: form.envContent,
      });
      setForm(EMPTY);
      onClose();
    } catch (err) {
      setErrors({ general: err.message || "Error al crear el proyecto" });
    } finally {
      setLoading(false);
    }
  };

  const assignedUrl = form.name
    ? `http://${form.name}.${username}.localhost`
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl">

        {/* ── Header ─────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Nuevo Proyecto</h2>
              <p className="text-xs text-slate-500">Despliega desde GitHub</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

          {/* ── Nombre ─────────────────────────────── */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Nombre del proyecto <span className="text-cyan-400">*</span>
            </label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value.toLowerCase().replace(/\s/g, "-"))}
              placeholder="ej: mi-portafolio"
              maxLength={30}
              className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm font-mono text-slate-200 focus:outline-none focus:border-cyan-600 placeholder:text-slate-600 transition-colors"
            />
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}

            {/* Preview de URL asignada */}
            {assignedUrl && !errors.name && (
              <div className="mt-2 flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-1.5 border border-slate-700/40">
                <svg className="w-3 h-3 text-cyan-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span className="text-xs font-mono text-cyan-400 truncate">{assignedUrl}</span>
              </div>
            )}
          </div>

          {/* ── URL de GitHub ───────────────────────── */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              URL del repositorio <span className="text-cyan-400">*</span>
            </label>
            <div className="mt-1.5 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600"
                fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
              </svg>
              <input
                value={form.githubUrl}
                onChange={(e) => set("githubUrl", e.target.value.trim())}
                placeholder="https://github.com/usuario/repositorio"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-600 placeholder:text-slate-600 transition-colors"
              />
            </div>
            {errors.githubUrl && <p className="text-xs text-red-400 mt-1">{errors.githubUrl}</p>}
          </div>

          {/* ── Tipo de contenedor ──────────────────── */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Tipo de contenedor <span className="text-cyan-400">*</span>
            </label>
            <div className="mt-1.5 grid grid-cols-2 gap-3">
              {[
                {
                  value: "dockerfile",
                  title: "Dockerfile",
                  desc: "Usa el Dockerfile en la raíz del repositorio",
                  icon: "🐋",
                  color: "border-sky-600/50 bg-sky-900/20 text-sky-300",
                  inactive: "border-slate-700 bg-slate-800 text-slate-400",
                },
                {
                  value: "compose",
                  title: "Docker Compose",
                  desc: "Usa docker-compose.yml para múltiples servicios",
                  icon: "📦",
                  color: "border-violet-600/50 bg-violet-900/20 text-violet-300",
                  inactive: "border-slate-700 bg-slate-800 text-slate-400",
                },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set("containerType", opt.value)}
                  className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all
                    ${form.containerType === opt.value ? opt.color : opt.inactive}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{opt.icon}</span>
                    <span className="text-sm font-semibold">{opt.title}</span>
                  </div>
                  <span className="text-xs opacity-70 leading-relaxed">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Ruta raíz del proyecto ──────────────── */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Ruta raíz del proyecto
            </label>
            <p className="text-xs text-slate-600 mt-0.5 mb-1.5">
              Carpeta donde está el Dockerfile o docker-compose.yml dentro del repo. Útil para monorepos.
            </p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-sm font-mono select-none">
                ./
              </span>
              <input
                value={form.rootPath === "." ? "" : form.rootPath.replace(/^\.\//, "")}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  set("rootPath", v ? `./${v}` : ".");
                }}
                placeholder="frontend   (vacío = raíz del repo)"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-2.5 text-sm font-mono text-slate-200 focus:outline-none focus:border-cyan-600 placeholder:text-slate-600 transition-colors"
              />
            </div>
            {form.rootPath && form.rootPath !== "." && (
              <p className="text-xs text-slate-500 font-mono mt-1">
                Ruta: <span className="text-cyan-400">{form.rootPath}</span>
              </p>
            )}
          </div>

          {/* ── Variables de entorno (.env) ─────────── */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Variables de entorno
              <span className="ml-2 text-slate-600 normal-case font-normal">(opcional)</span>
            </label>
            <p className="text-xs text-slate-600 mt-0.5 mb-1.5">
              Pega el contenido de tu <span className="font-mono">.env</span> directamente. El backend lo inyectará al contenedor.
            </p>
            <textarea
              value={form.envContent}
              onChange={(e) => set("envContent", e.target.value)}
              rows={5}
              placeholder={"NODE_ENV=production\nPORT=3000\nDB_URL=postgres://...\nSECRET_KEY=..."}
              spellCheck={false}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-xs font-mono text-emerald-400 focus:outline-none focus:border-cyan-600 placeholder:text-slate-700 resize-y transition-colors leading-relaxed"
            />
            {form.envContent && (
              <p className="text-xs text-slate-600 mt-1">
                {form.envContent.split("\n").filter((l) => l.trim() && !l.startsWith("#")).length} variable(s) detectada(s)
              </p>
            )}
          </div>

          {/* ── Puerto ─────────────────────────────── */}          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Puerto a exponer <span className="text-cyan-400">*</span>
            </label>
            <div className="mt-1.5 relative">
              <input
                type="number"
                value={form.port}
                onChange={(e) => set("port", e.target.value)}
                placeholder="ej: 80"
                min={MIN_PORT}
                max={MAX_PORT}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm font-mono text-slate-200 focus:outline-none focus:border-cyan-600 placeholder:text-slate-600 transition-colors"
              />
            </div>
            {errors.port
              ? <p className="text-xs text-red-400 mt-1">{errors.port}</p>
              : <p className="text-xs text-slate-600 mt-1">Debe coincidir con el puerto que tu Dockerfile expone (EXPOSE).</p>
            }
          </div>

          {/* ── Error general ───────────────────────── */}
          {errors.general && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {errors.general}
            </div>
          )}

          {/* ── Botones ─────────────────────────────── */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-400 text-sm hover:text-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Desplegando…
                </>
              ) : (
                "Crear y desplegar"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}