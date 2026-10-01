/* ------------------------------------------------------------------
   Series — what a shoot looks like as a whole.

   One look applied to 300 frames does not make them match: a frame shot
   a stop under stays a stop under after the grade. So every frame is
   measured after the look, the series' own centre is found, and the
   frames that sit far from it are named — with the reason, and with the
   exposure and white-balance nudge that would bring each one back.

   Culling runs on the same pass: soft frames, clipped frames, and
   near-duplicates from a burst.
   ------------------------------------------------------------------ */

/* no imports: this file runs under the engine checks in plain Node */
const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export type Metrics = {
  /** mean luma, 0–1 */
  key: number;
  /** red minus blue, −1…1 — warmer is positive */
  warmth: number;
  /** green against magenta, −1…1 */
  tint: number;
  /** mean saturation, 0–1 */
  sat: number;
  /** luma standard deviation, 0–1 */
  contrast: number;
  /** variance of the Laplacian on a small grey copy — higher is sharper */
  sharp: number;
  clipLow: number;
  clipHigh: number;
  /** 64-bit difference hash, as two 32-bit halves */
  hash: [number, number];
};

/** Measure a frame from its pixels. A 256px copy is plenty for this. */
export function measure(px: Uint8ClampedArray, w: number, h: number): Metrics {
  const n = w * h;
  const grey = new Float32Array(n);
  let sumL = 0;
  let sumL2 = 0;
  let sumW = 0;
  let sumT = 0;
  let sumS = 0;
  let low = 0;
  let high = 0;
  for (let i = 0, p = 0; p < n; i += 4, p++) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const l = luma(r, g, b) / 255;
    grey[p] = l;
    sumL += l;
    sumL2 += l * l;
    sumW += (r - b) / 255;
    sumT += (g - (r + b) / 2) / 255;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    sumS += mx ? (mx - mn) / mx : 0;
    if (l < 0.02) low++;
    if (l > 0.98) high++;
  }
  const key = sumL / n;

  /* Laplacian variance, ignoring the outermost pixel */
  let lapSum = 0;
  let lapSum2 = 0;
  let m = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = 4 * grey[i] - grey[i - 1] - grey[i + 1] - grey[i - w] - grey[i + w];
      lapSum += v;
      lapSum2 += v * v;
      m++;
    }
  }
  const lapMean = lapSum / Math.max(1, m);
  const contrast = Math.sqrt(Math.max(0, sumL2 / n - key * key));
  /* normalised by the frame's own contrast, so a dark or flat frame is
     not mistaken for a soft one */
  const sharp = ((lapSum2 / Math.max(1, m) - lapMean * lapMean) / Math.max(1e-4, contrast * contrast)) * 10;

  return {
    key,
    warmth: sumW / n,
    tint: sumT / n,
    sat: sumS / n,
    contrast,
    sharp,
    clipLow: low / n,
    clipHigh: high / n,
    hash: dhash(grey, w, h),
  };
}

/* dHash: shrink to 9×8, compare neighbours. Frames from one burst differ
   by a handful of bits; different frames by around half of them. */
function dhash(grey: Float32Array, w: number, h: number): [number, number] {
  const cells = new Float32Array(72);
  for (let cy = 0; cy < 8; cy++) {
    for (let cx = 0; cx < 9; cx++) {
      const x0 = Math.floor((cx * w) / 9);
      const x1 = Math.max(x0 + 1, Math.floor(((cx + 1) * w) / 9));
      const y0 = Math.floor((cy * h) / 8);
      const y1 = Math.max(y0 + 1, Math.floor(((cy + 1) * h) / 8));
      let s = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) s += grey[y * w + x];
      cells[cy * 9 + cx] = s / ((x1 - x0) * (y1 - y0));
    }
  }
  let a = 0;
  let b = 0;
  for (let cy = 0; cy < 8; cy++) {
    for (let cx = 0; cx < 8; cx++) {
      const bit = cells[cy * 9 + cx] > cells[cy * 9 + cx + 1] ? 1 : 0;
      const k = cy * 8 + cx;
      if (k < 32) a |= bit << k;
      else b |= bit << (k - 32);
    }
  }
  return [a >>> 0, b >>> 0];
}

const popcount = (x: number) => {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
};

export const hamming = (p: [number, number], q: [number, number]) =>
  popcount((p[0] ^ q[0]) >>> 0) + popcount((p[1] ^ q[1]) >>> 0);

/* -- the series' centre, and who is far from it ------------------- */

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export type Drift = {
  /** exposure difference from the series, in stops */
  stops: number;
  /** warmth difference, in the same −1…1 units as Metrics.warmth */
  warm: number;
  tint: number;
  sat: number;
  /** what an ordinary person would call it */
  reasons: { en: string; my: string }[];
  /** worst of the four, 0 = on the series, 1 = at the flag threshold */
  score: number;
};

/* How far a frame may sit from the centre before it reads as different
   when the series is laid out as a grid. Chosen by eye on real shoots:
   a third of a stop, and a warmth shift of about 300 K. */
const LIMIT = { stops: 0.33, warm: 0.035, tint: 0.025, sat: 0.07 };

export type Centre = { key: number; warmth: number; tint: number; sat: number };

export function centre(ms: Metrics[]): Centre {
  return {
    key: median(ms.map((m) => m.key)),
    warmth: median(ms.map((m) => m.warmth)),
    tint: median(ms.map((m) => m.tint)),
    sat: median(ms.map((m) => m.sat)),
  };
}

const stopsBetween = (a: number, b: number) => Math.log2(Math.max(a, 0.004) / Math.max(b, 0.004));

export function drift(m: Metrics, c: Centre): Drift {
  /* key is in encoded values; stops are measured in linear light */
  const lin = (v: number) => Math.pow(v, 2.2);
  const stops = stopsBetween(lin(m.key), lin(c.key));
  const warm = m.warmth - c.warmth;
  const tint = m.tint - c.tint;
  const sat = m.sat - c.sat;
  const reasons: Drift["reasons"] = [];
  const st = Math.abs(stops).toFixed(1);
  if (stops <= -LIMIT.stops) reasons.push({ en: `${st} stop darker`, my: `${st} stop ပိုမှောင်` });
  if (stops >= LIMIT.stops) reasons.push({ en: `${st} stop brighter`, my: `${st} stop ပိုလင်း` });
  if (warm >= LIMIT.warm) reasons.push({ en: "warmer", my: "ပိုနွေး" });
  if (warm <= -LIMIT.warm) reasons.push({ en: "cooler", my: "ပိုအေး" });
  if (tint >= LIMIT.tint) reasons.push({ en: "greener", my: "ပိုစိမ်း" });
  if (tint <= -LIMIT.tint) reasons.push({ en: "more magenta", my: "ပိုပန်းရောင်" });
  if (sat >= LIMIT.sat) reasons.push({ en: "more saturated", my: "အရောင်ပိုရင့်" });
  if (sat <= -LIMIT.sat) reasons.push({ en: "flatter colour", my: "အရောင်ပိုဖျော့" });
  const score = Math.max(
    Math.abs(stops) / LIMIT.stops,
    Math.abs(warm) / LIMIT.warm,
    Math.abs(tint) / LIMIT.tint,
    Math.abs(sat) / LIMIT.sat,
  );
  return { stops, warm, tint, sat, reasons, score };
}

/**
 * The per-frame correction that pulls a frame back to the series, in
 * Grade's own units, to be added on top of the shared look. Warmth maps
 * through Grade's temperature gain (±0.14 on R and B per unit).
 */
export function correction(d: Drift) {
  const clamp = (x: number, a: number) => Math.max(-a, Math.min(a, x));
  return {
    exposure: clamp(-d.stops, 2),
    temperature: clamp(-d.warm / (0.28 * 0.5), 1),
    tint: clamp(d.tint / (0.09 * 0.5), 1),
    saturation: clamp(-d.sat * 2.2, 1),
  };
}

/* -- culling ------------------------------------------------------ */

export type Cull = { soft: boolean; clipped: boolean; duplicateOf: number | null };

/**
 * Soft is relative to the shoot, not absolute: a series shot wide open
 * is all low-variance, and none of it is out of focus by its own
 * standard. A frame is soft when it has under a third of the median.
 */
export function cull(ms: Metrics[]): Cull[] {
  const med = median(ms.map((m) => m.sharp));

  /* bursts: frames within a few bits of each other form one group, and
     the sharpest of each group is the one worth keeping */
  const group = ms.map((_, i) => i);
  const root = (i: number): number => (group[i] === i ? i : (group[i] = root(group[i])));
  for (let i = 0; i < ms.length; i++) {
    for (let j = 0; j < i; j++) {
      if (hamming(ms[i].hash, ms[j].hash) <= 5) group[root(i)] = root(j);
    }
  }
  const best = new Map<number, number>();
  ms.forEach((m, i) => {
    const r = root(i);
    const b = best.get(r);
    if (b === undefined || m.sharp > ms[b].sharp) best.set(r, i);
  });

  /* clipping is relative too: a shoot on white seamless is all bright */
  const medHigh = median(ms.map((m) => m.clipHigh));
  const medLow = median(ms.map((m) => m.clipLow));

  return ms.map((m, i) => {
    const b = best.get(root(i))!;
    return {
      soft: ms.length >= 3 && m.sharp < med / 3,
      /* blown highlights are lost; deep blacks are usually a choice */
      clipped: m.clipHigh > Math.max(0.03, medHigh * 2 + 0.02) || m.clipLow > Math.max(0.3, medLow * 2 + 0.1),
      duplicateOf: b === i ? null : b,
    };
  });
}
