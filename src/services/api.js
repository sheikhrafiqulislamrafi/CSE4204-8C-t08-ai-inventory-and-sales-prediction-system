





const BASE = import.meta.env.VITE_API_URL || '/api';

const getToken = () => localStorage.getItem('token');

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  'Content-Type': 'application/json',
});

async function handleResponse(res) {
  let data = {};
  try {
    data = await res.json();
  } catch {

  }

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('business_name');
      window.location.href = '/login';
      throw new Error('Session expired. Please log in again.');
    }
    const detail = data.detail;
    if (Array.isArray(detail)) {
      throw new Error(detail.map((d) => d.msg || JSON.stringify(d)).join(', '));
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }

  return data;
}

const api = {
  auth: {
    login: async (email, password) => {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);
      const res = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });
      return handleResponse(res);
    },

    register: async (email, password, business_name) => {
      const res = await fetch(`${BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, business_name }),
      });
      return handleResponse(res);
    },

    me: async () => {
      const res = await fetch(`${BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      return handleResponse(res);
    },
  },

  orders: {
    list: async (params = {}) => {
      const clean = Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null)
      );
      const query = new URLSearchParams(clean).toString();
      const res = await fetch(`${BASE}/orders${query ? '?' + query : ''}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    create: async (order) => {
      const res = await fetch(`${BASE}/orders`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(order),
      });
      return handleResponse(res);
    },

    update: async (id, order) => {
      const res = await fetch(`${BASE}/orders/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(order),
      });
      return handleResponse(res);
    },

    remove: async (id) => {
      const res = await fetch(`${BASE}/orders/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    bulkUpload: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${BASE}/orders/bulk-upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      return handleResponse(res);
    },
  },

  analytics: {
    summary: async () => {
      const res = await fetch(`${BASE}/analytics/summary`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    daily: async (start, end) => {
      const params = new URLSearchParams();
      if (start) params.append('start', start);
      if (end) params.append('end', end);
      const qs = params.toString();
      const res = await fetch(`${BASE}/analytics/daily${qs ? '?' + qs : ''}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    monthly: async () => {
      const res = await fetch(`${BASE}/analytics/monthly`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    topCustomers: async (limit = 10) => {
      const res = await fetch(`${BASE}/analytics/top-customers?limit=${limit}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    investmentsByCategory: async () => {
      const res = await fetch(`${BASE}/analytics/investments-by-category`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    forecast: async () => {
      const res = await fetch(`${BASE}/analytics/forecast`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    monthlyReport: async (month) => {
      const res = await fetch(`${BASE}/analytics/monthly-report?month=${month}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    plStatement: async (month) => {
      const res = await fetch(`${BASE}/analytics/pl-statement?month=${month}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    getPricingRecommendations: async () => {
      const res = await fetch(`${BASE}/analytics/pricing-recommendations`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    getRestockPlan: async (horizonDays = 14) => {
      const res = await fetch(`${BASE}/analytics/restock-plan?horizon_days=${horizonDays}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    compare: async (p1Start, p1End, p2Start, p2End) => {
      const q = new URLSearchParams({
        p1_start: p1Start,
        p1_end: p1End,
        p2_start: p2Start,
        p2_end: p2End,
      });
      const res = await fetch(`${BASE}/analytics/compare?${q.toString()}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  investments: {
    list: async (params = {}) => {
      const clean = Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null)
      );
      const query = new URLSearchParams(clean).toString();
      const res = await fetch(`${BASE}/investments${query ? '?' + query : ''}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    create: async (data) => {
      const res = await fetch(`${BASE}/investments`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },

    update: async (id, data) => {
      const res = await fetch(`${BASE}/investments/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },

    remove: async (id) => {
      const res = await fetch(`${BASE}/investments/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    bulkUpload: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${BASE}/investments/bulk-upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      return handleResponse(res);
    },
  },

  products: {
    list: async () => {
      const res = await fetch(`${BASE}/products`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    create: async (data) => {
      const res = await fetch(`${BASE}/products`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },

    update: async (id, data) => {
      const res = await fetch(`${BASE}/products/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },

    remove: async (id) => {
      const res = await fetch(`${BASE}/products/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    bulkUpload: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${BASE}/products/bulk-upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      return handleResponse(res);
    },
  },

  staff: {
    list: async () => {
      const res = await fetch(`${BASE}/staff`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    create: async (data) => {
      const res = await fetch(`${BASE}/staff`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    remove: async (id) => {
      const res = await fetch(`${BASE}/staff/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  customers: {
    list: async (inactiveDays = 30) => {
      const res = await fetch(`${BASE}/customers?inactive_days=${inactiveDays}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    atRisk: async (inactiveDays = 30) => {
      const res = await fetch(`${BASE}/customers/at-risk?inactive_days=${inactiveDays}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    winBackPreview: async (payload) => {
      const res = await fetch(`${BASE}/customers/win-back/preview`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(res);
    },
  },

  ai: {
    insights: async () => {
      const res = await fetch(`${BASE}/ai/insights`, {
        method: 'POST',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    query: async (question) => {
      const res = await fetch(`${BASE}/ai/query`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ question }),
      });
      return handleResponse(res);
    },
  },

  sheets: {
    connect: async (sheet_id, credentials_json) => {
      const body = { sheet_id };
      if (credentials_json) body.credentials_json = credentials_json;
      const res = await fetch(`${BASE}/sheets/connect`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      return handleResponse(res);
    },

    sync: async () => {
      const res = await fetch(`${BASE}/sheets/sync`, {
        method: 'POST',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    importFromSheets: async () => {
      const res = await fetch(`${BASE}/sheets/import`, {
        method: 'POST',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  settings: {
    get: async () => {
      const res = await fetch(`${BASE}/settings`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    update: async (settings) => {
      const res = await fetch(`${BASE}/settings`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(settings),
      });
      return handleResponse(res);
    },
  },

  auditLog: {
    list: async (params = {}) => {
      const qs = new URLSearchParams();
      if (params.entity) qs.append('entity', params.entity);
      if (params.action) qs.append('action', params.action);
      if (params.search) qs.append('search', params.search);
      if (params.start_date) qs.append('start_date', params.start_date);
      if (params.end_date) qs.append('end_date', params.end_date);
      if (params.page) qs.append('page', params.page);
      if (params.limit) qs.append('limit', params.limit);
      const res = await fetch(`${BASE}/audit-log?${qs.toString()}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  admin: {
    getShops: async () => {
      const res = await fetch(`${BASE}/admin/shops`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    deleteShop: async (id) => {
      const res = await fetch(`${BASE}/admin/shops/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },
};

export default api;
