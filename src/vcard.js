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
// Public URL of the employee's photo, or null when there is none. The token is the same credential as the card URL.
export function photoUrl(origin, employee) {
  return employee.photo ? `${origin}/p/${employee.token}/photo.jpg` : null;
}

export function buildVCard(employee, company, { photo } = {}) {
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
  if (employee.linkedin) lines.push(`X-SOCIALPROFILE;TYPE=linkedin:${escapeValue(employee.linkedin)}`);
  // vCard has no standard free-text location field; NOTE is the visible place for it.
  if (employee.location) lines.push(`NOTE:${escapeValue(`Standort | ${employee.location}`)}`);
  if (company?.website) lines.push(`URL:${escapeValue(company.website)}`);
  // ADR fields: PO box, extended address, street, locality, region, postal code, country.
  if (company?.address) lines.push(`ADR;TYPE=WORK:;;${escapeValue(company.address)};;;;`);
  if (photo) lines.push(`PHOTO;VALUE=uri:${photo}`);

  lines.push('END:VCARD');
  return lines.join('\r\n') + '\r\n';
}
