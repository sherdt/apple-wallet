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
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`/admin/api${path}`, init);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
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
  companies: {
    list: () => request('GET', '/companies'),
    get: (id) => request('GET', `/companies/${id}`),
    create: (values) => request('POST', '/companies', values),
    update: (id, values) => request('PUT', `/companies/${id}`, values),
    remove: (id) => request('DELETE', `/companies/${id}`),
  },
  employees: {
    create: (companyId, values) => request('POST', `/companies/${companyId}/employees`, values),
    get: (id) => request('GET', `/employees/${id}`),
    update: (id, values) => request('PUT', `/employees/${id}`, values),
    rotateToken: (id) => request('POST', `/employees/${id}/rotate-token`),
    remove: (id) => request('DELETE', `/employees/${id}`),
  },
};
