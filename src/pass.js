import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PKPass } from 'passkit-generator';
import { buildVCard } from './vcard.js';

const ASSET_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

// Reads the Apple signing material mounted from the Kubernetes secret (or
// wherever WALLET_CERT_DIR points). All three files are PEM.
export async function loadCertificates(dir) {
  const [wwdr, signerCert, signerKey] = await Promise.all(
    ['wwdr.pem', 'signer-cert.pem', 'signer-key.pem'].map((name) => readFile(join(dir, name))),
  );
  return { wwdr, signerCert, signerKey };
}

const IMAGE_FILES = ['icon.png', 'icon@2x.png', 'icon@3x.png', 'logo.png', 'logo@2x.png', 'strip.png', 'strip@2x.png'];

export async function loadIcons() {
  const images = await Promise.all(IMAGE_FILES.map((name) => readFile(join(ASSET_DIR, name))));
  return Object.fromEntries(IMAGE_FILES.map((name, i) => [name, images[i]]));
}

const field = (key, label, value) => (value ? { key, label, value } : null);
const present = (fields) => fields.filter(Boolean);
const contactLine = (employee) => [employee.mobile, employee.email].filter(Boolean).join(' · ') || null;

export function describePass({ employee, company, config }) {
  const fullName = employee.name;

  return {
    formatVersion: 1,
    passTypeIdentifier: config.passTypeIdentifier,
    teamIdentifier: config.teamIdentifier,
    organizationName: company.name,
    description: `${company.name} business card`,
    serialNumber: employee.id,
    backgroundColor: 'rgb(255, 255, 255)',
    foregroundColor: 'rgb(24, 61, 87)',
    labelColor: 'rgb(42, 133, 198)',
    storeCard: {
      // Empty primary field keeps the text clear of the strip image.
      headerFields: present([field('headerName', ' ', fullName)]),
      primaryFields: [{ key: 'spacer', label: ' ', value: ' ' }],
      // The label holds the position, the value holds phone and email on one line.
      secondaryFields: [{ key: 'position', label: employee.job_title || ' ', value: contactLine(employee) || ' ' }],
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
    message: buildVCard(employee, company),
    format: 'PKBarcodeFormatQR',
    messageEncoding: 'utf-8',
  });
  return pass.getAsBuffer();
}
