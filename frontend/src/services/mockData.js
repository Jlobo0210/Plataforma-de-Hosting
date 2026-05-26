// ─────────────────────────────────────────────────────────────
//  mockData.js  –  Datos simulados para la Plataforma de Hosting
//  NOTA: Este archivo reemplaza completamente la lógica anterior
//  de microservicios. Todos los campos reflejan el contrato que
//  el backend deberá cumplir cuando esté construido.
// ─────────────────────────────────────────────────────────────

/**
 * Estado de un proyecto:
 *  "active"   → contenedor corriendo normalmente
 *  "inactive" → inactivo hace más de 30 min (se apagará pronto / ya se apagó automáticamente)
 *  "stopped"  → apagado manualmente o por inactividad
 *  "building" → contenedor en proceso de despliegue
 *  "error"    → fallo en el despliegue
 */

export const MOCK_USER = {
  id: "u1",
  username: "jperez",
  fullName: "Juan Pérez",
  email: "j.perez@uninorte.edu.co",
  avatarInitials: "JP",
};

export const MOCK_PROJECTS = [
  {
    id: "p1",
    name: "portafolio",
    githubUrl: "https://github.com/jperez/portafolio-web",
    containerType: "dockerfile",
    rootPath: "./frontend",          // ruta raíz del proyecto dentro del repo
    port: 3000,
    envContent: "NODE_ENV=production\nPORT=3000\nAPI_URL=https://api.ejemplo.com",
    status: "active",
    enabled: true,
    assignedUrl: "http://portafolio.jperez.localhost",
    createdAt: "2025-06-10T10:00:00Z",
    lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    metrics: {
      cpuPercent: 12.4,
      memoryMB: 128,
      memoryLimitMB: 512,
      requestsPerMin: 8,
      requestsLimitPerMin: 60,
    },
  },
  {
    id: "p2",
    name: "blog-personal",
    githubUrl: "https://github.com/jperez/my-blog",
    containerType: "compose",
    rootPath: ".",
    port: 8080,
    envContent: "DB_HOST=localhost\nDB_PORT=5432\nDB_NAME=blog\nSECRET_KEY=abc123",
    status: "inactive",
    enabled: true,
    assignedUrl: "http://blog-personal.jperez.localhost",
    createdAt: "2025-06-08T14:30:00Z",
    lastActivity: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    metrics: {
      cpuPercent: 0.1,
      memoryMB: 64,
      memoryLimitMB: 512,
      requestsPerMin: 0,
      requestsLimitPerMin: 60,
    },
  },
  {
    id: "p3",
    name: "tienda-react",
    githubUrl: "https://github.com/jperez/ecommerce-react",
    containerType: "dockerfile",
    rootPath: ".",
    port: 4200,
    envContent: "",                  // sin variables de entorno
    status: "stopped",
    enabled: false,
    assignedUrl: "http://tienda-react.jperez.localhost",
    createdAt: "2025-06-01T09:00:00Z",
    lastActivity: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    metrics: {
      cpuPercent: 0,
      memoryMB: 0,
      memoryLimitMB: 512,
      requestsPerMin: 0,
      requestsLimitPerMin: 60,
    },
  },
  {
    id: "p4",
    name: "api-docs",
    githubUrl: "https://github.com/jperez/swagger-docs",
    containerType: "compose",
    rootPath: "./docs",
    port: 5000,
    envContent: "APP_ENV=staging\nLOG_LEVEL=debug",
    status: "building",
    enabled: true,
    assignedUrl: "http://api-docs.jperez.localhost",
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    lastActivity: new Date().toISOString(),
    metrics: {
      cpuPercent: 0,
      memoryMB: 0,
      memoryLimitMB: 512,
      requestsPerMin: 0,
      requestsLimitPerMin: 60,
    },
  },
];

/**
 * Calcula el tiempo transcurrido desde lastActivity en minutos.
 * Útil para decidir si el contenedor debe mostrarse como "inactivo pronto".
 */
export function minutesSinceActivity(lastActivity) {
  if (!lastActivity) return 0;
  return Math.floor((Date.now() - new Date(lastActivity).getTime()) / 60000);
}

/**
 * Devuelve true si el proyecto lleva más de 30 min inactivo
 * y todavía no fue marcado como "stopped".
 */
export function isAboutToSleep(project) {
  if (project.status !== "active" && project.status !== "inactive") return false;
  return minutesSinceActivity(project.lastActivity) >= 30;
}