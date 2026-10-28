import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { escapeValue, buildVCard } from '../src/vcard.js';
import { validateCompany, validateEmployee } from '../src/validation.js';
import { buildPass, loadIcons } from '../src/pass.js';
import { buildApp } from '../src/app.js';
import { html, raw } from '../src/views.js';

const company = { id: randomUUID(), owner_id: randomUUID(), name: 'PRODYNA SE', website: 'https://www.prodyna.com/' };
const employee = {
  id: randomUUID(),
  token: 'abcdefghijklmnopqrstuvwx',
  name: 'Max Mustermann',
  job_title: 'Consultant',
  email: 'max@prodyna.com',
  mobile: null,
};

test('escapeValue escapes vCard special characters', () => {
  assert.equal(escapeValue('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
});

test('buildVCard emits CRLF-terminated vCard 3.0', () => {
  const card = buildVCard(employee, company);
  assert.ok(card.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n'));
  assert.ok(card.endsWith('END:VCARD\r\n'));
  assert.ok(card.includes('FN:Max Mustermann\r\n'));
  assert.ok(card.includes('ORG:PRODYNA SE\r\n'));
  assert.ok(!card.includes('CELL'));
  assert.ok(!card.includes('TEL;TYPE=WORK'));
});

test('validateCompany accepts good input and rejects bad input', () => {
  const ok = validateCompany({ name: ' PRODYNA SE ', website: 'https://example.com' });
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.values.name, 'PRODYNA SE');
  const bad = validateCompany({ name: '', website: 'javascript:alert(1)' });
  assert.equal(bad.errors.length, 2);
});

test('validateEmployee checks email and required names', () => {
  assert.deepEqual(validateEmployee({ name: 'A B', email: '' }).errors, []);
  assert.equal(validateEmployee({ name: 'A B', email: 'nope' }).errors.length, 1);
  assert.equal(validateEmployee({ name: '' }).errors.length, 1);
});

test('html escapes interpolations and keeps nested fragments', () => {
  const out = String(html`<p>${'<b>x</b>'}${raw('<i>ok</i>')}${['<u>', raw('<s>')]}</p>`);
  assert.equal(out, '<p>&lt;b&gt;x&lt;/b&gt;<i>ok</i>&lt;u&gt;<s></p>');
});

// Creates a throwaway self-signed signing identity. Real Apple certs are not needed
// for the structural checks below.
function makeCerts() {
  const dir = mkdtempSync(join(tmpdir(), 'wallet-test-'));
  const key = join(dir, 'key.pem');
  const cert = join(dir, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=test'], { stdio: 'ignore' });
  const certPem = readFileSync(cert);
  return { wwdr: certPem, signerCert: certPem, signerKey: readFileSync(key) };
}

const config = {
  publicOrigin: 'http://localhost:3000',
  passTypeIdentifier: 'pass.test.wallet',
  teamIdentifier: 'TEAM123456',
  jwtSecret: 'test-secret-that-is-at-least-32-characters-long',
};

// In-memory stand-in for the PostgreSQL repository, including per-owner scoping.
function fakeRepo() {
  const users = new Map();
  const companies = new Map([[company.id, { ...company }]]);
  const employees = new Map([[employee.id, { ...employee, company_id: company.id }]]);
  const ownedCompany = (id, ownerId) => {
    const row = companies.get(id);
    return row && row.owner_id === ownerId ? row : null;
  };
  return {
    companies,
    employees,
    async ping() {},
    async createUser({ email, passwordHash }) {
      if ([...users.values()].some((u) => u.email === email)) {
        throw Object.assign(new Error('duplicate'), { code: '23505' });
      }
      const row = { id: randomUUID(), email, password_hash: passwordHash, created_at: new Date() };
      users.set(row.id, row);
      return { id: row.id, email, created_at: row.created_at };
    },
    async findUserByEmail(email) {
      return [...users.values()].find((u) => u.email === email) ?? null;
    },
    async getUserPasswordHash(id) {
      return users.get(id)?.password_hash ?? null;
    },
    async setUserPasswordHash(id, passwordHash) {
      users.get(id).password_hash = passwordHash;
    },
    async getUser(id) {
      const u = users.get(id);
      return u ? { id: u.id, email: u.email, name: u.name ?? null, created_at: u.created_at } : null;
    },
    async updateUserName(id, name) {
      const u = users.get(id);
      if (!u) return null;
      u.name = name;
      return { id: u.id, email: u.email, name, created_at: u.created_at };
    },
    async listCompanies(ownerId) {
      return [...companies.values()]
        .filter((c) => c.owner_id === ownerId)
        .map((c) => ({ ...c, employee_count: 0 }));
    },
    async getCompany(id, ownerId) {
      return ownedCompany(id, ownerId);
    },
    async createCompany(values, ownerId) {
      const row = { id: randomUUID(), ...values, owner_id: ownerId };
      companies.set(row.id, row);
      return row;
    },
    async updateCompany(id, values) {
      const row = { ...companies.get(id), ...values };
      companies.set(id, row);
      return row;
    },
    async deleteCompany(id) {
      companies.delete(id);
    },
    async getCompanyIcon() {
      return null;
    },
    async setCompanyIcon() {},
    async listEmployees(companyId) {
      return [...employees.values()].filter((e) => e.company_id === companyId);
    },
    async getEmployee(id, ownerId) {
      const row = employees.get(id);
      return row && ownedCompany(row.company_id, ownerId) ? row : null;
    },
    async getEmployeeByToken(token) {
      const e = [...employees.values()].find((x) => x.token === token);
      return e ? { ...e, company: companies.get(e.company_id) } : null;
    },
    async createEmployee(companyId, values) {
      const row = { id: randomUUID(), company_id: companyId, token: 'tok'.padEnd(24, 'x'), ...values };
      employees.set(row.id, row);
      return row;
    },
    async updateEmployee(id, values) {
      const row = { ...employees.get(id), ...values };
      employees.set(id, row);
      return row;
    },
    async rotateEmployeeToken(id) {
      const row = { ...employees.get(id), token: 'rotated'.padEnd(24, 'y') };
      employees.set(id, row);
      return row;
    },
    async deleteEmployee(id) {
      employees.delete(id);
    },
  };
}

test('buildPass produces a signed pkpass archive', async () => {
  const body = buildPass({
    employee,
    company,
    config,
    certificates: makeCerts(),
    icons: await loadIcons(),
  });
  assert.equal(body.subarray(0, 2).toString(), 'PK');
});

const JSON_HEADERS = { origin: config.publicOrigin, 'content-type': 'application/json' };
const PASSWORD = 'correct horse battery';

// Registers a new account and returns headers that authenticate as it.
async function signIn(app, email = `${randomUUID()}@example.com`) {
  const res = await app.inject({
    method: 'POST', url: '/admin/api/auth/register', headers: JSON_HEADERS,
    payload: JSON.stringify({ email, password: PASSWORD, confirmPassword: PASSWORD }),
  });
  assert.equal(res.statusCode, 201);
  return { ...JSON_HEADERS, authorization: `Bearer ${res.json().token}` };
}

// Body-less requests must not send a JSON content type, or Fastify rejects them.
const bodyless = ({ 'content-type': _ignored, ...headers }) => headers;

test('admin API requires a JWT and rejects cross-origin writes', async () => {
  const app = await buildApp({ config, repo: fakeRepo(), certificates: makeCerts(), icons: await loadIcons() });
  const anon = await app.inject({ url: '/admin/api/companies' });
  assert.equal(anon.statusCode, 401);
  const badToken = await app.inject({
    url: '/admin/api/companies',
    headers: { authorization: 'Bearer not-a-token' },
  });
  assert.equal(badToken.statusCode, 401);
  const headers = await signIn(app);
  const crossOrigin = await app.inject({
    method: 'POST', url: '/admin/api/companies',
    headers: { ...headers, origin: 'https://evil.example' },
    payload: JSON.stringify({ name: 'x' }),
  });
  assert.equal(crossOrigin.statusCode, 403);
  assert.match(crossOrigin.json().error, /Blocked/);
  await app.close();
});

test('register, login and me issue and check tokens', async () => {
  const app = await buildApp({ config, repo: fakeRepo(), certificates: makeCerts(), icons: await loadIcons() });
  const email = 'Owner@Example.com';

  const reg = await app.inject({
    method: 'POST', url: '/admin/api/auth/register', headers: JSON_HEADERS,
    payload: JSON.stringify({ email, password: PASSWORD, confirmPassword: PASSWORD }),
  });
  assert.equal(reg.statusCode, 201);
  assert.equal(reg.json().user.email, 'owner@example.com');
  assert.ok(reg.json().token);
  assert.equal(reg.json().user.password_hash, undefined);

  const dup = await app.inject({
    method: 'POST', url: '/admin/api/auth/register', headers: JSON_HEADERS,
    payload: JSON.stringify({ email, password: PASSWORD, confirmPassword: PASSWORD }),
  });
  assert.equal(dup.statusCode, 409);
  assert.ok(dup.json().fieldErrors.email);

  const short = await app.inject({
    method: 'POST', url: '/admin/api/auth/register', headers: JSON_HEADERS,
    payload: JSON.stringify({ email: 'other@example.com', password: 'short', confirmPassword: 'short' }),
  });
  assert.equal(short.statusCode, 400);
  assert.ok(short.json().fieldErrors.password);

  const mismatch = await app.inject({
    method: 'POST', url: '/admin/api/auth/register', headers: JSON_HEADERS,
    payload: JSON.stringify({ email: 'typo@example.com', password: PASSWORD, confirmPassword: 'correct horse batery' }),
  });
  assert.equal(mismatch.statusCode, 400);
  assert.ok(mismatch.json().fieldErrors.confirmPassword);

  const wrong = await app.inject({
    method: 'POST', url: '/admin/api/auth/login', headers: JSON_HEADERS,
    payload: JSON.stringify({ email, password: 'wrong password' }),
  });
  assert.equal(wrong.statusCode, 401);
  const unknown = await app.inject({
    method: 'POST', url: '/admin/api/auth/login', headers: JSON_HEADERS,
    payload: JSON.stringify({ email: 'nobody@example.com', password: PASSWORD }),
  });
  assert.equal(unknown.statusCode, 401);
  assert.equal(unknown.json().error, wrong.json().error);

  const login = await app.inject({
    method: 'POST', url: '/admin/api/auth/login', headers: JSON_HEADERS,
    payload: JSON.stringify({ email, password: PASSWORD }),
  });
  assert.equal(login.statusCode, 200);
  const me = await app.inject({
    url: '/admin/api/auth/me', headers: { authorization: `Bearer ${login.json().token}` },
  });
  assert.equal(me.statusCode, 200);
  assert.equal(me.json().email, 'owner@example.com');

  const noToken = await app.inject({ url: '/admin/api/auth/me' });
  assert.equal(noToken.statusCode, 401);
  await app.close();
});

test('profile stores the real name and rejects blank names', async () => {
  const app = await buildApp({ config, repo: fakeRepo(), certificates: makeCerts(), icons: await loadIcons() });
  const headers = await signIn(app);
  const blank = await app.inject({
    method: 'PUT', url: '/admin/api/auth/profile', headers,
    payload: JSON.stringify({ name: '   ' }),
  });
  assert.equal(blank.statusCode, 400);
  assert.ok(blank.json().fieldErrors.name);

  const ok = await app.inject({
    method: 'PUT', url: '/admin/api/auth/profile', headers,
    payload: JSON.stringify({ name: '  Sergej Herdt ' }),
  });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.json().name, 'Sergej Herdt');
  const me = await app.inject({ url: '/admin/api/auth/me', headers });
  assert.equal(me.json().name, 'Sergej Herdt');
  await app.close();
});

test('change-password requires the current password and a matching repeat', async () => {
  const app = await buildApp({ config, repo: fakeRepo(), certificates: makeCerts(), icons: await loadIcons() });
  const email = `${randomUUID()}@example.com`;
  const headers = await signIn(app, email);
  const NEW = 'a brand new passphrase';
  const change = (payload) => app.inject({
    method: 'POST', url: '/admin/api/auth/change-password', headers,
    payload: JSON.stringify(payload),
  });

  const wrongCurrent = await change({ currentPassword: 'nope nope nope', newPassword: NEW, confirmPassword: NEW });
  assert.equal(wrongCurrent.statusCode, 400);
  assert.ok(wrongCurrent.json().fieldErrors.currentPassword);

  const mismatch = await change({ currentPassword: PASSWORD, newPassword: NEW, confirmPassword: `${NEW}!` });
  assert.equal(mismatch.statusCode, 400);
  assert.ok(mismatch.json().fieldErrors.confirmPassword);

  const ok = await change({ currentPassword: PASSWORD, newPassword: NEW, confirmPassword: NEW });
  assert.equal(ok.statusCode, 204);

  const oldLogin = await app.inject({
    method: 'POST', url: '/admin/api/auth/login', headers: JSON_HEADERS,
    payload: JSON.stringify({ email, password: PASSWORD }),
  });
  assert.equal(oldLogin.statusCode, 401);
  await app.close();
});

test('companies are visible only to the user who created them', async () => {
  const app = await buildApp({ config, repo: fakeRepo(), certificates: makeCerts(), icons: await loadIcons() });
  const alice = await signIn(app);
  const bob = await signIn(app);

  const created = await app.inject({
    method: 'POST', url: '/admin/api/companies', headers: alice, payload: JSON.stringify({ name: 'Acme' }),
  });
  assert.equal(created.statusCode, 201);
  const acme = created.json();

  const bobList = await app.inject({ url: '/admin/api/companies', headers: bodyless(bob) });
  assert.deepEqual(bobList.json(), []);

  const bobGet = await app.inject({ url: `/admin/api/companies/${acme.id}`, headers: bodyless(bob) });
  assert.equal(bobGet.statusCode, 404);
  const bobPut = await app.inject({
    method: 'PUT', url: `/admin/api/companies/${acme.id}`, headers: bob, payload: JSON.stringify({ name: 'Hijacked' }),
  });
  assert.equal(bobPut.statusCode, 404);
  const bobDelete = await app.inject({ method: 'DELETE', url: `/admin/api/companies/${acme.id}`, headers: bodyless(bob) });
  assert.equal(bobDelete.statusCode, 404);

  const aliceGet = await app.inject({ url: `/admin/api/companies/${acme.id}`, headers: bodyless(alice) });
  assert.equal(aliceGet.statusCode, 200);
  assert.equal(aliceGet.json().company.name, 'Acme');
  await app.close();
});

test('admin API creates, validates, updates and deletes companies', async () => {
  const repo = fakeRepo();
  const app = await buildApp({ config, repo, certificates: makeCerts(), icons: await loadIcons() });
  const headers = await signIn(app);

  const created = await app.inject({ method: 'POST', url: '/admin/api/companies', headers, payload: JSON.stringify({ name: 'Acme' }) });
  assert.equal(created.statusCode, 201);
  const acme = created.json();
  assert.equal(acme.name, 'Acme');

  const bad = await app.inject({ method: 'POST', url: '/admin/api/companies', headers, payload: JSON.stringify({ name: '', website: 'javascript:x' }) });
  assert.equal(bad.statusCode, 400);
  assert.ok(bad.json().fieldErrors.name);
  assert.ok(bad.json().fieldErrors.website);

  const list = await app.inject({ url: '/admin/api/companies', headers: bodyless(headers) });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().some((c) => c.id === acme.id));

  const updated = await app.inject({ method: 'PUT', url: `/admin/api/companies/${acme.id}`, headers, payload: JSON.stringify({ name: 'Acme Two' }) });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.json().name, 'Acme Two');

  const missing = await app.inject({ url: '/admin/api/companies/not-a-uuid', headers: bodyless(headers) });
  assert.equal(missing.statusCode, 404);

  const deleted = await app.inject({ method: 'DELETE', url: `/admin/api/companies/${acme.id}`, headers: bodyless(headers) });
  assert.equal(deleted.statusCode, 204);
  await app.close();
});

test('admin API flow creates an employee and public routes serve the card', async () => {
  const app = await buildApp({ config, repo: fakeRepo(), certificates: makeCerts(), icons: await loadIcons() });
  const headers = await signIn(app);
  const companyRes = await app.inject({ method: 'POST', url: '/admin/api/companies', headers, payload: JSON.stringify({ name: 'Flow Co' }) });
  const flowCompany = companyRes.json();

  const addEmp = await app.inject({
    method: 'POST', url: `/admin/api/companies/${flowCompany.id}/employees`, headers,
    payload: JSON.stringify({ name: 'Erika Musterfrau', email: 'erika@example.com' }),
  });
  assert.equal(addEmp.statusCode, 201);
  const emp = addEmp.json();

  const detail = await app.inject({ url: `/admin/api/employees/${emp.id}`, headers: bodyless(headers) });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().company.id, flowCompany.id);
  assert.equal(detail.json().origin, config.publicOrigin);

  const stranger = await signIn(app);
  const foreign = await app.inject({ url: `/admin/api/employees/${emp.id}`, headers: bodyless(stranger) });
  assert.equal(foreign.statusCode, 404);

  const card = await app.inject({ url: `/p/${emp.token}` });
  assert.equal(card.statusCode, 200);
  assert.match(card.body, /Erika Musterfrau/);

  const vcf = await app.inject({ url: `/p/${emp.token}.vcf` });
  assert.equal(vcf.headers['content-type'], 'text/vcard; charset=utf-8');

  const pass = await app.inject({ url: `/p/${emp.token}.pkpass` });
  assert.equal(pass.headers['content-type'], 'application/vnd.apple.pkpass');
  assert.equal(pass.rawPayload.subarray(0, 2).toString(), 'PK');

  const missing = await app.inject({ url: '/p/doesnotexist000000000000000.pkpass' });
  assert.equal(missing.statusCode, 404);

  const rotated = await app.inject({ method: 'POST', url: `/admin/api/employees/${emp.id}/rotate-token`, headers: bodyless(headers) });
  assert.equal(rotated.statusCode, 200);
  assert.notEqual(rotated.json().token, emp.token);
  const oldLink = await app.inject({ url: `/p/${emp.token}.vcf` });
  assert.equal(oldLink.statusCode, 404);

  const badEmail = await app.inject({
    method: 'POST', url: `/admin/api/companies/${flowCompany.id}/employees`, headers,
    payload: JSON.stringify({ name: 'A', email: 'nope' }),
  });
  assert.equal(badEmail.statusCode, 400);

  const removed = await app.inject({ method: 'DELETE', url: `/admin/api/employees/${emp.id}`, headers: bodyless(headers) });
  assert.equal(removed.statusCode, 204);
  await app.close();
});

test('API responses and public pages carry security headers', async () => {
  const app = await buildApp({ config, repo: fakeRepo(), certificates: makeCerts(), icons: await loadIcons() });
  const headers = await signIn(app);
  const res = await app.inject({ url: '/admin/api/companies', headers: bodyless(headers) });
  assert.match(res.headers['content-security-policy'], /script-src 'self'/);
  assert.equal(res.headers['x-frame-options'], 'DENY');
  await app.close();
});

test('isPublicAddress rejects private, loopback and mapped internal addresses', async () => {
  const { isPublicAddress } = await import('../src/icon.js');
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.1.5', '172.20.0.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:10.0.0.1']) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
  for (const ip of ['93.184.216.34', '2606:4700::1111']) assert.equal(isPublicAddress(ip), true, ip);
});

test('fetchCompanyIcon refuses internal targets and returns null', async () => {
  const { fetchCompanyIcon } = await import('../src/icon.js');
  assert.equal(await fetchCompanyIcon('http://127.0.0.1:9/'), null);
  assert.equal(await fetchCompanyIcon('ftp://example.com/'), null);
  assert.equal(await fetchCompanyIcon('not a url'), null);
});

test('renderSquare turns an SVG into a square PNG and passIcons uses it', async () => {
  const { renderSquare, passIcons } = await import('../src/icon.js');
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 256"><rect width="512" height="256" fill="red"/></svg>');
  const png = await renderSquare(svg, 256);
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  const defaults = { 'icon.png': Buffer.from('default') };
  assert.deepEqual(await passIcons(null, defaults), defaults);
  const custom = await passIcons(png, defaults);
  assert.notEqual(custom['icon.png'], defaults['icon.png']);
  const sharp = (await import('sharp')).default;
  for (const [name, size] of [['icon.png', 29], ['icon@2x.png', 58], ['icon@3x.png', 87]]) {
    assert.equal((await sharp(custom[name]).metadata()).width, size, name);
  }
});
