/* ------------------------------------------------------------------
   Pixels in and out — shared by every room that works on a photograph
   on the device. Nothing here leaves the browser.
   ------------------------------------------------------------------ */

/* Past this many pixels a phone's canvas refuses to allocate. */
export const MAX_AREA = 16_000_000;

export type Loaded = {
  data: ImageData;
  /** the file's own size, before any preview scaling */
  fullW: number;
  fullH: number;
};

export const canvas = (w: number, h: number) =>
  Object.assign(document.createElement("canvas"), { width: w, height: h });

export const ctx2d = (c: HTMLCanvasElement) =>
  c.getContext("2d", { willReadFrequently: true })!;

/**
 * Decode a file and draw it no larger than `max` on its long side.
 * `max = 0` keeps the full size, capped only by the device's canvas limit.
 */
export async function readImage(src: Blob, max = 0): Promise<Loaded> {
  const bmp = await createImageBitmap(src);
  const fullW = bmp.width;
  const fullH = bmp.height;
  let k = max ? Math.min(1, max / Math.max(fullW, fullH)) : 1;
  const area = fullW * fullH * k * k;
  if (area > MAX_AREA) k *= Math.sqrt(MAX_AREA / area);
  const w = Math.max(1, Math.round(fullW * k));
  const h = Math.max(1, Math.round(fullH * k));
  const c = canvas(w, h);
  const x = ctx2d(c);
  x.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return { data: x.getImageData(0, 0, w, h), fullW, fullH };
}

export function canvasOf(img: ImageData): HTMLCanvasElement {
  const c = canvas(img.width, img.height);
  ctx2d(c).putImageData(img, 0, 0);
  return c;
}

export const toBlob = (c: HTMLCanvasElement, type = "image/jpeg", q = 0.92) =>
  new Promise<Blob>((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), type, q),
  );

export const imageBlob = (img: ImageData, type = "image/jpeg", q = 0.92) =>
  toBlob(canvasOf(img), type, q);

/** A small JPEG for grids — the full file stays where it is. */
export async function thumbnail(src: Blob, size = 480): Promise<{ blob: Blob; w: number; h: number }> {
  const bmp = await createImageBitmap(src);
  const k = Math.min(1, size / Math.max(bmp.width, bmp.height));
  const c = canvas(Math.round(bmp.width * k), Math.round(bmp.height * k));
  ctx2d(c).drawImage(bmp, 0, 0, c.width, c.height);
  const out = { w: bmp.width, h: bmp.height };
  bmp.close();
  return { blob: await toBlob(c, "image/jpeg", 0.82), ...out };
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const stem = (name?: string) => (name ?? "photo").replace(/\.[^.]+$/, "");

export const isImage = (f: File | Blob | null | undefined): f is File =>
  !!f && f.type.startsWith("image/");

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/* -- colour ------------------------------------------------------- */

export const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const srgbToLinear = new Float32Array(256).map((_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
});

const linearToSrgb = (c: number) => {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return v < 0 ? 0 : v > 1 ? 255 : v * 255;
};

/**
 * sRGB → CIELAB (D65). Written out rather than via a library: Harmonize
 * and Batch both match colour statistics in this space, and it has to be
 * fast enough to run over a whole preview on a phone.
 */
export function toLab(r: number, g: number, b: number, out: Float32Array, o: number) {
  const R = srgbToLinear[r];
  const G = srgbToLinear[g];
  const B = srgbToLinear[b];
  let x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  let y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  let z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x);
  y = f(y);
  z = f(z);
  out[o] = 116 * y - 16;
  out[o + 1] = 500 * (x - y);
  out[o + 2] = 200 * (y - z);
}

export function fromLab(L: number, A: number, Bv: number, px: Uint8ClampedArray, o: number) {
  let y = (L + 16) / 116;
  let x = A / 500 + y;
  let z = y - Bv / 200;
  const f = (t: number) => {
    const t3 = t * t * t;
    return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
  };
  x = f(x) * 0.95047;
  y = f(y);
  z = f(z) * 1.08883;
  px[o] = linearToSrgb(3.2406 * x - 1.5372 * y - 0.4986 * z);
  px[o + 1] = linearToSrgb(-0.9689 * x + 1.8758 * y + 0.0415 * z);
  px[o + 2] = linearToSrgb(0.0557 * x - 0.204 * y + 1.057 * z);
}

/** Separable box blur on one float channel, run `passes` times ≈ gaussian. */
export function blurChannel(src: Float32Array, w: number, h: number, r: number, passes = 2): Float32Array {
  if (r < 1) return src.slice();
  const a = src.slice();
  const b = new Float32Array(src.length);
  const rr = Math.round(r);
  const norm = 1 / (2 * rr + 1);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let acc = 0;
      for (let k = -rr; k <= rr; k++) acc += a[row + Math.min(w - 1, Math.max(0, k))];
      for (let x = 0; x < w; x++) {
        b[row + x] = acc * norm;
        acc += a[row + Math.min(w - 1, x + rr + 1)] - a[row + Math.max(0, x - rr)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -rr; k <= rr; k++) acc += b[Math.min(h - 1, Math.max(0, k)) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = acc * norm;
        acc += b[Math.min(h - 1, y + rr + 1) * w + x] - b[Math.max(0, y - rr) * w + x];
      }
    }
  }
  return a;
}
