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
    containerType: "dockerfile",   // "dockerfile" | "compose"
    port: 3000,
    status: "active",
    enabled: true,
    assignedUrl: "http://portafolio.jperez.localhost",
    createdAt: "2025-06-10T10:00:00Z",
    lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // hace 5 min
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
    port: 8080,
    status: "inactive",
    enabled: true,
    assignedUrl: "http://blog-personal.jperez.localhost",
    createdAt: "2025-06-08T14:30:00Z",
    lastActivity: new Date(Date.now() - 35 * 60 * 1000).toISOString(), // hace 35 min → auto-apagado pronto
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
    port: 4200,
    status: "stopped",
    enabled: false,
    assignedUrl: "http://tienda-react.jperez.localhost",
    createdAt: "2025-06-01T09:00:00Z",
    lastActivity: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // hace 3h
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
    port: 5000,
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