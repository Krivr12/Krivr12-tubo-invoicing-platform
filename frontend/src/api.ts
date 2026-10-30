/// <reference types="vite/client" />

const API_BASE: string = import.meta.env.VITE_API_URL;

if (!API_BASE) {
  throw new Error('VITE_API_URL is not set. Copy frontend/.env.example to frontend/.env.');
}

async function request(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('tubo_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw data;
  }

  return data;
}

export const api = {
  login: (email: string, password: string) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getInvoices: (status?: string) => {
    const query = status ? `?status=${status}&limit=50` : '?limit=50';
    return request(`/invoices${query}`);
  },

  getInvoiceById: (id: string) => request(`/invoices/${id}`),

  createInvoice: (payload: unknown) =>
    request('/invoices', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  retryInvoice: (id: string) =>
    request(`/invoices/${id}/retry`, {
      method: 'POST',
    }),
};