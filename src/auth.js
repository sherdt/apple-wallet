import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
const KEY_LENGTH = 64;

// scrypt is in Node's crypto module, so no native dependency is needed.
// The stored form is "scrypt$<salt>$<hash>", both base64.
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, saltB64, hashB64] = String(stored ?? '').split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200;

// Checks a new password and its repeat; returns field errors keyed by field name.
export function validateNewPassword(password, confirmation, fields = { password: 'password', confirm: 'confirmPassword' }) {
  const fieldErrors = {};
  if (password.length < MIN_PASSWORD) {
    fieldErrors[fields.password] = `Password must be at least ${MIN_PASSWORD} characters.`;
  } else if (password.length > MAX_PASSWORD) {
    fieldErrors[fields.password] = `Password must be at most ${MAX_PASSWORD} characters.`;
  } else if (password !== confirmation) {
    fieldErrors[fields.confirm] = 'Passwords do not match.';
  }
  return fieldErrors;
}

// Returns normalized values and error messages, in the same shape as validation.js.
export function validateCredentials(form) {
  const email = String(form.email ?? '').trim().toLowerCase();
  const password = String(form.password ?? '');
  const fieldErrors = validateNewPassword(password, String(form.confirmPassword ?? ''));
  if (!EMAIL.test(email) || email.length > 254) {
    fieldErrors.email = 'Email is not a valid address.';
  }
  const errors = Object.values(fieldErrors);
  return { values: { email, password }, errors, fieldErrors };
}
