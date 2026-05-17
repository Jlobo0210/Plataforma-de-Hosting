import { useState } from "react";
import CodeEditor from "./CodeEditor";

const EMPTY = { name: "", description: "", language: "python", code: "" };

export default function CreateServiceModal({ isOpen, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const set = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Requerido";
    if (!/^[a-z0-9-]+$/.test(form.name))
      e.name = "Solo minúsculas, números y guiones";
    if (!form.description.trim()) e.description = "Requerido";
    if (!form.code.trim()) e.code = "Pega el código fuente";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    await onSubmit(form);
    setLoading(false);
    setForm(EMPTY);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 sticky top-0 bg-slate-900">
          <h2 className="text-base font-bold text-slate-100">
            Nuevo Microservicio
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Nombre */}
          <div>
            <label className="text-sm text-slate-300 font-medium">
              Nombre <span className="text-cyan-400">*</span>
            </label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value.toLowerCase())}
              placeholder="ej: auth-service"
              className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-200 focus:outline-none focus:border-cyan-600 placeholder:text-slate-600"
            />
            {errors.name && (
              <p className="text-xs text-red-400 mt-1">{errors.name}</p>
            )}
          </div>

          {/* Descripción */}
          <div>
            <label className="text-sm text-slate-300 font-medium">
              Descripción <span className="text-cyan-400">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              placeholder="¿Qué hace este microservicio?"
              className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 resize-none focus:outline-none focus:border-cyan-600 placeholder:text-slate-600"
            />
            {errors.description && (
              <p className="text-xs text-red-400 mt-1">{errors.description}</p>
            )}
          </div>

          {/* Lenguaje */}
          <div>
            <label className="text-sm text-slate-300 font-medium">
              Lenguaje
            </label>
            <div className="mt-1 flex gap-3">
              {["python", "javascript"].map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => set("language", lang)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-all
                    ${
                      form.language === lang
                        ? lang === "python"
                          ? "bg-blue-900/40 border-blue-600/50 text-blue-300"
                          : "bg-yellow-900/40 border-yellow-600/50 text-yellow-300"
                        : "bg-slate-800 border-slate-700 text-slate-500"
                    }`}
                >
                  {lang === "python" ? "🐍 Python" : "🟨 JavaScript"}
                </button>
              ))}
            </div>
          </div>

          {/* Código */}
          <div>
            <label className="text-sm text-slate-300 font-medium">
              Código fuente <span className="text-cyan-400">*</span>
            </label>
            <div className="mt-1">
              <CodeEditor
                value={form.code}
                onChange={(v) => set("code", v)}
                language={form.language}
              />
            </div>
            {errors.code && (
              <p className="text-xs text-red-400 mt-1">{errors.code}</p>
            )}
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-2">
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
              className="flex-1 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? "Desplegando…" : "Crear y desplegar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
