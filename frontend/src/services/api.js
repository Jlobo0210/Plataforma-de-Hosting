const USE_MOCK = false;
const BASE_URL = '/api/services';

import { MOCK_SERVICES } from './mockData';

let store = [...MOCK_SERVICES];

// ── Mock local ──────────────────────────────────────────────
const mock = {
  getAll: () => Promise.resolve([...store]),

  create: (data) => {
    const nuevo = { ...data, id: Date.now().toString(), status: 'building', enabled: true, endpoint: `http://localhost:${3000 + store.length + 1}` };
    store = [nuevo, ...store];
    setTimeout(() => { store = store.map(s => s.id === nuevo.id ? { ...s, status: 'active' } : s); }, 3000);
    return Promise.resolve(nuevo);
  },

  remove: (id) => { store = store.filter(s => s.id !== id); return Promise.resolve(); },

  toggle: (id, enabled) => {
    store = store.map(s => s.id === id ? { ...s, enabled, status: enabled ? 'active' : 'disabled' } : s);
    return Promise.resolve(store.find(s => s.id === id));
  },
};

// ── API real ────────────────────────────────────────────────
const api = {
  getAll: async () => {
    const res = await fetch(BASE_URL);

    // ⭐ Si la respuesta no es OK, lanzar error sin tocar el estado
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);

    const data = await res.json();

    // ⭐ Si no hay services o está vacío, retornar array vacío sin explotar
    if (!data?.services || typeof data.services !== 'object') return [];

    return Object.entries(data.services).map(([id, service]) => ({
      id,
      ...service,
      status: service.status || 'active',
      enabled: service.status !== 'inactive'
    }));
  },

  create: async (data) => {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);

    const service = await res.json();
    return {
      id: service.service_id,
      ...service,
      enabled: true,
      status: 'active'
    };
  },

  remove: async (id) => {
    const res = await fetch(`${BASE_URL}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  },

  toggle: async (id, enabled) => {
    const res = await fetch(`${BASE_URL}/${id}/${enabled ? 'enable' : 'disable'}`, {
      method: 'PATCH',
    });
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
    return res.json();
  },

  getParams: async (id) => {
    const res = await fetch(`${BASE_URL}/${id}/params`);
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
    return res.json();
  },

  run: async (endpoint, params) => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
    return res.json();
  },
};

export default USE_MOCK ? mock : api;