import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Dashboard from "./Dashboard";
import CreateServiceModal from "../components/CreateServiceModal";
import api from "../services/api";

export default function App() {
  const [services, setServices] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getAll();
        // Solo actualizar si es array válido
        if (Array.isArray(data)) {
          setServices(data);
        }
      } catch (err) {
        // Si falla, NO tocar el estado actual
        console.error("❌ Error cargando servicios:", err);
      }
    };

    load();
    const interval = setInterval(load, 5000); 
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async (data) => {
    try {
      const nuevo = await api.create(data);
      setServices((prev) => [nuevo, ...prev]);
    } catch (err) {
      console.error("❌ Error creando servicio:", err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.remove(id);
      setServices((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error("❌ Error eliminando servicio:", err);
    }
  };

  const handleToggle = async (id, enabled) => {
    try {
      await api.toggle(id, enabled);
      setServices((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, enabled, status: enabled ? "active" : "inactive" }
            : s,
        ),
      );
    } catch (err) {
      console.error("❌ Error toggling servicio:", err);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar services={services} onNewService={() => setModalOpen(true)} />

      <main className="flex-1 flex flex-col">
        <header className="flex items-center justify-between px-8 py-5 border-b border-slate-800">
          <div>
            <h1 className="text-lg font-bold">Dashboard</h1>
            <p className="text-xs text-slate-500">
              Gestión de microservicios Docker
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm hover:bg-slate-700 transition-colors"
          >
            + Nuevo servicio
          </button>
        </header>

        <div className="flex-1 px-8 py-6">
          <Dashboard
            services={services}
            onDelete={handleDelete}
            onToggle={handleToggle}
          />
        </div>
      </main>

      <CreateServiceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
