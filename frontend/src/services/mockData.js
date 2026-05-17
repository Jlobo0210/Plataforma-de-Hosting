export const MOCK_SERVICES = [
  {
    id: '1',
    name: 'auth-service',
    description: 'Servicio de autenticación JWT',
    language: 'PYTHON',
    status: 'active',
    enabled: true,
    endpoint: 'http://localhost:3001',
  },
  {
    id: '2',
    name: 'api-gateway',
    description: 'Gateway principal en Express.js',
    language: 'JAVASCRIPT',
    status: 'building',
    enabled: true,
    endpoint: 'http://localhost:3002',
  },
  {
    id: '3',
    name: 'data-processor',
    description: 'Procesador de archivos CSV',
    language: 'PYTHON',
    status: 'disabled',
    enabled: false,
    endpoint: 'http://localhost:3003',
  },
];