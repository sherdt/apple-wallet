import { createHash, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { buildPass } from './pass.js';
import { fetchCompanyIcon, passIcons } from './icon.js';
import { buildVCard } from './vcard.js';
import { validateCompany, validateEmployee } from './validation.js';
import * as views from './views.js';

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const ADMIN_DIR = join(PUBLIC_DIR, 'admin');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DUPLICATE_COMPANY = 'A company with this name already exists.';
const STATIC_ASSETS = {
  '/assets/app.css': { file: 'app.css', type: 'text/css; charset=utf-8' },
};

const digest = (value) => createHash('sha256').update(value).digest();
const safeEqual = (a, b) => timingSafeEqual(digest(a), digest(b));

// Returns true only if the Authorization header carries the configured credentials.
// Both comparisons always run, so a failing username does not short-circuit the check.
function isAuthorized(header, { adminUser, adminPassword }) {
  if (!header?.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const sep = decoded.indexOf(':');
  if (sep < 0) return false;
  const user = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);
  const userOk = safeEqual(user, adminUser);
  const passOk = safeEqual(pass, adminPassword);
  return userOk && passOk;
}

const slugify = (text) =>
  text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'card';

const isUniqueViolation = (err) => err?.code === '23505';

export async function buildApp({ config, repo, certificates, icons }) {
  const staticAssets = await Promise.all(
    Object.entries(STATIC_ASSETS).map(async ([route, asset]) => [
      route,
      { type: asset.type, body: await readFile(join(PUBLIC_DIR, asset.file), 'utf8') },
    ]),
  );
  const assetMap = new Map(staticAssets);
  const adminBuilt = existsSync(join(ADMIN_DIR, 'index.html'));

  const app = Fastify({ logger: true, trustProxy: true, bodyLimit: 16 * 1024 });

  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/admin')) return;
    if (!isAuthorized(request.headers.authorization, config)) {
      return reply
        .code(401)
        .header('WWW-Authenticate', 'Basic realm="Wallet admin", charset="UTF-8"')
        .type('text/plain')
        .send('Authentication required');
    }
    // Browsers send Origin on writes. Reject writes that come from another site.
    if (request.method !== 'GET' && request.headers.origin !== undefined &&
        request.headers.origin !== config.publicOrigin) {
      return reply.code(403).send({
        error: `Blocked: this request came from ${request.headers.origin}. Open the admin at ${config.publicOrigin}.`,
      });
    }
  });

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'same-origin');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; style-src 'self'; img-src 'self' data:; script-src 'self'; " +
        "form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    );
    return payload;
  });

  app.setErrorHandler((err, request, reply) => {
    const status = err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
    if (status === 500) request.log.error(err);
    reply.code(status).send({ error: status === 500 ? 'Internal server error' : err.message });
  });

  if (adminBuilt) {
    await app.register(fastifyStatic, { root: ADMIN_DIR, prefix: '/admin/', wildcard: true });
  }

  // Unknown /admin paths get the SPA shell so client-side routes survive a reload.
  // Unknown API paths get a JSON 404.
  app.setNotFoundHandler(async (request, reply) => {
    const isAdminPage = request.method === 'GET' && request.url.startsWith('/admin') &&
      !request.url.startsWith('/admin/api');
    if (isAdminPage && adminBuilt) return reply.type('text/html; charset=utf-8').sendFile('index.html');
    if (isAdminPage) return reply.code(503).type('text/plain').send('Admin UI not built. Run npm run build:web.');
    return reply.code(404).type('text/plain').send('Not found');
  });

  async function findCompany(id, reply) {
    const company = UUID.test(id) ? await repo.getCompany(id) : null;
    if (!company) reply.code(404);
    return company;
  }

  async function findEmployee(id, reply) {
    const employee = UUID.test(id) ? await repo.getEmployee(id) : null;
    if (!employee) reply.code(404);
    return employee;
  }

  const notFound = (reply, what) => reply.code(404).send({ error: `${what} not found.` });

  app.get('/', async (request, reply) => reply.redirect('/admin', 303));
  app.get('/healthz', async () => ({ status: 'ok' }));
  app.get('/readyz', async (request, reply) => {
    try {
      await repo.ping();
      return { status: 'ok' };
    } catch {
      return reply.code(503).send({ status: 'unavailable' });
    }
  });

  app.get('/assets/*', async (request, reply) => {
    const asset = assetMap.get(request.url.split('?')[0]);
    if (!asset) return reply.code(404).type('text/plain').send('Not found');
    return reply.type(asset.type).header('Cache-Control', 'no-cache').send(asset.body);
  });

  // ---- Admin API (JSON) ----

  const api = '/admin/api';
  const validationError = (reply, { errors, fieldErrors }) => reply.code(400).send({ errors, fieldErrors });

  // Stores the icon fetched from the website, or clears it when none is found.
  async function refreshIcon(company) {
    const icon = company.website ? await fetchCompanyIcon(company.website) : null;
    await repo.setCompanyIcon(company.id, icon);
    return icon !== null;
  }

  app.get(`${api}/companies`, async () => repo.listCompanies());

  app.post(`${api}/companies`, async (request, reply) => {
    const checked = validateCompany(request.body ?? {});
    if (checked.errors.length) return validationError(reply, checked);
    try {
      const company = await repo.createCompany(checked.values);
      company.has_icon = await refreshIcon(company);
      return reply.code(201).send(company);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      return reply.code(409).send({ errors: [DUPLICATE_COMPANY], fieldErrors: { name: DUPLICATE_COMPANY } });
    }
  });

  app.get(`${api}/companies/:id`, async (request, reply) => {
    const company = await findCompany(request.params.id, reply);
    if (!company) return notFound(reply, 'Company');
    return { company, employees: await repo.listEmployees(company.id) };
  });

  app.put(`${api}/companies/:id`, async (request, reply) => {
    const company = await findCompany(request.params.id, reply);
    if (!company) return notFound(reply, 'Company');
    const checked = validateCompany(request.body ?? {});
    if (checked.errors.length) return validationError(reply, checked);
    try {
      const updated = await repo.updateCompany(company.id, checked.values);
      if (updated.website !== company.website) updated.has_icon = await refreshIcon(updated);
      return updated;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      return reply.code(409).send({ errors: [DUPLICATE_COMPANY], fieldErrors: { name: DUPLICATE_COMPANY } });
    }
  });

  app.get(`${api}/companies/:id/icon`, async (request, reply) => {
    const company = await findCompany(request.params.id, reply);
    if (!company) return notFound(reply, 'Company');
    const icon = await repo.getCompanyIcon(company.id);
    if (!icon) return reply.code(404).send({ errors: ['No icon'] });
    return reply.type('image/png').header('Cache-Control', 'no-store').send(icon);
  });

  app.post(`${api}/companies/:id/icon`, async (request, reply) => {
    const company = await findCompany(request.params.id, reply);
    if (!company) return notFound(reply, 'Company');
    return { has_icon: await refreshIcon(company) };
  });

  app.delete(`${api}/companies/:id`, async (request, reply) => {
    const company = await findCompany(request.params.id, reply);
    if (!company) return notFound(reply, 'Company');
    await repo.deleteCompany(company.id);
    return reply.code(204).send();
  });

  app.post(`${api}/companies/:id/employees`, async (request, reply) => {
    const company = await findCompany(request.params.id, reply);
    if (!company) return notFound(reply, 'Company');
    const checked = validateEmployee(request.body ?? {});
    if (checked.errors.length) return validationError(reply, checked);
    return reply.code(201).send(await repo.createEmployee(company.id, checked.values));
  });

  // Returns the employee with its company and the public origin, so the client can build card links.
  app.get(`${api}/employees/:id`, async (request, reply) => {
    const employee = await findEmployee(request.params.id, reply);
    if (!employee) return notFound(reply, 'Employee');
    const company = await repo.getCompany(employee.company_id);
    return { employee, company, origin: config.publicOrigin };
  });

  app.put(`${api}/employees/:id`, async (request, reply) => {
    const employee = await findEmployee(request.params.id, reply);
    if (!employee) return notFound(reply, 'Employee');
    const checked = validateEmployee(request.body ?? {});
    if (checked.errors.length) return validationError(reply, checked);
    return repo.updateEmployee(employee.id, checked.values);
  });

  app.post(`${api}/employees/:id/rotate-token`, async (request, reply) => {
    const employee = await findEmployee(request.params.id, reply);
    if (!employee) return notFound(reply, 'Employee');
    return repo.rotateEmployeeToken(employee.id);
  });

  app.delete(`${api}/employees/:id`, async (request, reply) => {
    const employee = await findEmployee(request.params.id, reply);
    if (!employee) return notFound(reply, 'Employee');
    await repo.deleteEmployee(employee.id);
    return reply.code(204).send();
  });

  // ---- Public ----
  // One route handles /p/:file so the token and suffix are parsed explicitly.
  // Tokens are base64url and never contain a dot, so the suffix is unambiguous.

  app.get('/p/:file', async (request, reply) => {
    const file = request.params.file;
    const suffix = file.endsWith('.pkpass') ? 'pkpass' : file.endsWith('.vcf') ? 'vcf' : 'html';
    const token = suffix === 'html' ? file : file.slice(0, -(suffix.length + 1));
    const employee = /^[A-Za-z0-9_-]{20,64}$/.test(token) ? await repo.getEmployeeByToken(token) : null;
    if (!employee) return reply.code(404).type('text/html; charset=utf-8').send(String(views.notFoundPage()));
    const company = employee.company;
    const slug = slugify(employee.name);

    if (suffix === 'html') {
      return reply.type('text/html; charset=utf-8').send(String(views.publicCardPage({ employee, company })));
    }
    if (suffix === 'vcf') {
      return reply
        .type('text/vcard; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${slug}.vcf"`)
        .header('Cache-Control', 'no-store')
        .send(buildVCard(employee, company));
    }
    const storedIcon = await repo.getCompanyIcon(company.id);
    const body = buildPass({ employee, company, config, certificates, icons: await passIcons(storedIcon, icons) });
    return reply
      .type('application/vnd.apple.pkpass')
      .header('Content-Disposition', `attachment; filename="${slug}.pkpass"`)
      .header('Cache-Control', 'no-store')
      .send(body);
  });

  return app;
}
