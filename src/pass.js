import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PKPass } from 'passkit-generator';
import { buildVCard, photoUrl } from './vcard.js';

const ASSET_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

// Reads the Apple signing material mounted from the Kubernetes secret (or
// wherever WALLET_CERT_DIR points). All three files are PEM.
export async function loadCertificates(dir) {
  const [wwdr, signerCert, signerKey] = await Promise.all(
    ['wwdr.pem', 'signer-cert.pem', 'signer-key.pem'].map((name) => readFile(join(dir, name))),
  );
  return { wwdr, signerCert, signerKey };
}

const IMAGE_FILES = ['icon.png', 'icon@2x.png', 'icon@3x.png', 'logo.png', 'logo@2x.png'];

export async function loadIcons() {
  const images = await Promise.all(IMAGE_FILES.map((name) => readFile(join(ASSET_DIR, name))));
  return Object.fromEntries(IMAGE_FILES.map((name, i) => [name, images[i]]));
}

const field = (key, label, value) => (value ? { key, label, value } : null);
const present = (fields) => fields.filter(Boolean);

// Generic style (no strip image): name top right, job title above the name,
// phone/email/website in rows below, QR code carries the vCard.
export function describePass({ employee, company, config }) {
  return {
    formatVersion: 1,
    passTypeIdentifier: config.passTypeIdentifier,
    teamIdentifier: config.teamIdentifier,
    organizationName: company.name,
    description: company.name,
    serialNumber: employee.id,
    backgroundColor: 'rgb(0, 0, 0)',
    foregroundColor: 'rgb(255, 255, 255)',
    labelColor: 'rgb(160, 160, 160)',
    generic: {
      primaryFields: [{ key: 'name', label: employee.job_title || ' ', value: employee.name }],
      secondaryFields: present([
        field('mobile', 'TELEFON', employee.mobile),
        field('email', 'E-MAIL', employee.email),
      ]),
      auxiliaryFields: present([field('website', 'WEBSITE', company.website)]),
      backFields: present([
        field('back-name', 'NAME', employee.name),
        field('back-mobile', 'TELEFON', employee.mobile),
        field('back-email', 'E-MAIL', employee.email),
        field('back-website', 'WEB', company.website),
        field('back-company', 'UNTERNEHMEN', [company.name, company.address].filter(Boolean).join('\n')),
      ]),
    },
  };
}

// Returns the signed .pkpass as a Buffer. The QR code carries the vCard, so
// scanning it with an iPhone camera offers "Add Contact".
export function buildPass({ employee, company, config, certificates, icons }) {
  const buffers = {
    'pass.json': Buffer.from(JSON.stringify(describePass({ employee, company, config }))),
    ...icons,
  };

  const pass = new PKPass(buffers, certificates);
  pass.setBarcodes({
    message: buildVCard(employee, company, { photo: photoUrl(config.publicOrigin, employee) }),
    format: 'PKBarcodeFormatQR',
    messageEncoding: 'utf-8',
  });
  return pass.getAsBuffer();
}
