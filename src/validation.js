const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Same wording as the visible form labels, so error messages match the UI.
const LABELS = {
  name: 'Company name',
  website: 'Website',
  job_title: 'Job title',
  email: 'Email',
  mobile: 'Mobile',
};

const label = (field) => LABELS[field] ?? field;

function text(form, field, { max, required = false, title = label(field) }) {
  const value = String(form[field] ?? '').trim();
  if (required && value === '') return { error: `${title} is required.` };
  if (value.length > max) return { error: `${title} must be at most ${max} characters.` };
  return { value };
}

// Runs every rule and collects errors. Empty optional fields become null.
// fieldErrors maps each invalid field name to its message for inline display.
function collect(form, spec) {
  const values = {};
  const errors = [];
  const fieldErrors = {};
  for (const [field, check] of Object.entries(spec)) {
    const result = check(form, field);
    if (result.error) {
      errors.push(result.error);
      fieldErrors[field] = result.error;
    } else {
      values[field] = result.value === '' ? null : result.value;
    }
  }
  return { values, errors, fieldErrors };
}

const optionalEmail = (form, field) => {
  const { value, error } = text(form, field, { max: 254 });
  if (error) return { error };
  if (value && !EMAIL.test(value)) return { error: 'Email is not a valid address.' };
  return { value };
};

const optionalUrl = (form, field) => {
  const { value, error } = text(form, field, { max: 500 });
  if (error) return { error };
  if (!value) return { value };
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('protocol');
    return { value: url.toString() };
  } catch {
    return { error: 'Website must be a valid http(s) URL.' };
  }
};

const requiredText = (max, title) => (form, field) => text(form, field, { max, required: true, title });
const optionalText = (max) => (form, field) => text(form, field, { max });

export function validateCompany(form) {
  return collect(form, {
    name: requiredText(200),
    website: optionalUrl,
  });
}

export function validateEmployee(form) {
  return collect(form, {
    name: requiredText(200, 'Name'),
    job_title: optionalText(150),
    email: optionalEmail,
    mobile: optionalText(50),
  });
}
