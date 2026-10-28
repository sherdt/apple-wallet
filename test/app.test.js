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

const company = { id: randomUUID(), name: 'PRODYNA SE', website: 'https://www.prodyna.com/' };
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
  adminUser: 'admin',
  adminPassword: 'secret',
};

function fakeRepo() {
  const companies = new Map([[company.id, { ...company }]]);
  const employees = new Map([[employee.id, { ...employee, company_id: company.id }]]);
  return {
    companies,
    employees,
    async ping() {},
    async listCompanies() {
      return [...companies.values()].map((c) => ({ ...c, employee_count: 0 }));
    },
    async getCompany(id) {
      return companies.get(id) ?? null;
    },
    async createCompany(values) {
      const row = { id: randomUUID(), ...values };
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
    async getEmployee(id) {
      return employees.get(id) ?? null;
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

const auth = `Basic ${Buffer.from('admin:secret').toString('base64')}`;

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

const json = { authorization: auth, origin: config.publicOrigin, 'content-type': 'application/json' };
const noBody = { authorization: auth, origin: config.publicOrigin };

test('admin API requires Basic auth and rejects cross-origin writes', async () => {
  const app = await buildApp({ config, repo: fakeRepo(), certificates: makeCerts(), icons: await loadIcons() });
  const anon = await app.inject({ url: '/admin/api/companies' });
  assert.equal(anon.statusCode, 401);
  const wrongPass = await app.inject({
    url: '/admin/api/companies',
    headers: { authorization: 'Basic ' + Buffer.from('admin:nope').toString('base64') },
  });
  assert.equal(wrongPass.statusCode, 401);
  const crossOrigin = await app.inject({
    method: 'POST', url: '/admin/api/companies',
    headers: { ...json, origin: 'https://evil.example' },
    payload: JSON.stringify({ name: 'x' }),
  });
  assert.equal(crossOrigin.statusCode, 403);
  assert.match(crossOrigin.json().error, /Blocked/);
  await app.close();
});

test('admin API creates, validates, updates and deletes companies', async () => {
  const repo = fakeRepo();
  const app = await buildApp({ config, repo, certificates: makeCerts(), icons: await loadIcons() });

  const created = await app.inject({ method: 'POST', url: '/admin/api/companies', headers: json, payload: JSON.stringify({ name: 'Acme' }) });
  assert.equal(created.statusCode, 201);
  const acme = created.json();
  assert.equal(acme.name, 'Acme');

  const bad = await app.inject({ method: 'POST', url: '/admin/api/companies', headers: json, payload: JSON.stringify({ name: '', website: 'javascript:x' }) });
  assert.equal(bad.statusCode, 400);
  assert.ok(bad.json().fieldErrors.name);
  assert.ok(bad.json().fieldErrors.website);

  const list = await app.inject({ url: '/admin/api/companies', headers: { authorization: auth } });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().some((c) => c.id === acme.id));

  const updated = await app.inject({ method: 'PUT', url: `/admin/api/companies/${acme.id}`, headers: json, payload: JSON.stringify({ name: 'Acme Two' }) });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.json().name, 'Acme Two');

  const missing = await app.inject({ url: '/admin/api/companies/not-a-uuid', headers: { authorization: auth } });
  assert.equal(missing.statusCode, 404);

  const deleted = await app.inject({ method: 'DELETE', url: `/admin/api/companies/${acme.id}`, headers: noBody });
  assert.equal(deleted.statusCode, 204);
  await app.close();
});

test('admin API flow creates an employee and public routes serve the card', async () => {
  const repo = fakeRepo();
  const app = await buildApp({ config, repo, certificates: makeCerts(), icons: await loadIcons() });

  const addEmp = await app.inject({
    method: 'POST', url: `/admin/api/companies/${company.id}/employees`, headers: json,
    payload: JSON.stringify({ name: 'Erika Musterfrau', email: 'erika@example.com' }),
  });
  assert.equal(addEmp.statusCode, 201);
  const emp = addEmp.json();

  const detail = await app.inject({ url: `/admin/api/employees/${emp.id}`, headers: { authorization: auth } });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().company.id, company.id);
  assert.equal(detail.json().origin, config.publicOrigin);

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

  const rotated = await app.inject({ method: 'POST', url: `/admin/api/employees/${emp.id}/rotate-token`, headers: noBody });
  assert.equal(rotated.statusCode, 200);
  assert.notEqual(rotated.json().token, emp.token);
  const oldLink = await app.inject({ url: `/p/${emp.token}.vcf` });
  assert.equal(oldLink.statusCode, 404);

  const badEmail = await app.inject({
    method: 'POST', url: `/admin/api/companies/${company.id}/employees`, headers: json,
    payload: JSON.stringify({ name: 'A', email: 'nope' }),
  });
  assert.equal(badEmail.statusCode, 400);

  const removed = await app.inject({ method: 'DELETE', url: `/admin/api/employees/${emp.id}`, headers: noBody });
  assert.equal(removed.statusCode, 204);
  await app.close();
});

test('API responses and public pages carry security headers', async () => {
  const app = await buildApp({ config, repo: fakeRepo(), certificates: makeCerts(), icons: await loadIcons() });
  const res = await app.inject({ url: '/admin/api/companies', headers: { authorization: auth } });
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
