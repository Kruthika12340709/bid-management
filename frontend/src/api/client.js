// Tiny fetch-based HTTP client, axios-compatible enough for our call sites.
// No third-party deps — just the browser's native fetch API.

// Path-based routing convention: backend lives under /<agent-name>/...
// VITE_API_URL is inlined at build time (see Dockerfile). When unset (e.g.
// `npm run dev`) we fall back to the relative agent prefix and let the Vite
// proxy forward it to the FastAPI backend.
const BASE_URL = import.meta.env.VITE_API_URL || '/mei-aegis';
const TIMEOUT = 15000;

// Active role — set by Desktop.jsx whenever the user switches via the avatar
// dropdown. Read on every request so role-gated endpoints get enforced.
let activeRole = 'director';
export function setActiveRole(role) { activeRole = role || 'director'; }
export function getActiveRole() { return activeRole; }

async function request(method, path, { params, body, headers, responseType } = {}) {
  let url = BASE_URL + path;

  if (params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    }
    const s = qs.toString();
    if (s) url += (url.includes('?') ? '&' : '?') + s;
  }

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), TIMEOUT);

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': activeRole,
        Accept: responseType === 'text' ? 'text/html, text/plain' : 'application/json',
        ...(headers || {}),
      },
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(tid);
  }

  // Parse body. Default to JSON; allow forced text via responseType.
  let data;
  const contentType = res.headers.get('content-type') || '';
  if (responseType === 'text' || (!contentType.includes('application/json') && !contentType.includes('+json'))) {
    data = await res.text();
    if (responseType !== 'text' && data && contentType.includes('json') === false) {
      try { data = JSON.parse(data); } catch { /* keep as text */ }
    }
  } else {
    data = await res.json().catch(() => null);
  }

  if (!res.ok) {
    const err = new Error(
      (data && typeof data === 'object' && data.detail) || `HTTP ${res.status} ${res.statusText}`
    );
    err.response = { status: res.status, statusText: res.statusText, data };
    throw err;
  }

  return { data, status: res.status, headers: res.headers };
}

const client = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...(opts || {}), body }),
  put: (path, body, opts) => request('PUT', path, { ...(opts || {}), body }),
  patch: (path, body, opts) => request('PATCH', path, { ...(opts || {}), body }),
  delete: (path, opts) => request('DELETE', path, opts),
};

// ─── Typed API surface (unchanged) ──────────────────────────────────────────

export const bidsApi = {
  getAll: () => client.get('/bids/').then(r => r.data),
  getById: (ref) => client.get(`/bids/${ref}`).then(r => r.data),
  getSections: (ref) => client.get(`/bids/${ref}/sections`).then(r => r.data),
  getRisks: (ref) => client.get(`/bids/${ref}/risks`).then(r => r.data),
  getCompilationTelemetry: (ref) => client.get(`/bids/${ref}/compilation-telemetry`).then(r => r.data),
  routeToDirector: (ref, b) => client.post(`/bids/${ref}/route-to-director`, b).then(r => r.data),
  submit: (ref, b) => client.post(`/bids/${ref}/submit`, b).then(r => r.data),
  getPricingLines: (ref) => client.get(`/bids/${ref}/pricing-lines`).then(r => r.data),
  updateLineMargin: (ref, n, b) => client.post(`/bids/${ref}/pricing-lines/${n}/margin`, b).then(r => r.data),
  resolveMissingRate: (ref, n, b) => client.post(`/bids/${ref}/pricing-lines/${n}/resolve-rate`, b).then(r => r.data),
};

export const hilApi = {
  getQueue: () => client.get('/hil/queue').then(r => r.data),
  approveSection: (ref, key, body) => client.post(`/hil/${ref}/sections/${key}/approve`, body).then(r => r.data),
  editSection: (ref, key, body) => client.post(`/hil/${ref}/sections/${key}/edit`, body).then(r => r.data),
  rejectSection: (ref, key, body) => client.post(`/hil/${ref}/sections/${key}/reject`, body).then(r => r.data),
  marginOverride: (ref, body) => client.post(`/hil/${ref}/margin-override`, body).then(r => r.data),
  acknowledgeRisk: (ref, riskRef, body) => client.post(`/hil/${ref}/risks/${riskRef}/acknowledge`, body).then(r => r.data),
  signOff: (ref, body) => client.post(`/hil/${ref}/sign-off`, body).then(r => r.data),
  managerCoApprove: (ref, body) => client.post(`/hil/${ref}/manager-co-approve`, body).then(r => r.data),
};

export const auditApi = {
  list: (params = {}) => client.get('/audit/', { params }).then(r => r.data),
};

export const inputsApi = {
  list: () => client.get('/inputs/').then(r => r.data),
  requestMissing: (rfpId, cat) => client.post(`/inputs/${rfpId}/request-missing/${encodeURIComponent(cat)}`).then(r => r.data),
  confirmCompilation: (rfpId) => client.post(`/inputs/${rfpId}/confirm-compilation`).then(r => r.data),
  createFromJson: (data) => client.post('/inputs/create-from-json', data).then(r => r.data),
};

export const documentsApi = {
  listTemplates: () => client.get('/documents/templates').then(r => r.data),
  renderHtml: (ref) => client.get(`/documents/bids/${ref}/document`, { responseType: 'text' }).then(r => r.data),
  url: (ref) => `${BASE_URL}/documents/bids/${ref}/document?format=html`,
};

export const reportsApi = {
  dashboard: () => client.get('/reports/dashboard').then(r => r.data),
  compilationQuality: () => client.get('/reports/compilation-quality').then(r => r.data),
  pricingVariance: () => client.get('/reports/pricing-variance').then(r => r.data),
  approvalCorrection: () => client.get('/reports/approval-correction').then(r => r.data),
  outcomes: () => client.get('/reports/outcomes').then(r => r.data),
  riskProfile: () => client.get('/reports/risk-profile').then(r => r.data),
};

export default client;
