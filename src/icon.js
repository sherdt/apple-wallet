import sharp from 'sharp';
import { parseDataUrl } from './photo.js';

const STORED_SIZE = 256;
const PASS_ICON_SIZES = { 'icon.png': 29, 'icon@2x.png': 58, 'icon@3x.png': 87 };

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

// Builds the icon set for a pass. Uses the company's stored icon for the app icon
// when present, otherwise the bundled defaults.
export async function passIcons(storedIcon, defaults) {
  if (!storedIcon) return defaults;
  const icons = await Promise.all(
    Object.entries(PASS_ICON_SIZES).map(async ([name, size]) => [name, await renderSquare(storedIcon, size)]),
  );
  return { ...defaults, ...Object.fromEntries(icons) };
}
