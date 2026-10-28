const KEY = 'wallet-token';

// The JWT lives in localStorage; the strict CSP (no inline scripts) limits the XSS risk.
export const session = {
  get: () => localStorage.getItem(KEY),
  set: (token) => localStorage.setItem(KEY, token),
  clear: () => localStorage.removeItem(KEY),
};
