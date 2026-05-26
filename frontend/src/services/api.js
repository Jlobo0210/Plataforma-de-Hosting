// ─────────────────────────────────────────────────────────────
//  api.js  –  Capa de datos para la Plataforma de Hosting
//
//  Modo híbrido:
//    • Auth (getUser, login, logout) → mock local (TODO Roble)
//    • Proyectos (getAll, getById, create, remove, toggle) →
//      backend FastAPI real, con normalización snake_case ↔ camelCase
//      y header X-Username derivado del usuario mock.
//
//  Para volver al modo 100% mock (sin backend), poner USE_MOCK_PROJECTS = true.
// ─────────────────────────────────────────────────────────────

import { MOCK_PROJECTS, MOCK_USER } from "./mockData";

const USE_MOCK_PROJECTS = false;
const BASE_URL = "/api/projects";

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
//  Helpers de adaptación  ←→  backend FastAPI
// ─────────────────────────────────────────────────────────────

/** Header obligatorio del backend (stub auth Roble). */
function authHeaders() {
  const username = currentUser?.username;
  const headers = { "Content-Type": "application/json" };
  if (username) headers["X-Username"] = username;
  return headers;
}

/**
 * Mapeo de los tres estados del backend al modelo binario de la UI.
 * `idle` (apagado por inactividad) se muestra como `active` porque el
 * auth_request del NGINX revive el contenedor de forma transparente.
 */
const STATUS_MAP = {
  active:   { enabled: true,  status: "active" },
  idle:     { enabled: true,  status: "active" },
  inactive: { enabled: false, status: "stopped" },
};

/** Convierte un proyecto del backend (snake_case) al shape camelCase de la UI. */
function normalizeProject(id, raw) {
  const mapped = STATUS_MAP[raw.status] ?? { enabled: true, status: "active" };
  const lastEpoch = typeof raw.last_active === "number" ? raw.last_active : null;
  const lastIso = lastEpoch ? new Date(lastEpoch * 1000).toISOString() : new Date().toISOString();
  return {
    id,
    name: raw.name,
    githubUrl: raw.repo_url,
    containerType: raw.container_type === "docker-compose" ? "compose" : raw.container_type,
    port: raw.port,
    description: raw.description ?? "",
    enabled: mapped.enabled,
    status: mapped.status,
    assignedUrl:
      raw.url ||
      raw.endpoint ||
      (raw.hostname ? `http://${raw.hostname}` : null),
    createdAt: lastEpoch ? new Date(lastEpoch * 1000).toISOString() : null,
    lastActivity: lastIso,
    metrics: {
      cpuPercent: 0,
      memoryMB: 0,
      memoryLimitMB: 256, // PDF: --memory 256m
      requestsPerMin: 0,
      requestsLimitPerMin: 60,
    },
  };
}

/** Convierte el body del modal (camelCase) al formato del backend (snake_case). */
function denormalizeCreate(data) {
  return {
    name: data.name,
    repo_url: data.githubUrl,
    container_type: data.containerType === "compose" ? "docker-compose" : data.containerType,
    port: Number(data.port),
    description: data.description ?? "",
  };
}

async function readError(res) {
  try {
    const body = await res.json();
    return body.detail || body.message || `Error ${res.status}`;
  } catch {
    return `Error ${res.status}: ${res.statusText}`;
  }
}

// ─────────────────────────────────────────────────────────────
//  Proyectos contra el backend real
// ─────────────────────────────────────────────────────────────
const apiProjects = {
  /** GET /api/projects → array normalizado */
  getAll: async () => {
    const res = await fetch(BASE_URL, { headers: authHeaders() });
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json();
    const map = data?.projects ?? {};
    return Object.entries(map).map(([id, info]) => normalizeProject(id, info));
  },

  /** GET /api/projects/:id → proyecto normalizado */
  getById: async (id) => {
    const res = await fetch(`${BASE_URL}/${id}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(await readError(res));
    return normalizeProject(id, await res.json());
  },

  /**
   * POST /api/projects
   * Body UI: { name, githubUrl, containerType, port, description? }
   * Tras crear, hace GET para devolver el proyecto completo (el POST
   * solo retorna metadatos: project_id, hostname, url, message).
   */
  create: async (data) => {
    const body = denormalizeCreate(data);
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await readError(res));
    const meta = await res.json();
    return apiProjects.getById(meta.project_id);
  },

  /** DELETE /api/projects/:id */
  remove: async (id) => {
    const res = await fetch(`${BASE_URL}/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(await readError(res));
  },

  /**
   * PATCH /api/projects/:id/enable | /disable
   * Devuelve el proyecto completo refrescado.
   */
  toggle: async (id, enabled) => {
    const action = enabled ? "enable" : "disable";
    const res = await fetch(`${BASE_URL}/${id}/${action}`, {
      method: "PATCH",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(await readError(res));
    return apiProjects.getById(id);
  },
};

// ─────────────────────────────────────────────────────────────
//  Export híbrido
//    • Auth viene del mock (login con @uninorte.edu.co; setea currentUser)
//    • Proyectos van al backend real con X-Username = currentUser.username
//
//  Si USE_MOCK_PROJECTS = true, se cae a 100% mock.
// ─────────────────────────────────────────────────────────────
export default {
  getUser: mock.getUser,
  login: mock.login,
  logout: mock.logout,
  ...(USE_MOCK_PROJECTS
    ? {
        getAll: mock.getAll,
        getById: mock.getById,
        create: mock.create,
        remove: mock.remove,
        toggle: mock.toggle,
      }
    : apiProjects),
};
