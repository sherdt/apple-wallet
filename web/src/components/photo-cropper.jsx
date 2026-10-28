import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button.jsx';

const VIEW = 280; // Size of the square crop frame in CSS pixels.
const OUTPUT = 540; // Matches the photo size stored on the server.
const MAX_ZOOM = 3;

// Lets the user pick the square part of an image that becomes the profile photo.
export function PhotoCropper({ src, onCancel, onCrop }) {
  const [img, setImg] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef(null);

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      // Start with the image centred in the frame at the smallest size that covers it.
      const scale = VIEW / Math.min(image.naturalWidth, image.naturalHeight);
      setOffset({
        x: (VIEW - image.naturalWidth * scale) / 2,
        y: (VIEW - image.naturalHeight * scale) / 2,
      });
      setImg(image);
    };
    image.src = src;
  }, [src]);

  if (!img) return null;

  const baseScale = VIEW / Math.min(img.naturalWidth, img.naturalHeight);
  const scale = baseScale * zoom;

  // Keeps the image covering the whole frame.
  function clamp(x, y, s) {
    return {
      x: Math.min(0, Math.max(VIEW - img.naturalWidth * s, x)),
      y: Math.min(0, Math.max(VIEW - img.naturalHeight * s, y)),
    };
  }

  function onZoom(e) {
    const nextZoom = Number(e.target.value);
    const nextScale = baseScale * nextZoom;
    // Zoom around the centre of the frame.
    const centreX = (VIEW / 2 - offset.x) / scale;
    const centreY = (VIEW / 2 - offset.y) / scale;
    setOffset(clamp(VIEW / 2 - centreX * nextScale, VIEW / 2 - centreY * nextScale, nextScale));
    setZoom(nextZoom);
  }

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, offset };
  }

  function onPointerMove(e) {
    if (!drag.current) return;
    const start = drag.current;
    setOffset(clamp(start.offset.x + e.clientX - start.x, start.offset.y + e.clientY - start.y, scale));
  }

  function onPointerUp() {
    drag.current = null;
  }

  function crop() {
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext('2d');
    // Transparent areas would turn black in JPEG, so paint white first.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, OUTPUT, OUTPUT);
    ctx.drawImage(img, -offset.x / scale, -offset.y / scale, VIEW / scale, VIEW / scale, 0, 0, OUTPUT, OUTPUT);
    onCrop(canvas.toDataURL('image/jpeg', 0.92));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="grid w-full max-w-sm gap-4 rounded-lg bg-background p-6 shadow-lg">
        <h2 className="text-lg font-semibold">Crop profile photo</h2>
        <div
          className="relative mx-auto touch-none cursor-move overflow-hidden rounded-full bg-muted"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <img
            src={src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none select-none"
            style={{
              width: img.naturalWidth * scale,
              height: img.naturalHeight * scale,
              left: offset.x,
              top: offset.y,
            }}
          />
        </div>
        <label className="grid gap-2 text-sm">
          Zoom
          <input
            type="range"
            min="1"
            max={MAX_ZOOM}
            step="0.01"
            value={zoom}
            onChange={onZoom}
          />
        </label>
        <p className="text-xs text-muted-foreground">Drag the image to position it. The square is what appears on the card.</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="button" onClick={crop}>Use photo</Button>
        </div>
      </div>
    </div>
  );
}
