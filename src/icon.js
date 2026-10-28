import sharp from 'sharp';
import { parseDataUrl } from './photo.js';

const STORED_SIZE = 256;
const PASS_ICON_SIZES = { 'icon.png': 29, 'icon@2x.png': 58, 'icon@3x.png': 87 };
// Header logo boxes from Apple's pass guidelines (points x2 for the @2x variant).
const PASS_LOGO_SIZES = { 'logo.png': [144, 45], 'logo@2x.png': [288, 90] };

// Renders any supported image (SVG or raster) as a square PNG with transparency.
export async function renderSquare(buffer, size) {
  return sharp(buffer, { density: 300 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

// Turns an uploaded company logo (SVG, PNG, JPEG or WebP data URL) into the stored 256px PNG, or null.
export async function normalizeIcon(dataUrl) {
  const parsed = parseDataUrl(dataUrl, ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp']);
  if (!parsed) return null;
  try {
    return await renderSquare(parsed, STORED_SIZE);
  } catch {
    return null;
  }
}

// Fits the image inside a width x height box, keeping its proportions.
// Transparent margins are trimmed and the artwork is aligned left, so it sits in the pass header's top-left corner.
export async function renderBox(buffer, width, height) {
  const trimmed = await sharp(buffer).trim({ threshold: 1 }).toBuffer().catch(() => buffer);
  return sharp(trimmed)
    .resize(width, height, { fit: 'contain', position: 'left', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

// Builds the icon set for a pass. Uses the company's stored icon for the app icon
// and the header logo when present, otherwise the bundled defaults.
export async function passIcons(storedIcon, defaults) {
  if (!storedIcon) return defaults;
  const icons = await Promise.all(
    Object.entries(PASS_ICON_SIZES).map(async ([name, size]) => [name, await renderSquare(storedIcon, size)]),
  );
  const logos = await Promise.all(
    Object.entries(PASS_LOGO_SIZES).map(async ([name, [w, h]]) => [name, await renderBox(storedIcon, w, h)]),
  );
  return { ...defaults, ...Object.fromEntries([...icons, ...logos]) };
}
