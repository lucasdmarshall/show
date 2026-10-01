/* ------------------------------------------------------------------
   Composite — make a pasted subject read as part of the scene.

   A cut-out looks pasted for five measurable reasons: its colour
   statistics are not the scene's, its edge is too hard, the scene's
   light does not spill round it, it casts no shadow, and its grain and
   haze are not the scene's. Each is corrected here, on the device, and
   each has its own amount — never on/off.

   The subject's pixels are only ever re-coloured as a whole; nothing
   inside the face is redrawn. That is the pixel lock.

   No DOM, no imports: pure functions over RGBA arrays, so the engine
   checks can run it under Node.
   ------------------------------------------------------------------ */

export type Harmony = {
  /** colour and exposure matched to the scene, 0–1 */
  match: number;
  /** scene light wrapping round the subject's edge */
  wrap: number;
  /** edge softness */
  edge: number;
  /** contact + cast shadow on the ground */
  shadow: number;
  /** rim light on the side the light comes from */
  rim: number;
  fog: number;
  rays: number;
  /** out-of-focus foreground band */
  foreground: number;
  grain: number;
  /** −1 light from the left, +1 from the right, 0 = read it off the scene */
  side: number;
  /** a final tone push, in the same units as Grade */
  warmth: number;
  contrast: number;
  saturation: number;
};

export const HARMONY_NEUTRAL: Harmony = {
  match: 0,
  wrap: 0,
  edge: 0,
  shadow: 0,
  rim: 0,
  fog: 0,
  rays: 0,
  foreground: 0,
  grain: 0,
  side: 0,
  warmth: 0,
  contrast: 0,
  saturation: 0,
};

export type Place = {
  /** subject centre, as a fraction of the scene width */
  x: number;
  /** subject feet, as a fraction of the scene height */
  y: number;
  /** subject height, as a fraction of the scene height */
  h: number;
};

/* -- helpers ------------------------------------------------------ */

const clamp = (v: number, a = 0, b = 255) => (v < a ? a : v > b ? b : v);

function blur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const rr = Math.max(0, Math.round(r));
  if (!rr) return src.slice();
  const a = src.slice();
  const b = new Float32Array(src.length);
  const norm = 1 / (2 * rr + 1);
  for (let pass = 0; pass < 2; pass++) {
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

function blurRGB(px: Uint8ClampedArray, w: number, h: number, r: number) {
  const n = w * h;
  const ch = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let p = 0; p < n; p++) {
    ch[0][p] = px[p * 4];
    ch[1][p] = px[p * 4 + 1];
    ch[2][p] = px[p * 4 + 2];
  }
  return ch.map((c) => blur(c, w, h, r));
}

/** Where the scene's light comes from: −1 left … +1 right. */
export function lightSide(bg: Uint8ClampedArray, w: number, h: number): number {
  let left = 0;
  let right = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      const l = 0.2126 * bg[i] + 0.7152 * bg[i + 1] + 0.0722 * bg[i + 2];
      if (x < w / 2) left += l;
      else right += l;
    }
  }
  const d = (right - left) / Math.max(1, right + left);
  return Math.max(-1, Math.min(1, d * 8));
}

type Stats = { mean: [number, number, number]; std: [number, number, number] };

/* Colour stats in a simple opponent space — cheap, and close enough to
   Lab for matching means and spreads. */
const toOpp = (r: number, g: number, b: number): [number, number, number] => [
  (r + g + b) / 3,
  r - g,
  (r + g) / 2 - b,
];
const fromOpp = (l: number, a: number, bb: number): [number, number, number] => {
  /* inverse of the above */
  const b = l - (2 / 3) * bb;
  const rg = 3 * l - b; // r + g
  const r = (rg + a) / 2;
  const g = (rg - a) / 2;
  return [r, g, b];
};

function stats(px: Uint8ClampedArray, weight: (p: number) => number, n: number): Stats {
  const s = [0, 0, 0];
  const s2 = [0, 0, 0];
  let wsum = 0;
  for (let p = 0; p < n; p += 1) {
    const w = weight(p);
    if (w <= 0) continue;
    const o = toOpp(px[p * 4], px[p * 4 + 1], px[p * 4 + 2]);
    for (let k = 0; k < 3; k++) {
      s[k] += o[k] * w;
      s2[k] += o[k] * o[k] * w;
    }
    wsum += w;
  }
  wsum = Math.max(1e-6, wsum);
  const mean = s.map((v) => v / wsum) as Stats["mean"];
  const std = s2.map((v, k) => Math.sqrt(Math.max(1, v / wsum - mean[k] * mean[k]))) as Stats["std"];
  return { mean, std };
}

/* deterministic noise — the same composite renders the same every time */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/* -- keying a plain backdrop -------------------------------------- */

/**
 * A subject shot against a plain backdrop, with no transparency: flood
 * in from the border through every pixel close to the border's colour.
 * Returns an alpha channel, softened by one pixel.
 */
export function keyBackdrop(px: Uint8ClampedArray, w: number, h: number, tolerance: number): Uint8ClampedArray {
  /* the backdrop colour: median of the border */
  const border: number[][] = [];
  for (let x = 0; x < w; x += 3) border.push([x, 0], [x, h - 1]);
  for (let y = 0; y < h; y += 3) border.push([0, y], [w - 1, y]);
  const med = [0, 1, 2].map((k) => {
    const v = border.map(([x, y]) => px[(y * w + x) * 4 + k]).sort((a, b) => a - b);
    return v[v.length >> 1];
  });
  const tol = 18 + tolerance * 90;
  const near = (p: number) => {
    const o = p * 4;
    const dr = px[o] - med[0];
    const dg = px[o + 1] - med[1];
    const db = px[o + 2] - med[2];
    return Math.sqrt(dr * dr + dg * dg + db * db) < tol;
  };
  const out = new Uint8ClampedArray(w * h).fill(255);
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (const [x, y] of border) {
    const p = y * w + x;
    if (!seen[p] && near(p)) {
      seen[p] = 1;
      stack.push(p);
    }
  }
  while (stack.length) {
    const p = stack.pop()!;
    out[p] = 0;
    const x = p % w;
    const y = (p / w) | 0;
    const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
    for (const q of nb) {
      if (q < 0 || seen[q]) continue;
      seen[q] = 1;
      if (near(q)) stack.push(q);
    }
  }
  /* soften the cut by a pixel so it does not stair-step */
  const f = new Float32Array(w * h);
  for (let i = 0; i < f.length; i++) f[i] = out[i];
  const s = blur(f, w, h, 1);
  for (let i = 0; i < s.length; i++) out[i] = s[i];
  return out;
}

/** Share of fully transparent pixels — has the subject been cut out? */
export function transparency(px: Uint8ClampedArray): number {
  let t = 0;
  for (let i = 3; i < px.length; i += 16) if (px[i] < 16) t++;
  return t / (px.length / 16);
}

/* -- the composite ------------------------------------------------ */

export type Layers = {
  /** the scene, full RGBA */
  bg: Uint8ClampedArray;
  /** the subject already placed on a scene-sized layer, straight alpha */
  fg: Uint8ClampedArray;
  w: number;
  h: number;
};

export type Rendered = {
  /** cut and pasted, nothing else */
  raw: Uint8ClampedArray;
  /** everything applied */
  out: Uint8ClampedArray;
  /** the side the light was taken from */
  side: number;
};

export function harmonize({ bg, fg, w, h }: Layers, s: Harmony, seed = 7): Rendered {
  const n = w * h;
  const k = Math.max(w, h) / 1400; // radii are tuned at preview size

  /* alpha, feathered */
  let alpha = new Float32Array(n);
  for (let p = 0; p < n; p++) alpha[p] = fg[p * 4 + 3] / 255;
  const hard = alpha;
  if (s.edge > 0) {
    const soft = blur(alpha, w, h, s.edge * 5 * k);
    /* feather inwards only — never a halo of the old background */
    alpha = soft.map((v, p) => Math.min(v, hard[p]) * 0.5 + v * hard[p] * 0.5);
  }

  const raw = new Uint8ClampedArray(n * 4);
  for (let p = 0; p < n; p++) {
    const o = p * 4;
    const a = hard[p];
    raw[o] = bg[o] * (1 - a) + fg[o] * a;
    raw[o + 1] = bg[o + 1] * (1 - a) + fg[o + 1] * a;
    raw[o + 2] = bg[o + 2] * (1 - a) + fg[o + 2] * a;
    raw[o + 3] = 255;
  }

  const side = s.side !== 0 ? Math.sign(s.side) : lightSide(bg, w, h) >= 0 ? 1 : -1;

  /* subject's bounding box, for local scene statistics */
  let x0 = w;
  let x1 = 0;
  let y0 = h;
  let y1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (hard[y * w + x] > 0.5) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  const has = x1 > x0 && y1 > y0;

  /* 1. colour match: subject's statistics towards the scene around it */
  const col = fg.slice();
  if (s.match > 0 && has) {
    const bw = x1 - x0;
    const bh = y1 - y0;
    const rx0 = Math.max(0, x0 - bw);
    const rx1 = Math.min(w - 1, x1 + bw);
    const ry0 = Math.max(0, y0 - bh * 0.5);
    const ry1 = Math.min(h - 1, y1 + bh * 0.3);
    const sceneStats = stats(
      bg,
      (p) => {
        const x = p % w;
        const y = (p / w) | 0;
        return x >= rx0 && x <= rx1 && y >= ry0 && y <= ry1 ? 1 - hard[p] : 0;
      },
      n,
    );
    const subjStats = stats(fg, (p) => (hard[p] > 0.5 ? 1 : 0), n);
    /* luminance follows the scene only part of the way — a subject is
       usually meant to be the brightest thing in its frame */
    const kk = [0.55, 0.85, 0.85].map((f) => f * s.match);
    for (let p = 0; p < n; p++) {
      if (hard[p] <= 0) continue;
      const o = p * 4;
      const v = toOpp(fg[o], fg[o + 1], fg[o + 2]);
      for (let c = 0; c < 3; c++) {
        const ratio = Math.pow(sceneStats.std[c] / subjStats.std[c], c === 0 ? 0.35 : 0.6);
        const t = (v[c] - subjStats.mean[c]) * ratio + sceneStats.mean[c];
        v[c] = v[c] + (t - v[c]) * kk[c];
      }
      const [r, g, b] = fromOpp(v[0], v[1], v[2]);
      col[o] = clamp(r);
      col[o + 1] = clamp(g);
      col[o + 2] = clamp(b);
    }
  }

  /* edge terms: how close to the subject's outline, from inside */
  const needEdge = s.wrap > 0 || s.rim > 0;
  const near = needEdge ? blur(hard, w, h, 6 * k) : null;

  /* 2. light wrap: the blurred scene bleeding over the inner edge */
  if (s.wrap > 0 && near) {
    const [br, bgc, bb] = blurRGB(bg, w, h, 14 * k);
    for (let p = 0; p < n; p++) {
      if (hard[p] <= 0) continue;
      const e = Math.max(0, hard[p] - near[p]) * 2.2 * s.wrap;
      if (e <= 0) continue;
      const o = p * 4;
      /* screen, so the wrap only ever brightens */
      col[o] = col[o] + (255 - (255 - col[o]) * (255 - br[p]) / 255 - col[o]) * Math.min(1, e);
      col[o + 1] = col[o + 1] + (255 - (255 - col[o + 1]) * (255 - bgc[p]) / 255 - col[o + 1]) * Math.min(1, e);
      col[o + 2] = col[o + 2] + (255 - (255 - col[o + 2]) * (255 - bb[p]) / 255 - col[o + 2]) * Math.min(1, e);
    }
  }

  /* 3. rim light on the side facing the light */
  if (s.rim > 0 && near) {
    /* the scene's brightest tenth, as the colour of its light */
    let lr = 0;
    let lg = 0;
    let lb = 0;
    let m = 0;
    for (let p = 0; p < n; p += 7) {
      const o = p * 4;
      const l = 0.2126 * bg[o] + 0.7152 * bg[o + 1] + 0.0722 * bg[o + 2];
      if (l > 200) {
        lr += bg[o];
        lg += bg[o + 1];
        lb += bg[o + 2];
        m++;
      }
    }
    const L = m ? [lr / m, lg / m, lb / m] : [255, 236, 200];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        if (hard[p] <= 0) continue;
        const gx = near[p + 1] - near[p - 1];
        /* light from the right lights edges where alpha falls to the right */
        const facing = Math.max(0, -gx * side) * 6;
        const e = Math.min(1, facing * Math.max(0, hard[p] - near[p]) * 4 * s.rim);
        if (e <= 0) continue;
        const o = p * 4;
        col[o] += (L[0] - col[o]) * e;
        col[o + 1] += (L[1] - col[o + 1]) * e;
        col[o + 2] += (L[2] - col[o + 2]) * e;
      }
    }
  }

  /* 4. shadow on the ground, cast away from the light */
  const ground = bg.slice();
  if (s.shadow > 0 && has) {
    const cast = new Float32Array(n);
    const contact = new Float32Array(n);
    const feet = y1;
    const squash = 0.14;
    const skew = -side * 0.9;
    for (let y = y0; y <= y1; y++) {
      const up = feet - y; // height above the feet
      const sy = Math.round(feet + up * squash * 0.35);
      if (sy >= h) continue;
      const shift = Math.round(up * squash * skew * 2.4);
      for (let x = x0; x <= x1; x++) {
        const a = hard[y * w + x];
        if (a <= 0) continue;
        const sx = x + shift;
        if (sx < 0 || sx >= w) continue;
        cast[sy * w + sx] = Math.max(cast[sy * w + sx], a * (1 - up / Math.max(1, feet - y0)) * 0.8);
      }
    }
    /* contact: the last few rows of the subject, pressed onto the ground */
    const foot = Math.max(2, Math.round((y1 - y0) * 0.03));
    for (let y = y1 - foot; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const a = hard[y * w + x];
        if (a > 0.5) {
          for (let dy = 0; dy < foot; dy++) {
            const yy = y1 + dy - Math.round(foot / 2);
            if (yy >= 0 && yy < h) contact[yy * w + x] = 1;
          }
        }
      }
    }
    const soft = blur(cast, w, h, 10 * k);
    const tight = blur(contact, w, h, 2.5 * k);
    for (let p = 0; p < n; p++) {
      const d = Math.min(0.85, (soft[p] * 0.55 + tight[p] * 0.75) * s.shadow);
      if (d <= 0) continue;
      const o = p * 4;
      ground[o] *= 1 - d;
      ground[o + 1] *= 1 - d * 0.97;
      ground[o + 2] *= 1 - d * 0.92;
    }
  }

  /* 5. put together */
  const out = new Uint8ClampedArray(n * 4);
  for (let p = 0; p < n; p++) {
    const o = p * 4;
    const a = alpha[p];
    out[o] = ground[o] * (1 - a) + col[o] * a;
    out[o + 1] = ground[o + 1] * (1 - a) + col[o + 1] * a;
    out[o + 2] = ground[o + 2] * (1 - a) + col[o + 2] * a;
    out[o + 3] = 255;
  }

  /* 6. atmosphere over everything — the same air in front of both */
  if (s.fog > 0) {
    let fr = 0;
    let fgc = 0;
    let fb = 0;
    let m = 0;
    for (let p = 0; p < n * 0.3; p += 5) {
      fr += bg[p * 4];
      fgc += bg[p * 4 + 1];
      fb += bg[p * 4 + 2];
      m++;
    }
    const F = [fr / m, fgc / m, fb / m].map((v) => v * 0.4 + 200 * 0.6);
    for (let y = 0; y < h; y++) {
      const t = s.fog * (0.18 + 0.42 * (1 - y / h));
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        out[o] += (F[0] - out[o]) * t;
        out[o + 1] += (F[1] - out[o + 1]) * t;
        out[o + 2] += (F[2] - out[o + 2]) * t;
      }
    }
  }

  if (s.rays > 0) {
    const sx = side > 0 ? w * 0.92 : w * 0.08;
    const sy = -h * 0.08;
    const r = rng(seed);
    const beams = Array.from({ length: 48 }, () => r());
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - sx;
        const dy = y - sy;
        const ang = (Math.atan2(dy, dx) / Math.PI + 1) * 24; // 0…48
        const i0 = Math.floor(ang) % 48;
        const f = ang - Math.floor(ang);
        const beam = beams[i0] * (1 - f) + beams[(i0 + 1) % 48] * f;
        const dist = Math.sqrt(dx * dx + dy * dy) / Math.max(w, h);
        const v = Math.pow(beam, 4) * Math.max(0, 1 - dist * 1.1) * s.rays * 90;
        const o = (y * w + x) * 4;
        out[o] = clamp(out[o] + v);
        out[o + 1] = clamp(out[o + 1] + v * 0.9);
        out[o + 2] = clamp(out[o + 2] + v * 0.7);
      }
    }
  }

  if (s.foreground > 0) {
    const [br, bgc, bb] = blurRGB(out, w, h, 9 * k * (0.5 + s.foreground));
    for (let y = Math.floor(h * 0.72); y < h; y++) {
      const t = Math.min(1, ((y - h * 0.72) / (h * 0.28)) * 1.4) * s.foreground;
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        const o = p * 4;
        out[o] += (br[p] - out[o]) * t;
        out[o + 1] += (bgc[p] - out[o + 1]) * t;
        out[o + 2] += (bb[p] - out[o + 2]) * t;
      }
    }
  }

  /* 7. the final tone push, then the same grain over every pixel */
  if (s.warmth || s.contrast || s.saturation) {
    for (let p = 0; p < n; p++) {
      const o = p * 4;
      let r = out[o] * (1 + 0.12 * s.warmth);
      let g = out[o + 1];
      let b = out[o + 2] * (1 - 0.12 * s.warmth);
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const sat = 1 + s.saturation;
      r = l + (r - l) * sat;
      g = l + (g - l) * sat;
      b = l + (b - l) * sat;
      const c = 1 + s.contrast;
      out[o] = clamp((r - 128) * c + 128);
      out[o + 1] = clamp((g - 128) * c + 128);
      out[o + 2] = clamp((b - 128) * c + 128);
    }
  }

  if (s.grain > 0) {
    const r = rng(seed * 31 + 3);
    const amp = s.grain * 16;
    for (let p = 0; p < n; p++) {
      const g = (r() + r() + r() - 1.5) * amp;
      const o = p * 4;
      out[o] = clamp(out[o] + g);
      out[o + 1] = clamp(out[o + 1] + g);
      out[o + 2] = clamp(out[o + 2] + g);
    }
  }

  return { raw, out, side };
}

/* -- modes: twelve starting points -------------------------------- */

export type HMode = {
  id: string;
  label: string;
  labelMy: string;
  /** what a relighting model is told, for the premium pass */
  descriptor: string;
  set: Partial<Harmony>;
  mm?: boolean;
};

const base: Partial<Harmony> = { match: 0.7, wrap: 0.35, edge: 0.35, shadow: 0.55, grain: 0.15 };

export const HMODES: HMode[] = [
  { id: "natural", label: "Natural match", labelMy: "သဘာဝကျကျ", descriptor: "relit to match the scene's existing light exactly, invisible composite", set: { ...base } },
  { id: "cinema", label: "Cinematic relight", labelMy: "ရုပ်ရှင်ဆန်", descriptor: "cinematic relight, motivated key from the scene's light source, deep contrast, teal shadows and warm highlights", set: { ...base, rim: 0.45, contrast: 0.12, warmth: 0.15, saturation: -0.08 } },
  { id: "cleanup", label: "Studio cleanup", labelMy: "စတူဒီယို သန့်", descriptor: "clean studio relight, even soft key, neutral colour, crisp separation", set: { ...base, match: 0.45, wrap: 0.15, shadow: 0.35, grain: 0.05 } },
  { id: "soft", label: "Soft studio", labelMy: "နူးညံ့ စတူဒီယို", descriptor: "soft wraparound studio light, lifted shadows, gentle falloff", set: { ...base, wrap: 0.55, edge: 0.5, contrast: -0.1 } },
  { id: "pastel", label: "Dreamy pastel", labelMy: "ပန်းနုရောင် အိပ်မက်", descriptor: "dreamy pastel palette, airy highlights, soft haze, low contrast", set: { ...base, fog: 0.3, wrap: 0.6, contrast: -0.18, saturation: -0.15, warmth: 0.08 } },
  { id: "season", label: "Seasonal passage", labelMy: "ရာသီကူး", descriptor: "the light of a changing season, monsoon-washed air, cool diffuse daylight", set: { ...base, fog: 0.2, warmth: -0.2, saturation: -0.1 }, mm: true },
  { id: "golden", label: "Golden hour", labelMy: "ရွှေရောင် ညနေ", descriptor: "low golden-hour sun from behind, warm rim light, long soft shadows", set: { ...base, rim: 0.7, rays: 0.35, warmth: 0.35, shadow: 0.7 } },
  { id: "night", label: "Night glow", labelMy: "ညအလင်း", descriptor: "night scene lit by practical lamps, warm pools of light, deep blue ambient", set: { ...base, match: 0.85, rim: 0.35, contrast: 0.1, warmth: -0.1, grain: 0.3 } },
  { id: "noir", label: "Film noir", labelMy: "အဖြူအမည်း ရုပ်ရှင်", descriptor: "black and white film noir, hard single source, deep shadows", set: { ...base, rim: 0.5, contrast: 0.3, saturation: -1, grain: 0.35 } },
  { id: "mist", label: "Misty morning", labelMy: "မြူနှင်းမနက်", descriptor: "early misty morning, soft volumetric haze, cool quiet light", set: { ...base, fog: 0.55, rays: 0.2, contrast: -0.12, warmth: -0.08 } },
  { id: "high", label: "High key", labelMy: "အလင်းလွှမ်း", descriptor: "bright high-key light, white airy scene, minimal shadow", set: { ...base, wrap: 0.5, shadow: 0.25, contrast: -0.15 } },
  { id: "festival", label: "Festival lights", labelMy: "သီတင်းကျွတ် မီးထွန်း", descriptor: "Thadingyut festival night, hundreds of small oil lamps and paper lanterns, warm flickering glow", set: { ...base, rim: 0.55, warmth: 0.3, grain: 0.25, rays: 0.15 }, mm: true },
];

/** Four readings of the same composite, for picking rather than tuning. */
export function variants(s: Harmony): Harmony[] {
  const scale = (f: number): Harmony => ({
    ...s,
    match: Math.min(1, s.match * f),
    wrap: Math.min(1, s.wrap * f),
    shadow: Math.min(1, s.shadow * f),
    rim: Math.min(1, s.rim * f),
    fog: Math.min(1, s.fog * f),
  });
  return [scale(0.6), s, scale(1.35), { ...s, side: s.side === 0 ? -1 : -s.side }];
}
