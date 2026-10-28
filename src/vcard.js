// RFC 6350 text escaping for vCard 3.0 values (RFC 2426).
export function escapeValue(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

// Splits "Given Family" at the last space for the N property.
function nameParts(name) {
  const i = name.lastIndexOf(' ');
  return i === -1 ? ['', name] : [name.slice(i + 1), name.slice(0, i)];
}

// Builds the vCard for an employee. Lines are CRLF-terminated as the spec
// requires; the same string is used for the .vcf download and the QR code.
export function buildVCard(employee, company) {
  const fullName = employee.name;
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `UID:urn:uuid:${employee.id}`,
    `N:${nameParts(employee.name).map(escapeValue).join(';')}`,
    `FN:${escapeValue(fullName)}`,
  ];

  if (company) {
    lines.push(`ORG:${escapeValue(company.name)}`);
  }
  if (employee.job_title) lines.push(`TITLE:${escapeValue(employee.job_title)}`);
  if (employee.email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${escapeValue(employee.email)}`);
  if (employee.mobile) lines.push(`TEL;TYPE=CELL,VOICE:${escapeValue(employee.mobile)}`);
  if (company?.website) lines.push(`URL:${escapeValue(company.website)}`);

  lines.push('END:VCARD');
  return lines.join('\r\n') + '\r\n';
}
