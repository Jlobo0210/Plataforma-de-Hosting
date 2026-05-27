import { useState, useEffect, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import Dashboard from "./Dashboard";
import CreateServiceModal from "../components/CreateServiceModal";
import LoginPage from "./Loginpage";
import RegisterPage from "./RegisterPage";
import api from "../services/api";

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [screen, setScreen] = useState("login"); // "login" | "register"
  const [justRegistered, setJustRegistered] = useState(false);
  const [projects, setProjects] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);

  // ── Verificar sesión al montar ────────────────────────────
  useEffect(() => {
    api
      .getUser()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));
  }, []);

  // ── Polling de proyectos (solo si hay sesión) ─────────────
  const loadProjects = useCallback(async () => {
    try {
      const data = await api.getAll();
      if (Array.isArray(data)) setProjects(data);
    } catch (err) {
      console.error("❌ Error cargando proyectos:", err);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadProjects();
    const interval = setInterval(loadProjects, 5000);
    return () => clearInterval(interval);
  }, [user, loadProjects]);

  // ── Handlers ──────────────────────────────────────────────
  const handleLogin = async (email, password) => {
    const loggedUser = await api.login(email, password); // lanza si falla
    setUser(loggedUser);
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setProjects([]);
  };

  const handleCreate = async (data) => {
    try {
      const nuevo = await api.create(data);
      setProjects((prev) => [nuevo, ...prev]);
    } catch (err) {
      console.error("❌ Error creando proyecto:", err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.remove(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("❌ Error eliminando proyecto:", err);
    }
  };

  const handleToggle = async (id, enabled) => {
    try {
      await api.toggle(id, enabled);
      setProjects((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                enabled,
                status: enabled ? "active" : "stopped",
                lastActivity: enabled ? new Date().toISOString() : p.lastActivity,
              }
            : p
        )
      );
    } catch (err) {
      console.error("❌ Error toggling proyecto:", err);
    }
  };

  // ── Pantalla de carga inicial ─────────────────────────────
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="w-5 h-5 animate-spin text-cyan-500" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span className="text-sm">Verificando sesión…</span>
        </div>
      </div>
    );
  }

  // ── Sin sesión → Login o Register ────────────────────────
  if (!user) {
    if (screen === "register") {
      return (
        <RegisterPage
          onGoToLogin={(reason) => {
            setJustRegistered(reason === "registered");
            setScreen("login");
          }}
        />
      );
    }
    return (
      <LoginPage
        onLogin={handleLogin}
        onGoToRegister={() => { setJustRegistered(false); setScreen("register"); }}
        registered={justRegistered}
      />
    );
  }

  // ── Con sesión → App principal ────────────────────────────
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar
        user={user}
        projects={projects}
        onNewProject={() => setModalOpen(true)}
        onLogout={handleLogout}
      />

      <main className="flex-1 flex flex-col">
        <header className="flex items-center justify-between px-8 py-5 border-b border-slate-800">
          <div>
            <h1 className="text-lg font-bold">Mis Proyectos</h1>
            <p className="text-xs text-slate-500">
              Plataforma de Hosting · {user.email}
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo proyecto
          </button>
        </header>

        <div className="flex-1 px-8 py-6">
          <Dashboard
            projects={projects}
            onDelete={handleDelete}
            onToggle={handleToggle}
          />
        </div>
      </main>

      <CreateServiceModal
        isOpen={modalOpen}
        user={user}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}