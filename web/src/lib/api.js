import { session } from './session.js';

export class ApiError extends Error {
  constructor(message, { status, errors = [], fieldErrors = {} } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.fieldErrors = fieldErrors;
  }
}

async function request(method, path, body) {
  const init = { method, credentials: 'same-origin', headers: {} };
  const token = session.get();
  if (token) init.headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`/admin/api${path}`, init);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  // An expired or invalid token ends the session; login/register failures are handled by the caller.
  if (res.status === 401 && !path.startsWith('/auth/')) {
    session.clear();
    window.location.replace('/admin/login');
    return null;
  }
  if (!res.ok) {
    const errors = data.errors ?? (data.error ? [data.error] : []);
    throw new ApiError(errors.join(' ') || `Request failed (${res.status}).`, {
      status: res.status,
      errors,
      fieldErrors: data.fieldErrors ?? {},
    });
  }
  return data;
}

export const api = {
  auth: {
    register: (values) => request('POST', '/auth/register', values),
    login: (values) => request('POST', '/auth/login', values),
    me: () => request('GET', '/auth/me'),
    updateProfile: (values) => request('PUT', '/auth/profile', values),
    changePassword: (values) => request('POST', '/auth/change-password', values),
  },
  companies: {
    list: () => request('GET', '/companies'),
    get: (id) => request('GET', `/companies/${id}`),
    create: (values) => request('POST', '/companies', values),
    update: (id, values) => request('PUT', `/companies/${id}`, values),
    remove: (id) => request('DELETE', `/companies/${id}`),
    uploadIcon: (id, icon) => request('POST', `/companies/${id}/icon`, { icon }),
    removeIcon: (id) => request('DELETE', `/companies/${id}/icon`),
    admins: (id) => request('GET', `/companies/${id}/admins`),
    addAdmin: (id, email) => request('POST', `/companies/${id}/admins`, { email }),
    removeAdmin: (id, userId) => request('DELETE', `/companies/${id}/admins/${userId}`),
  },
  employees: {
    create: (companyId, values) => request('POST', `/companies/${companyId}/employees`, values),
    get: (id) => request('GET', `/employees/${id}`),
    update: (id, values) => request('PUT', `/employees/${id}`, values),
    rotateToken: (id) => request('POST', `/employees/${id}/rotate-token`),
    uploadPhoto: (id, photo) => request('POST', `/employees/${id}/photo`, { photo }),
    removePhoto: (id) => request('DELETE', `/employees/${id}/photo`),
    remove: (id) => request('DELETE', `/employees/${id}`),
  },
};
