// Centralized API Client for MongoDB POS Backend

const API_BASE = 'https://inventory-bill-management.onrender.com/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  try {
    const res = await fetch(url, config);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP error ${res.status}`);
    }
    return data;
  } catch (error) {
    console.error(`API Request Error [${endpoint}]:`, error.message);
    throw error;
  }
}

// Authentication API
export const authApi = {
  login: (username, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  }),
  updatePassword: (currentPassword, newPassword, username) => request('/auth/update-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword, username })
  }),
  getProfile: () => request('/auth/profile')
};

// Products API
export const productApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/products${query ? `?${query}` : ''}`);
  },
  getById: (id) => request(`/products/${id}`),
  create: (product) => request('/products', {
    method: 'POST',
    body: JSON.stringify(product)
  }),
  update: (id, data) => request(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  delete: (id) => request(`/products/${id}`, {
    method: 'DELETE'
  }),
  clearAll: () => request('/products/clear-all', {
    method: 'DELETE'
  })
};

// Purchase Bills API
export const purchaseApi = {
  getAllBills: () => request('/purchases/bills'),
  getBillDetails: (billId) => request(`/purchases/bills/${billId}`),
  createBill: (billData) => request('/purchases/bills', {
    method: 'POST',
    body: JSON.stringify(billData)
  }),
  deleteBill: (id) => request(`/purchases/bills/${id}`, {
    method: 'DELETE'
  }),
  updateItem: (id, itemData) => request(`/purchases/items/${id}`, {
    method: 'PUT',
    body: JSON.stringify(itemData)
  }),
  deleteItem: (id) => request(`/purchases/items/${id}`, {
    method: 'DELETE'
  })
};

// Invoices API
export const invoiceApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/invoices${query ? `?${query}` : ''}`);
  },
  getNextNumber: () => request('/invoices/next-number'),
  getById: (id) => request(`/invoices/${id}`),
  create: (invoiceData) => request('/invoices', {
    method: 'POST',
    body: JSON.stringify(invoiceData)
  }),
  update: (id, invoiceData) => request(`/invoices/${id}`, {
    method: 'PUT',
    body: JSON.stringify(invoiceData)
  }),
  resetCounter: (sequenceValue = 0) => request('/invoices/reset-counter', {
    method: 'POST',
    body: JSON.stringify({ sequenceValue })
  }),
  repairInvoices: () => request('/invoices/repair', {
    method: 'POST'
  }),
  cancel: (id) => request(`/invoices/${id}/cancel`, {
    method: 'POST'
  }),
  delete: (id) => request(`/invoices/${id}`, {
    method: 'DELETE'
  })
};

// Settings API
export const settingsApi = {
  getAll: () => request('/settings'),
  updateSingle: (key, value) => request('/settings/single', {
    method: 'POST',
    body: JSON.stringify({ key, value })
  }),
  updateBulk: (settings) => request('/settings/bulk', {
    method: 'POST',
    body: JSON.stringify({ settings })
  })
};

// Migration & Health API
export const migrationApi = {
  getHealth: () => request('/migration/health'),
  importData: (payload) => request('/migration/import', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  exportData: () => request('/migration/export'),
  clearAllData: () => request('/migration/clear-all', {
    method: 'POST'
  })
};
