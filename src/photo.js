import sharp from 'sharp';

// 540px is 3x the largest thumbnail, enough for every pass density.
const STORED_SIZE = 540;

// Returns the decoded bytes of a base64 data URL whose MIME type is in allowedTypes, or null.
export function parseDataUrl(dataUrl, allowedTypes) {
  const match = /^data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/]+=*)$/i.exec(dataUrl ?? '');
  if (!match || !allowedTypes.includes(match[1].toLowerCase())) return null;
  return Buffer.from(match[2], 'base64');
}

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const THUMBNAIL_SIZES = { 'thumbnail.png': 90, 'thumbnail@2x.png': 180, 'thumbnail@3x.png': 270 };

// Accepts a base64 image data URL and returns a square JPEG, or null when the input is not an image.
export async function normalizePhoto(dataUrl) {
  const input = parseDataUrl(dataUrl, PHOTO_TYPES);
  if (!input) return null;
  try {
    return await sharp(input)
      .rotate()
      .resize(STORED_SIZE, STORED_SIZE, { fit: 'cover' })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    return null;
  }
}

export function photoDataUrl(buffer) {
  return buffer ? `data:image/jpeg;base64,${buffer.toString('base64')}` : null;
}

// Round thumbnail with a black rim: the card background is black, so the rim blends into it.
async function roundThumbnail(photo, size) {
  const radius = size / 2;
  const rim = Math.max(2, Math.round(size * 0.03));
  const square = await sharp(photo).resize(size, size, { fit: 'cover' }).png().toBuffer();
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${radius}" cy="${radius}" r="${radius}" fill="#fff"/></svg>`,
  );
  const ring = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${radius}" cy="${radius}" r="${radius - rim / 2}" fill="none" stroke="#000" stroke-width="${rim}"/></svg>`,
  );
  return sharp(square)
    .composite([
      { input: mask, blend: 'dest-in' },
      { input: ring, blend: 'over' },
    ])
    .png()
    .toBuffer();
}

// Thumbnail images for the pass; Wallet shows them on the right-hand side of the card.
export async function passThumbnails(photo) {
  const entries = await Promise.all(
    Object.entries(THUMBNAIL_SIZES).map(async ([name, size]) => [name, await roundThumbnail(photo, size)]),
  );
  return Object.fromEntries(entries);
}
