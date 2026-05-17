// ─────────────────────────────────────────────────────────────
//  api.js  –  Capa de datos para la Plataforma de Hosting
//
//  USE_MOCK = true  → usa datos locales de mockData.js
//  USE_MOCK = false → llama al backend real (aún no construido)
//
//  Cuando el backend esté listo, solo cambia USE_MOCK a false
//  y ajusta BASE_URL al dominio/puerto correcto.
// ─────────────────────────────────────────────────────────────

const USE_MOCK = true;  // ← Cambiar a false cuando el backend esté listo
const BASE_URL = "/api/projects";  // ← Ajustar según el backend

import { MOCK_PROJECTS, MOCK_USER } from "./mockData";

// ── Store mutable en memoria (solo para el mock) ─────────────
let store = MOCK_PROJECTS.map((p) => ({ ...p }));
let currentUser = { ...MOCK_USER };

// ─────────────────────────────────────────────────────────────
//  MOCK  –  Simula todas las respuestas del backend
// ─────────────────────────────────────────────────────────────
const mock = {
  /** Devuelve el usuario autenticado actual */
  getUser: () => Promise.resolve({ ...currentUser }),

  /** Simula login: acepta cualquier credencial con dominio @uninorte.edu.co */
  login: (email, password) => {
    if (!email.endsWith("@uninorte.edu.co")) {
      return Promise.reject(new Error("Solo se permite correo @uninorte.edu.co"));
    }
    if (!password || password.length < 4) {
      return Promise.reject(new Error("Contraseña incorrecta"));
    }
    const username = email.split("@")[0].replace(".", "");
    currentUser = {
      id: "u-" + Date.now(),
      username,
      fullName: email.split("@")[0].replace(".", " "),
      email,
      avatarInitials: username.slice(0, 2).toUpperCase(),
    };
    return Promise.resolve({ ...currentUser });
  },

  logout: () => {
    currentUser = null;
    return Promise.resolve();
  },

  /** Devuelve todos los proyectos del usuario */
  getAll: () => Promise.resolve(store.map((p) => ({ ...p }))),

  /**
   * Crea un nuevo proyecto.
   * @param {{ name, githubUrl, containerType, port }} data
   */
  create: (data) => {
    const username = currentUser?.username || "user";
    const nuevo = {
      id: "p-" + Date.now(),
      name: data.name,
      githubUrl: data.githubUrl,
      containerType: data.containerType,  // "dockerfile" | "compose"
      port: Number(data.port),
      status: "building",
      enabled: true,
      assignedUrl: `http://${data.name}.${username}.localhost`,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      metrics: {
        cpuPercent: 0,
        memoryMB: 0,
        memoryLimitMB: 512,
        requestsPerMin: 0,
        requestsLimitPerMin: 60,
      },
    };
    store = [nuevo, ...store];

    // Simula que el contenedor termina de construirse en ~3 segundos
    setTimeout(() => {
      store = store.map((s) =>
        s.id === nuevo.id
          ? { ...s, status: "active", metrics: { ...s.metrics, cpuPercent: 8, memoryMB: 96 } }
          : s
      );
    }, 3000);

    return Promise.resolve({ ...nuevo });
  },

  /** Elimina un proyecto por ID */
  remove: (id) => {
    store = store.filter((s) => s.id !== id);
    return Promise.resolve();
  },

  /**
   * Enciende o apaga un contenedor.
   * Equivale a docker start / docker stop en el backend.
   */
  toggle: (id, enabled) => {
    store = store.map((s) =>
      s.id === id
        ? {
            ...s,
            enabled,
            status: enabled ? "active" : "stopped",
            lastActivity: enabled ? new Date().toISOString() : s.lastActivity,
            metrics: enabled
              ? { ...s.metrics, cpuPercent: 5, memoryMB: 80 }
              : { ...s.metrics, cpuPercent: 0, memoryMB: 0 },
          }
        : s
    );
    return Promise.resolve(store.find((s) => s.id === id));
  },

  /** Devuelve un proyecto por ID (para la vista de detalle) */
  getById: (id) => {
    const found = store.find((s) => s.id === id);
    if (!found) return Promise.reject(new Error("Proyecto no encontrado"));
    return Promise.resolve({ ...found });
  },
};

// ─────────────────────────────────────────────────────────────
//  API REAL  –  Se activa cuando USE_MOCK = false
//  Los endpoints siguen la convención REST que el backend
//  deberá implementar. Ajusta según lo que acuerden en el equipo.
// ─────────────────────────────────────────────────────────────
const api = {
  /** GET /api/auth/me */
  getUser: async () => {
    const res = await fetch("/api/auth/me");
    if (!res.ok) throw new Error(`Error ${res.status}`);
    return res.json();
  },

  /** POST /api/auth/login  { email, password } */
  login: async (email, password) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Error ${res.status}`);
    }
    return res.json();
  },

  /** POST /api/auth/logout */
  logout: async () => {
    await fetch("/api/auth/logout", { method: "POST" });
  },

  /** GET /api/projects */
  getAll: async () => {
    const res = await fetch(BASE_URL);
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
    const data = await res.json();
    if (!Array.isArray(data?.projects)) return [];
    return data.projects;
  },

  /**
   * POST /api/projects
   * Body: { name, githubUrl, containerType, port }
   */
  create: async (data) => {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
    return res.json();
  },

  /** DELETE /api/projects/:id */
  remove: async (id) => {
    const res = await fetch(`${BASE_URL}/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  },

  /**
   * PATCH /api/projects/:id/start  ← enabled = true
   * PATCH /api/projects/:id/stop   ← enabled = false
   */
  toggle: async (id, enabled) => {
    const action = enabled ? "start" : "stop";
    const res = await fetch(`${BASE_URL}/${id}/${action}`, { method: "PATCH" });
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
    return res.json();
  },

  /** GET /api/projects/:id */
  getById: async (id) => {
    const res = await fetch(`${BASE_URL}/${id}`);
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
    return res.json();
  },
};

export default USE_MOCK ? mock : api;