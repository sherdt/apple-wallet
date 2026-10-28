import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';
import sharp from 'sharp';

const TIMEOUT_MS = 5000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const MAX_CANDIDATES = 5;
const STORED_SIZE = 256;
const PASS_ICON_SIZES = { 'icon.png': 29, 'icon@2x.png': 58, 'icon@3x.png': 87 };

// Addresses a company website must never make us connect to (SSRF guard).
const blocked = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) blocked.addSubnet(net, prefix, 'ipv4');
blocked.addAddress('::', 'ipv6');
blocked.addAddress('::1', 'ipv6');
blocked.addSubnet('fc00::', 7, 'ipv6');
blocked.addSubnet('fe80::', 10, 'ipv6');
blocked.addSubnet('ff00::', 8, 'ipv6');

export function isPublicAddress(address) {
  const family = isIP(address);
  if (!family) return false;
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return isPublicAddress(mapped[1]);
  return !blocked.check(address, family === 6 ? 'ipv6' : 'ipv4');
}

// Checks the address that is actually connected to, so DNS rebinding cannot
// swap in a private address after validation.
function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(err);
    if (addresses.some((a) => !isPublicAddress(a.address))) {
      return callback(new Error(`Blocked non-public address for ${hostname}`));
    }
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

// Returns { type, body } for a 200 response, or null for any other status.
function get(url, redirects = 0) {
  const target = new URL(url);
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return Promise.reject(new Error('Unsupported protocol'));
  }
  const client = target.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.get(
      target,
      {
        lookup: safeLookup,
        timeout: TIMEOUT_MS,
        headers: { 'user-agent': 'apple-wallet-icon-fetcher/1.0', accept: 'image/*,text/html;q=0.9,*/*;q=0.5' },
      },
      (res) => {
        const { statusCode, headers } = res;
        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          res.resume();
          if (redirects >= MAX_REDIRECTS) return reject(new Error('Too many redirects'));
          return resolve(get(new URL(headers.location, target), redirects + 1));
        }
        if (statusCode !== 200) {
          res.resume();
          return resolve(null);
        }
        const chunks = [];
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > MAX_BYTES) return res.destroy(new Error('Response too large'));
          chunks.push(chunk);
        });
        res.on('error', reject);
        res.on('end', () => resolve({ type: headers['content-type'] ?? '', body: Buffer.concat(chunks), url: target }));
      },
    );
    req.on('timeout', () => req.destroy(new Error('Timeout')));
    req.on('error', reject);
  });
}

function attributes(tag) {
  const out = {};
  for (const m of tag.matchAll(/([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4];
  }
  return out;
}

// Icon links declared in the page head, best candidates first: SVG, then Apple touch icons, then the rest.
function iconLinks(html, pageUrl) {
  const found = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const attrs = attributes(tag);
    const rel = (attrs.rel ?? '').toLowerCase();
    if (!rel.includes('icon') || rel.includes('mask') || !attrs.href) continue;
    let url;
    try {
      url = new URL(attrs.href, pageUrl);
    } catch {
      continue;
    }
    const isSvg = (attrs.type ?? '').includes('svg') || url.pathname.endsWith('.svg');
    const rank = isSvg ? 0 : rel.includes('apple-touch') ? 1 : 2;
    found.push({ rank, url: url.href });
  }
  return found.sort((a, b) => a.rank - b.rank).map((f) => f.url);
}

// Renders any supported image (SVG or raster) as a square PNG with transparency.
export async function renderSquare(buffer, size) {
  return sharp(buffer, { density: 300 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

// Finds the company icon from its website and returns it as a 256px PNG, or null.
// Never throws: a missing icon must not block saving the company.
export async function fetchCompanyIcon(website) {
  try {
    const page = new URL(website);
    const origin = page.origin;
    const candidates = [];

    const home = await get(page.href).catch(() => null);
    if (home && home.type.includes('html')) {
      candidates.push(...iconLinks(home.body.toString('utf8'), home.url));
    }
    candidates.push(`${origin}/icon.svg`, `${origin}/apple-touch-icon.png`);

    for (const url of [...new Set(candidates)].slice(0, MAX_CANDIDATES)) {
      const image = await get(url).catch(() => null);
      if (!image || !image.body.length) continue;
      try {
        return await renderSquare(image.body, STORED_SIZE);
      } catch {
        // Not an image sharp can read (e.g. ICO); try the next candidate.
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Builds the icon set for a pass. Uses the company's stored icon when present,
// otherwise the bundled defaults.
export async function passIcons(storedIcon, defaults) {
  if (!storedIcon) return defaults;
  const entries = await Promise.all(
    Object.entries(PASS_ICON_SIZES).map(async ([name, size]) => [name, await renderSquare(storedIcon, size)]),
  );
  return { ...defaults, ...Object.fromEntries(entries) };
}
