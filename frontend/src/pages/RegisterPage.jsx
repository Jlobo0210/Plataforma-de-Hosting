import { useState } from "react";

const ROBLE_BASE =
  "https://roble-api.openlab.uninorte.edu.co/auth/proyecto_final_pc2_86b1196e6b";

export default function RegisterPage({ onGoToLogin }) {
  const [step, setStep] = useState("form"); // "form" | "verify"
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setError("");
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) return setError("Ingresa tu nombre completo");
    if (!form.email.trim()) return setError("Ingresa tu correo");
    if (form.password.length < 6) return setError("La contraseña debe tener mínimo 6 caracteres");
    if (form.password !== form.confirm) return setError("Las contraseñas no coinciden");

    setLoading(true);
    try {
      const res = await fetch(`${ROBLE_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim(), password: form.password, name: form.name.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al registrar la cuenta");
      }
      setStep("verify");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    if (!code.trim()) return setError("Ingresa el código de verificación");

    setLoading(true);
    try {
      const res = await fetch(`${ROBLE_BASE}/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim(), code: code.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Código incorrecto o expirado");
      }
      onGoToLogin("registered");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-slate-800/30 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b border-slate-700/60 text-center">
            <div className="flex items-center justify-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-base font-bold text-slate-100">HostDock</p>
                <p className="text-xs text-slate-500">Plataforma de Hosting</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-900/30 border border-emerald-700/40 text-emerald-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {step === "form" ? "Crear cuenta · Roble" : "Verificar correo · Roble"}
            </div>
          </div>

          {/* Paso 1 — Formulario de registro */}
          {step === "form" && (
            <form onSubmit={handleSignup} className="px-8 py-6 space-y-4">
              {/* Nombre */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Nombre completo
                </label>
                <div className="mt-1.5">
                  <input
                    type="text"
                    value={form.name}
                    onChange={set("name")}
                    placeholder="Juan Pérez"
                    autoComplete="name"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-600 placeholder:text-slate-600 transition-colors"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Correo institucional
                </label>
                <div className="mt-1.5">
                  <input
                    type="email"
                    value={form.email}
                    onChange={set("email")}
                    placeholder="usuario@uninorte.edu.co"
                    autoComplete="email"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-600 placeholder:text-slate-600 transition-colors"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Contraseña
                </label>
                <div className="mt-1.5">
                  <input
                    type="password"
                    value={form.password}
                    onChange={set("password")}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-600 placeholder:text-slate-600 transition-colors"
                  />
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Confirmar contraseña
                </label>
                <div className="mt-1.5">
                  <input
                    type="password"
                    value={form.confirm}
                    onChange={set("confirm")}
                    placeholder="Repite tu contraseña"
                    autoComplete="new-password"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-600 placeholder:text-slate-600 transition-colors"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                      <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Creando cuenta…
                  </>
                ) : "Crear cuenta con Roble"}
              </button>

              <p className="text-center text-xs text-slate-500 pt-1">
                ¿Ya tienes cuenta?{" "}
                <button
                  type="button"
                  onClick={() => onGoToLogin()}
                  className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                >
                  Inicia sesión
                </button>
              </p>
            </form>
          )}

          {/* Paso 2 — Verificación de email */}
          {step === "verify" && (
            <form onSubmit={handleVerify} className="px-8 py-6 space-y-4">
              <div className="text-center space-y-1 pb-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-300 font-medium">Revisa tu correo</p>
                <p className="text-xs text-slate-500">
                  Enviamos un código de verificación a{" "}
                  <span className="text-slate-400">{form.email}</span>
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Código de verificación
                </label>
                <div className="mt-1.5">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => { setCode(e.target.value); setError(""); }}
                    placeholder="123456"
                    maxLength={10}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-600 placeholder:text-slate-600 transition-colors text-center tracking-widest text-base font-mono"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                      <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Verificando…
                  </>
                ) : "Verificar cuenta"}
              </button>

              <p className="text-center text-xs text-slate-500">
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="text-slate-400 hover:text-slate-300 transition-colors"
                >
                  ← Volver al registro
                </button>
              </p>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-700 mt-4">
          Estructura del Computador II · Uninorte 2025
        </p>
      </div>
    </div>
  );
}