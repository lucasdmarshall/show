"use client";

import { useSyncExternalStore } from "react";

/* ------------------------------------------------------------------
   Grade — colour and tone, entirely on the device.

   Three stages, in a fixed order so the Reveal can scrub through them:

     tone    exposure · contrast · highlights · shadows   (one LUT)
     colour  temperature · tint (per-channel LUTs) · saturation
     curves  master curve, then R · G · B curves          (LUTs)

   Every stage is a pure function of the pixel, which is what lets the
   same settings leave as a .cube file and land in Resolve, Premiere or
   Lightroom unchanged.
   ------------------------------------------------------------------ */

export type Point = [number, number];
export type Channel = "master" | "r" | "g" | "b";
export type Curves = Record<Channel, Point[]>;

export type Settings = {
  /** EV, −2 … +2 */
  exposure: number;
  /** −1 … +1 for everything below */
  contrast: number;
  highlights: number;
  shadows: number;
  temperature: number;
  tint: number;
  saturation: number;
  curves: Curves;
};

const LINE: Point[] = [
  [0, 0],
  [1, 1],
];

export const NEUTRAL: Settings = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  temperature: 0,
  tint: 0,
  saturation: 0,
  curves: { master: LINE, r: LINE, g: LINE, b: LINE },
};

export const isNeutral = (s: Settings) =>
  JSON.stringify(s) === JSON.stringify(NEUTRAL);

/* -- helpers ------------------------------------------------------ */

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const toLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const toSrgb = (c: number) =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

/* -- curves: monotone cubic, so a curve can never overshoot ------- */

/**
 * Fritsch–Carlson monotone interpolation. An ordinary spline rings
 * past its points and puts bands in a sky; this one cannot.
 */
export function curveLUT(input: Point[]): Uint8Array {
  const pts = [...input].sort((a, b) => a[0] - b[0]);
  const lut = new Uint8Array(256);
  const n = pts.length;

  if (n < 2) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const w = Math.max(1e-6, pts[i + 1][0] - pts[i][0]);
    dx.push(w);
    slope.push((pts[i + 1][1] - pts[i][1]) / w);
  }

  const m: number[] = new Array(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }

  let seg = 0;
  for (let i = 0; i < 256; i++) {
    const x = i / 255;
    if (x <= pts[0][0]) {
      lut[i] = Math.round(clamp01(pts[0][1]) * 255);
      continue;
    }
    if (x >= pts[n - 1][0]) {
      lut[i] = Math.round(clamp01(pts[n - 1][1]) * 255);
      continue;
    }
    while (seg < n - 2 && x > pts[seg + 1][0]) seg++;
    const h = dx[seg];
    const t = (x - pts[seg][0]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    const y =
      (2 * t3 - 3 * t2 + 1) * pts[seg][1] +
      (t3 - 2 * t2 + t) * h * m[seg] +
      (-2 * t3 + 3 * t2) * pts[seg + 1][1] +
      (t3 - t2) * h * m[seg + 1];
    lut[i] = Math.round(clamp01(y) * 255);
  }
  return lut;
}

/* -- the pipeline, compiled to tables once per settings change ---- */

export type Pipeline = {
  tone: Uint8Array;
  gainR: Uint8Array;
  gainG: Uint8Array;
  gainB: Uint8Array;
  sat: number;
  master: Uint8Array;
  r: Uint8Array;
  g: Uint8Array;
  b: Uint8Array;
};

export function compilePipeline(s: Settings): Pipeline {
  const tone = new Uint8Array(256);
  const ev = Math.pow(2, s.exposure);

  for (let i = 0; i < 256; i++) {
    /* exposure is a multiply in linear light, not in the encoded values */
    let x = toSrgb(clamp01(toLinear(i / 255) * ev));

    /* contrast: towards an S-curve, or towards flat — never clipping */
    if (s.contrast >= 0) {
      const sCurve = x * x * (3 - 2 * x);
      x += (sCurve - x) * s.contrast;
    } else {
      x += (0.5 + (x - 0.5) * 0.5 - x) * -s.contrast;
    }

    /* highlights and shadows act only in their own half of the range */
    x += s.highlights * 0.28 * smooth(0.45, 1, x);
    x += s.shadows * 0.28 * (1 - smooth(0, 0.55, x));

    tone[i] = Math.round(clamp01(x) * 255);
  }

  const gain = (g: number) => {
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) lut[i] = Math.round(clamp01((i / 255) * g) * 255);
    return lut;
  };

  return {
    tone,
    gainR: gain(1 + 0.14 * s.temperature),
    gainG: gain(1 - 0.09 * s.tint),
    gainB: gain(1 - 0.14 * s.temperature),
    sat: 1 + s.saturation,
    master: curveLUT(s.curves.master),
    r: curveLUT(s.curves.r),
    g: curveLUT(s.curves.g),
    b: curveLUT(s.curves.b),
  };
}

/**
 * One pass over the pixels, writing every stage it passes through.
 * The Reveal needs all three, and three passes would cost three times.
 */
export function renderStages(
  src: Uint8ClampedArray,
  p: Pipeline,
  out: { tone: Uint8ClampedArray; colour: Uint8ClampedArray; curves: Uint8ClampedArray },
) {
  const { tone, gainR, gainG, gainB, sat, master, r: cr, g: cg, b: cb } = p;
  for (let i = 0; i < src.length; i += 4) {
    let r = tone[src[i]];
    let g = tone[src[i + 1]];
    let b = tone[src[i + 2]];
    out.tone[i] = r;
    out.tone[i + 1] = g;
    out.tone[i + 2] = b;
    out.tone[i + 3] = 255;

    r = gainR[r];
    g = gainG[g];
    b = gainB[b];
    if (sat !== 1) {
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = l + (r - l) * sat;
      g = l + (g - l) * sat;
      b = l + (b - l) * sat;
      r = r < 0 ? 0 : r > 255 ? 255 : r;
      g = g < 0 ? 0 : g > 255 ? 255 : g;
      b = b < 0 ? 0 : b > 255 ? 255 : b;
    }
    out.colour[i] = r;
    out.colour[i + 1] = g;
    out.colour[i + 2] = b;
    out.colour[i + 3] = 255;

    out.curves[i] = cr[master[out.colour[i]]];
    out.curves[i + 1] = cg[master[out.colour[i + 1]]];
    out.curves[i + 2] = cb[master[out.colour[i + 2]]];
    out.curves[i + 3] = 255;
  }
}

/** The final result only — for full-resolution export. In place. */
export function renderFinal(px: Uint8ClampedArray, p: Pipeline) {
  const { tone, gainR, gainG, gainB, sat, master, r: cr, g: cg, b: cb } = p;
  for (let i = 0; i < px.length; i += 4) {
    let r = gainR[tone[px[i]]];
    let g = gainG[tone[px[i + 1]]];
    let b = gainB[tone[px[i + 2]]];
    if (sat !== 1) {
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = Math.round(l + (r - l) * sat);
      g = Math.round(l + (g - l) * sat);
      b = Math.round(l + (b - l) * sat);
      r = r < 0 ? 0 : r > 255 ? 255 : r;
      g = g < 0 ? 0 : g > 255 ? 255 : g;
      b = b < 0 ? 0 : b > 255 ? 255 : b;
    }
    px[i] = cr[master[r]];
    px[i + 1] = cg[master[g]];
    px[i + 2] = cb[master[b]];
  }
}

/* -- histogram ---------------------------------------------------- */

export type Histogram = {
  r: Uint32Array;
  g: Uint32Array;
  b: Uint32Array;
  l: Uint32Array;
  /** Share of pixels with any channel at 0 or 255. */
  clipLow: number;
  clipHigh: number;
};

export function histogram(px: Uint8ClampedArray): Histogram {
  const r = new Uint32Array(256);
  const g = new Uint32Array(256);
  const b = new Uint32Array(256);
  const l = new Uint32Array(256);
  let low = 0;
  let high = 0;
  const n = px.length / 4;
  for (let i = 0; i < px.length; i += 4) {
    const R = px[i];
    const G = px[i + 1];
    const B = px[i + 2];
    r[R]++;
    g[G]++;
    b[B]++;
    l[Math.round(0.2126 * R + 0.7152 * G + 0.0722 * B)]++;
    if (R === 0 || G === 0 || B === 0) low++;
    if (R === 255 || G === 255 || B === 255) high++;
  }
  return { r, g, b, l, clipLow: low / n, clipHigh: high / n };
}

/* -- .cube: the look, leaving the app ----------------------------- */

export function toCube(s: Settings, title: string, size = 33): string {
  const p = compilePipeline(s);
  const px = new Uint8ClampedArray(size * size * size * 4);
  let k = 0;
  /* .cube order: red varies fastest, then green, then blue */
  for (let bi = 0; bi < size; bi++) {
    for (let gi = 0; gi < size; gi++) {
      for (let ri = 0; ri < size; ri++) {
        px[k] = Math.round((ri / (size - 1)) * 255);
        px[k + 1] = Math.round((gi / (size - 1)) * 255);
        px[k + 2] = Math.round((bi / (size - 1)) * 255);
        px[k + 3] = 255;
        k += 4;
      }
    }
  }
  renderFinal(px, p);

  const lines = [
    `TITLE "${title.replace(/"/g, "'")}"`,
    "# Made in SHOW",
    `LUT_3D_SIZE ${size}`,
    "DOMAIN_MIN 0.0 0.0 0.0",
    "DOMAIN_MAX 1.0 1.0 1.0",
  ];
  for (let i = 0; i < px.length; i += 4) {
    lines.push(
      `${(px[i] / 255).toFixed(6)} ${(px[i + 1] / 255).toFixed(6)} ${(px[i + 2] / 255).toFixed(6)}`,
    );
  }
  return lines.join("\n") + "\n";
}

/* -- looks: named settings, kept on this device ------------------- */

export type Look = { id: string; name: string; nameMy: string; settings: Settings; own?: boolean };

const curve = (pts: Point[]): Point[] => [[0, 0], ...pts, [1, 1]];

export const BUILT_IN: Look[] = [
  {
    id: "portra",
    name: "Portra warm",
    nameMy: "ဖလင်နွေး",
    settings: {
      ...NEUTRAL,
      exposure: 0.1,
      contrast: -0.15,
      highlights: -0.3,
      shadows: 0.2,
      temperature: 0.25,
      saturation: -0.12,
      curves: {
        master: [[0, 0.05], [0.25, 0.26], [0.75, 0.76], [1, 0.97]],
        r: LINE,
        g: LINE,
        b: [[0, 0.04], [1, 0.96]],
      },
    },
  },
  {
    id: "monsoon",
    name: "Monsoon",
    nameMy: "မိုးရာသီ",
    settings: {
      ...NEUTRAL,
      exposure: -0.15,
      contrast: 0.1,
      highlights: -0.2,
      temperature: -0.35,
      tint: -0.1,
      saturation: -0.35,
      curves: { master: curve([[0.3, 0.26], [0.7, 0.72]]), r: LINE, g: LINE, b: LINE },
    },
  },
  {
    id: "golden",
    name: "Golden Burmese",
    nameMy: "ရွှေရောင်",
    settings: {
      ...NEUTRAL,
      exposure: 0.05,
      contrast: 0.2,
      shadows: -0.1,
      temperature: 0.45,
      tint: 0.08,
      saturation: 0.1,
      curves: {
        master: curve([[0.25, 0.22], [0.75, 0.8]]),
        r: curve([[0.5, 0.54]]),
        g: LINE,
        b: curve([[0.5, 0.44]]),
      },
    },
  },
  {
    id: "noir",
    name: "Silver",
    nameMy: "ငွေရောင်",
    settings: {
      ...NEUTRAL,
      contrast: 0.45,
      highlights: -0.15,
      shadows: -0.1,
      saturation: -1,
      curves: { master: curve([[0.2, 0.14], [0.8, 0.88]]), r: LINE, g: LINE, b: LINE },
    },
  },
];

const LOOK_KEY = "show.looks.v1";
let lookCache: Look[] | null = null;
const lookListeners = new Set<() => void>();

function readLooks(): Look[] {
  if (lookCache) return lookCache;
  try {
    const raw = localStorage.getItem(LOOK_KEY);
    lookCache = raw ? (JSON.parse(raw) as Look[]) : [];
  } catch {
    lookCache = [];
  }
  return lookCache;
}

function writeLooks(next: Look[]) {
  lookCache = next;
  try {
    localStorage.setItem(LOOK_KEY, JSON.stringify(next));
  } catch {
    /* kept for this session only */
  }
  for (const l of lookListeners) l();
}

function subscribeLooks(cb: () => void) {
  lookListeners.add(cb);
  return () => lookListeners.delete(cb);
}

const NO_LOOKS: Look[] = [];

export function useOwnLooks(): Look[] {
  return useSyncExternalStore(subscribeLooks, readLooks, () => NO_LOOKS);
}

export function saveLook(name: string, settings: Settings) {
  const clean = name.trim() || "My look";
  writeLooks([
    { id: Math.random().toString(36).slice(2, 10), name: clean, nameMy: clean, settings, own: true },
    ...readLooks(),
  ]);
}

export function removeLook(id: string) {
  writeLooks(readLooks().filter((l) => l.id !== id));
}
