const rawBaseUrl = import.meta.env?.VITE_API_BASE_URL || '/api';
export const API_BASE_URL = rawBaseUrl.replace(/\/$/, '');

const TOKEN_STORAGE_KEY = 'dairytrace.authToken';
const USER_STORAGE_KEY = 'dairytrace.authUser';

let memoryToken = '';

export function getAuthToken() {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY) || memoryToken || '';
  } catch {
    return memoryToken || '';
  }
}

export function setAuthSession(token, user) {
  memoryToken = token || '';
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    if (user) {
      sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(USER_STORAGE_KEY);
    }
    // Remove legacy demo role flags if any existed
    sessionStorage.removeItem('dairytrace.demoRole');
    sessionStorage.removeItem('dairytrace.consumerBatchId');
  } catch {
    // Ignore storage quota / privacy errors
  }
}

export function getStoredUser() {
  try {
    const raw = sessionStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  memoryToken = '';
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(USER_STORAGE_KEY);
    sessionStorage.removeItem('dairytrace.demoRole');
    sessionStorage.removeItem('dairytrace.consumerBatchId');
  } catch {
    // Ignore
  }
}

function formatErrorDetail(payload, status) {
  if (!payload) {
    return `Request failed (${status}). Please check backend connection.`;
  }
  if (typeof payload.detail === 'string') {
    return payload.detail;
  }
  if (Array.isArray(payload.detail) && payload.detail.length > 0) {
    return payload.detail
      .map((item) => item?.msg || JSON.stringify(item))
      .join('; ');
  }
  if (typeof payload.message === 'string') {
    return payload.message;
  }
  return `Request failed (${status}).`;
}

export async function request(endpoint, options = {}) {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${path}`;
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  const token = getAuthToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (networkErr) {
    const err = new Error('Cannot reach DairyTrace API server. Make sure the backend is running.');
    err.status = 0;
    err.cause = networkErr;
    throw err;
  }

  if (response.status === 401 && !path.startsWith('/auth/login')) {
    clearAuthSession();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dairytrace:unauthorized'));
    }
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const error = new Error(formatErrorDetail(payload, response.status));
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }
  return response.json();
}

export const api = {
  // 1. System & Health
  async getHealth() {
    return request('/health');
  },

  // 2. Authentication
  async login(email, password) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data?.access_token) {
      setAuthSession(data.access_token, data.user || null);
    }
    return data;
  },

  async getMe() {
    return request('/auth/me');
  },

  logout() {
    clearAuthSession();
  },

  // 3. Batches, Lineage, QR & Distribution
  async getBatches({ productType, status } = {}) {
    const params = new URLSearchParams();
    if (productType) params.set('product_type', productType);
    if (status) params.set('status', status);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request(`/batches${qs}`);
  },

  async getBatch(batchId) {
    return request(`/batches/${encodeURIComponent(batchId)}`);
  },

  async lookupBatches(query) {
    return request(`/batches/lookup?q=${encodeURIComponent(query)}`);
  },

  async createBatch(batchData) {
    return request('/batches', {
      method: 'POST',
      body: JSON.stringify(batchData),
    });
  },

  async linkBatches(linkPayload) {
    return request('/batches/link', {
      method: 'POST',
      body: JSON.stringify(linkPayload),
    });
  },

  async getLineage(batchId) {
    const data = await request(`/batches/${encodeURIComponent(batchId)}/lineage`);
    return {
      ...data,
      allLinks: data.allLinks || data.edges || [],
      allDistributions: data.allDistributions || data.distributions || [],
      allBatches: data.allBatches || data.nodes || [],
    };
  },

  getBatchQrUrl(batchId, format = 'png') {
    return `${API_BASE_URL}/batches/${encodeURIComponent(batchId)}/qr?format=${encodeURIComponent(format)}`;
  },

  async getDistributions(batchId) {
    const qs = batchId ? `?batch_id=${encodeURIComponent(batchId)}` : '';
    return request(`/distribution${qs}`);
  },

  async createDistribution(payload) {
    return request('/distribution', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // 4. Quality & Evidence Records
  async getQualityRecords(batchId) {
    return request(`/quality/${encodeURIComponent(batchId)}`);
  },

  async addQualityRecord(recordData) {
    return request('/quality', {
      method: 'POST',
      body: JSON.stringify(recordData),
    });
  },

  // 5. Smart Recall Engine & FSSAI Export
  async simulateRecall(payload) {
    const targetId = payload.batch_id || payload.root_batch_id;
    const res = await request('/recall/simulate', {
      method: 'POST',
      body: JSON.stringify({
        batch_id: targetId,
        reason: payload.reason || 'Suspected food safety contamination',
      }),
    });
    const destinations = res.compromised_retail_destinations || [];
    const totalRisk =
      res.total_retail_units_at_risk ??
      res.total_retail_units ??
      destinations.reduce((acc, d) => acc + (Number(d.quantity_dispatched) || 0), 0);

    return {
      ...res,
      root_batch: res.root_batch || targetId,
      affected_product_batches: res.affected_product_batches || [],
      co_input_batches_for_review: res.co_input_batches_for_review || [],
      compromised_retail_destinations: destinations,
      total_retail_units: totalRisk,
      total_retail_units_at_risk: totalRisk,
    };
  },

  async executeRecall(payload) {
    const targetId = payload.batch_id || payload.root_batch_id;
    return request('/recall/execute', {
      method: 'POST',
      body: JSON.stringify({
        batch_id: targetId,
        reason: payload.reason || 'Confirmed food safety contamination',
        severity: payload.severity || 'CRITICAL',
      }),
    });
  },

  async getRecallHistory() {
    return request('/recall/history');
  },

  async getFssaiNotice(recallId = 1) {
    return request(`/recall/${encodeURIComponent(recallId)}/export-fssai`);
  },

  // 6. Security Inspections
  async getInspections(batchId) {
    const qs = batchId ? `?batch_id=${encodeURIComponent(batchId)}` : '';
    return request(`/inspections${qs}`);
  },

  async submitInspection(batchId, values) {
    const form = new FormData();
    Object.entries(values).forEach(([key, value]) => {
      if (key === 'evidence') {
        if (value) form.append('evidence', value);
      } else if (value !== undefined && value !== null) {
        form.append(key, String(value));
      }
    });
    return request(`/batches/${encodeURIComponent(batchId)}/inspections`, {
      method: 'POST',
      body: form,
    });
  },

  getEvidenceUrl(evidenceUrl) {
    if (!evidenceUrl) return '';
    if (/^https?:\/\//i.test(evidenceUrl)) return evidenceUrl;
    if (evidenceUrl.startsWith('/api/')) {
      const prefix = API_BASE_URL.replace(/\/api$/, '');
      return `${prefix}${evidenceUrl}`;
    }
    return `${API_BASE_URL}${evidenceUrl.startsWith('/') ? '' : '/'}${evidenceUrl}`;
  },

  async openEvidence(evidenceUrl) {
    const url = this.getEvidenceUrl(evidenceUrl);
    if (!url) return;
    const token = getAuthToken();
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      throw new Error('Could not load inspection photo evidence.');
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  },

  // 7. Public Consumer Passport
  async getPublicPassport(batchId) {
    return request(`/public/passport/${encodeURIComponent(batchId)}`);
  },

  // 8. Ported AI Customer Complaint Management System
  async getComplaintBatchContext(batchId) {
    return request(`/complaints/context/${encodeURIComponent(batchId)}`);
  },

  async processComplaint(batchId, text, currentForm) {
    return request('/copilot/process', {
      method: 'POST',
      body: JSON.stringify({
        batchId,
        text,
        current_form: currentForm,
      }),
    });
  },

  async uploadComplaint(batchId, file, currentForm) {
    const formData = new FormData();
    formData.append('batchId', batchId);
    formData.append('file', file);
    formData.append('current_form', JSON.stringify(currentForm || {}));
    return request('/copilot/upload', {
      method: 'POST',
      body: formData,
    });
  },

  async commitComplaint({ batchId, form, risk = null, rootCause = null, capaRecommendations = [] }) {
    return request('/complaints/commit', {
      method: 'POST',
      body: JSON.stringify({
        batchId,
        form,
        risk,
        rootCause,
        capaRecommendations,
      }),
    });
  },

  async getComplaints({ batchId, status } = {}) {
    const params = new URLSearchParams();
    if (batchId) params.set('batch_id', batchId);
    if (status) params.set('status', status);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request(`/complaints${qs}`);
  },

  async getComplaint(complaintId) {
    return request(`/complaints/${encodeURIComponent(complaintId)}`);
  },

  async updateComplaint(complaintId, { batchId, form, risk = null, rootCause = null, capaRecommendations = [] }) {
    return request(`/complaints/${encodeURIComponent(complaintId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        batchId,
        form,
        risk,
        rootCause,
        capaRecommendations,
      }),
    });
  },

  async updateComplaintStatus(complaintId, status) {
    return request(`/complaints/${encodeURIComponent(complaintId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async deleteComplaint(complaintId) {
    return request(`/complaints/${encodeURIComponent(complaintId)}`, {
      method: 'DELETE',
    });
  },
};

export default api;
