// ─────────────────────────────────────────────────────────────
//  api.js  –  Capa de datos para la Plataforma de Hosting
//
//  Auth → Roble (roble-api.openlab.uninorte.edu.co)
//  Proyectos → backend FastAPI real
// ─────────────────────────────────────────────────────────────

import { MOCK_PROJECTS } from "./mockData";

const USE_MOCK_PROJECTS = false;
const BASE_URL = "/api/projects";

const ROBLE_BASE =
  "https://roble-api.openlab.uninorte.edu.co/auth/proyecto_final_pc2_86b1196e6b";

// Usuario en memoria (se reconstruye desde el JWT al cargar)
let currentUser = null;

// ── Helpers JWT ───────────────────────────────────────────────
function decodeJwt(token) {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(b64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function userFromClaims(claims, fallbackEmail = "") {
  const email = claims.email || fallbackEmail;
  const raw = email.split("@")[0] || "usuario";
  const username = raw.replace(/\./g, "");
  const fullName = claims.name || raw.replace(/\./g, " ");
  return {
    id: claims.sub || claims.id || username,
    username,
    fullName,
    email,
    avatarInitials: username.slice(0, 2).toUpperCase(),
  };
}

// ── Store mock de proyectos (solo si USE_MOCK_PROJECTS = true) ─
let store = MOCK_PROJECTS.map((p) => ({ ...p }));

// ─────────────────────────────────────────────────────────────
//  Auth real contra Roble
// ─────────────────────────────────────────────────────────────
const robleAuth = {
  login: async (email, password) => {
    const res = await fetch(`${ROBLE_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Credenciales incorrectas");
    }
    const { accessToken, refreshToken } = await res.json();
    localStorage.setItem("roble_access", accessToken);
    localStorage.setItem("roble_refresh", refreshToken);
    const claims = decodeJwt(accessToken);
    currentUser = userFromClaims(claims, email);
    return { ...currentUser };
  },

  getUser: async () => {
    const token = localStorage.getItem("roble_access");
    if (!token) throw new Error("Sin sesión");
    const res = await fetch(`${ROBLE_BASE}/verify-token`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      localStorage.removeItem("roble_access");
      localStorage.removeItem("roble_refresh");
      throw new Error("Sesión expirada");
    }
    const claims = decodeJwt(token);
    currentUser = userFromClaims(claims);
    return { ...currentUser };
  },

  logout: async () => {
    const token = localStorage.getItem("roble_access");
    if (token) {
      await fetch(`${ROBLE_BASE}/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem("roble_access");
    localStorage.removeItem("roble_refresh");
    currentUser = null;
  },
};

// ─────────────────────────────────────────────────────────────
//  Mock de proyectos (fallback)
// ─────────────────────────────────────────────────────────────
const mock = {
  getAll: () => Promise.resolve(store.map((p) => ({ ...p }))),

  create: (data) => {
    const username = currentUser?.username || "user";
    const nuevo = {
      id: "p-" + Date.now(),
      name: data.name,
      githubUrl: data.githubUrl,
      containerType: data.containerType,
      rootPath: data.rootPath || ".",
      port: Number(data.port),
      envContent: data.envContent || "",
      status: "building",
      enabled: true,
      assignedUrl: `http://${data.name}.${username}.localhost`,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      metrics: { cpuPercent: 0, memoryMB: 0, memoryLimitMB: 512, requestsPerMin: 0, requestsLimitPerMin: 60 },
    };
    store = [nuevo, ...store];
    setTimeout(() => {
      store = store.map((s) =>
        s.id === nuevo.id
          ? { ...s, status: "active", metrics: { ...s.metrics, cpuPercent: 8, memoryMB: 96 } }
          : s
      );
    }, 3000);
    return Promise.resolve({ ...nuevo });
  },

  remove: (id) => { store = store.filter((s) => s.id !== id); return Promise.resolve(); },

  toggle: (id, enabled) => {
    store = store.map((s) =>
      s.id === id
        ? { ...s, enabled, status: enabled ? "active" : "stopped", lastActivity: enabled ? new Date().toISOString() : s.lastActivity, metrics: enabled ? { ...s.metrics, cpuPercent: 5, memoryMB: 80 } : { ...s.metrics, cpuPercent: 0, memoryMB: 0 } }
        : s
    );
    return Promise.resolve(store.find((s) => s.id === id));
  },

  getById: (id) => {
    const found = store.find((s) => s.id === id);
    if (!found) return Promise.reject(new Error("Proyecto no encontrado"));
    return Promise.resolve({ ...found });
  },

  updateEnv: (id, envContent) => {
    store = store.map((s) => (s.id === id ? { ...s, envContent } : s));
    return Promise.resolve(store.find((s) => s.id === id));
  },
};

// ─────────────────────────────────────────────────────────────
//  Helpers de adaptación  ←→  backend FastAPI
// ─────────────────────────────────────────────────────────────

function authHeaders() {
  const token = localStorage.getItem("roble_access");
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
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
    rootPath: raw.root_path ?? ".",
    envContent: raw.env_content ?? "",
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
      cpuPercent: raw.metrics?.cpu_percent_of_limit ?? raw.metrics?.cpu_percent ?? 0,
      memoryMB: raw.metrics?.memory_mb ?? 0,
      memoryLimitMB: raw.metrics?.memory_limit_mb ?? 256,
      cpuLimitVcpu: raw.metrics?.cpu_limit_vcpu ?? 0.5,
      requestsPerMin: raw.metrics?.requests_per_min ?? 0,
      requestsLimitPerMin: raw.metrics?.requests_limit_per_min ?? 60,
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
    root_path: data.rootPath ?? ".",    
    env_content: data.envContent ?? "", 
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

  updateEnv: async (id, envContent) => {
  const res = await fetch(`${BASE_URL}/${id}/env`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ env_content: envContent }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return apiProjects.getById(id);
},
};

// ─────────────────────────────────────────────────────────────
//  Export  — Auth real con Roble, proyectos contra backend real
// ─────────────────────────────────────────────────────────────
export default {
  getUser: robleAuth.getUser,
  login: robleAuth.login,
  logout: robleAuth.logout,
  ...(USE_MOCK_PROJECTS
    ? { getAll: mock.getAll, getById: mock.getById, create: mock.create, remove: mock.remove, toggle: mock.toggle, updateEnv: mock.updateEnv }
    : apiProjects),
};
