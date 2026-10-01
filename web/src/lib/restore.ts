/* ------------------------------------------------------------------
   Restore — the repair that can be done without a model.

   A scanned print loses three things: specks (dust, mould, pinholes),
   lines (scratches and hairline cracks) and range (fading, yellowing, a
   colour cast as one dye layer goes). All three are local or global
   statistics problems, and all three are solved here on the device.

   The rule that matters: only defects are repainted. Every pixel that
   is not flagged comes back exactly as scanned, so a face is never
   redrawn — and the mask of what was touched is returned, so the
   person can see that for themselves.

   No imports: this file runs under the engine checks in plain Node.
   ------------------------------------------------------------------ */

export type Tone = "as-is" | "mono" | "sepia";

export type RestoreSettings = {
  /** 0–1: how small a deviation still counts as a speck */
  dust: number;
  /** 0–1: how faint a line still counts as a scratch */
  scratches: number;
  /** 0–1: how far to restore the lost range and remove the cast */
  fade: number;
  tone: Tone;
  /** 0–1 unsharp mask */
  sharpen: number;
};

export const RESTORE_DEFAULT: RestoreSettings = {
  dust: 0.4,
  scratches: 0.35,
  fade: 0.7,
  tone: "as-is",
  sharpen: 0.25,
};

const lumaOf = (px: Uint8ClampedArray, w: number, h: number) => {
  const L = new Uint8Array(w * h);
  for (let i = 0, p = 0; p < L.length; i += 4, p++) {
    L[p] = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2] + 0.5) | 0;
  }
  return L;
};

/**
 * Square median filter by Huang's sliding histogram — O(r) per pixel
 * instead of sorting (2r+1)² values, which is what makes a 7×7 median
 * over a 1400px scan fast enough on a phone.
 */
export function median(src: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const out = new Uint8Array(w * h);
  const hist = new Uint32Array(256);
  const half = ((2 * r + 1) * (2 * r + 1)) >> 1;
  const at = (x: number, y: number) =>
    src[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];

  for (let y = 0; y < h; y++) {
    hist.fill(0);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) hist[at(dx, y + dy)]++;
    let mdn = 0;
    let below = 0;
    /* find the median of the first window */
    for (let acc = 0; mdn < 256; mdn++) {
      if (acc + hist[mdn] > half) break;
      acc += hist[mdn];
      below = acc;
    }
    out[y * w] = mdn;

    for (let x = 1; x < w; x++) {
      for (let dy = -r; dy <= r; dy++) {
        const gone = at(x - r - 1, y + dy);
        const come = at(x + r, y + dy);
        hist[gone]--;
        if (gone < mdn) below--;
        hist[come]++;
        if (come < mdn) below++;
      }
      /* walk the median to where half the window sits below it */
      while (below > half) {
        mdn--;
        below -= hist[mdn];
      }
      while (below + hist[mdn] <= half) {
        below += hist[mdn];
        mdn++;
      }
      out[y * w + x] = mdn;
    }
  }
  return out;
}

/** Specks: pixels far from their neighbourhood's median, grown by one. */
export function findSpecks(L: Uint8Array, w: number, h: number, amount: number, scale = 1): Uint8Array {
  const mask = new Uint8Array(w * h);
  if (amount <= 0) return mask;
  /* the same speck is more pixels across in a larger render */
  const r = Math.min(8, Math.max(3, Math.round(3 * scale)));
  const med = median(L, w, h, r);
  const thr = 56 - 44 * amount; // 56 … 12 grey levels
  for (let i = 0; i < L.length; i++) if (Math.abs(L[i] - med[i]) > thr) mask[i] = 1;
  return grow(dropLarge(mask, w, h, Math.round(80 * scale * scale)), w, h);
}

/* A speck is small. A flagged region bigger than this is an eye, a
   button, an edge — structure, not damage — and is left alone. */
function dropLarge(mask: Uint8Array, w: number, h: number, maxArea: number): Uint8Array {
  const seen = new Uint8Array(mask.length);
  const stack: number[] = [];
  const region: number[] = [];
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || seen[s]) continue;
    region.length = 0;
    stack.push(s);
    seen[s] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      region.push(p);
      const x = p % w;
      const y = (p / w) | 0;
      const visit = (q: number) => {
        if (mask[q] && !seen[q]) {
          seen[q] = 1;
          stack.push(q);
        }
      };
      if (x > 0) visit(p - 1);
      if (x < w - 1) visit(p + 1);
      if (y > 0) visit(p - w);
      if (y < h - 1) visit(p + w);
    }
    if (region.length > maxArea) for (const p of region) mask[p] = 0;
  }
  return mask;
}

function grow(mask: Uint8Array, w: number, h: number): Uint8Array {
  const out = mask.slice();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      if (x > 0) out[i - 1] = 1;
      if (x < w - 1) out[i + 1] = 1;
      if (y > 0) out[i - w] = 1;
      if (y < h - 1) out[i + w] = 1;
    }
  }
  return out;
}

/**
 * Scratches: a thin line differs from its neighbours across the line
 * but not along it. A vertical scratch stands out against a horizontal
 * 1×9 median; the candidates that form a long vertical run are kept.
 * Same again, turned ninety degrees.
 */
export function findScratches(L: Uint8Array, w: number, h: number, amount: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  if (amount <= 0) return mask;
  const thr = 34 - 26 * amount; // 34 … 8
  const minRun = Math.max(12, Math.round(Math.max(w, h) * 0.03));
  const win = new Uint8Array(9);

  const lineMedian = (i: number, step: number, lo: number, hi: number, pos: number) => {
    let n = 0;
    for (let k = -4; k <= 4; k++) {
      const q = Math.min(hi, Math.max(lo, pos + k));
      win[n++] = L[i + (q - pos) * step];
    }
    win.sort();
    return win[4];
  };

  /* vertical lines: compare across (horizontal median), run down */
  const cand = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (Math.abs(L[i] - lineMedian(i, 1, 0, w - 1, x)) > thr) cand[i] = 1;
    }
  }
  for (let x = 0; x < w; x++) {
    let start = -1;
    for (let y = 0; y <= h; y++) {
      const on = y < h && (cand[y * w + x] || (x > 0 && cand[y * w + x - 1]) || (x < w - 1 && cand[y * w + x + 1]));
      if (on && start < 0) start = y;
      if (!on && start >= 0) {
        if (y - start >= minRun) for (let k = start; k < y; k++) if (cand[k * w + x]) mask[k * w + x] = 1;
        start = -1;
      }
    }
  }

  /* horizontal lines: compare across (vertical median), run along */
  cand.fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (Math.abs(L[i] - lineMedian(i, w, 0, h - 1, y)) > thr) cand[i] = 1;
    }
  }
  for (let y = 0; y < h; y++) {
    let start = -1;
    for (let x = 0; x <= w; x++) {
      const i = y * w + x;
      const on = x < w && (cand[i] || (y > 0 && cand[i - w]) || (y < h - 1 && cand[i + w]));
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        if (x - start >= minRun) for (let k = start; k < x; k++) if (cand[y * w + k]) mask[y * w + k] = 1;
        start = -1;
      }
    }
  }
  return grow(mask, w, h);
}

/**
 * Fill the masked pixels from the unmasked ones around them, working
 * inwards ring by ring — each pass fills every masked pixel that has a
 * known neighbour with the mean of its known neighbours.
 */
export function inpaint(px: Uint8ClampedArray, w: number, h: number, mask: Uint8Array) {
  const todo = mask.slice();
  let left = 0;
  for (let i = 0; i < todo.length; i++) left += todo[i];
  const next: number[] = [];
  const vals: number[] = [];
  for (let pass = 0; left > 0 && pass < 64; pass++) {
    next.length = 0;
    vals.length = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (!todo[p]) continue;
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w || (!dx && !dy)) continue;
            const q = yy * w + xx;
            if (todo[q]) continue;
            const o = q * 4;
            r += px[o];
            g += px[o + 1];
            b += px[o + 2];
            n++;
          }
        }
        if (n) {
          next.push(p);
          vals.push(r / n, g / n, b / n);
        }
      }
    }
    if (!next.length) break;
    for (let k = 0; k < next.length; k++) {
      const o = next[k] * 4;
      px[o] = vals[k * 3];
      px[o + 1] = vals[k * 3 + 1];
      px[o + 2] = vals[k * 3 + 2];
      todo[next[k]] = 0;
    }
    left -= next.length;
  }
}

/* -- range, cast and tone ----------------------------------------- */

function percentile(hist: Uint32Array, total: number, q: number) {
  const target = total * q;
  let acc = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= target) return i;
  }
  return 255;
}

/** Is this a monochrome print (B&W or toned) rather than a colour one? */
export function isMonochrome(px: Uint8ClampedArray): boolean {
  let spread = 0;
  let n = 0;
  for (let i = 0; i < px.length; i += 16) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    spread += Math.max(r, g, b) - Math.min(r, g, b);
    n++;
  }
  /* sepia sits around 20–35 levels of spread; a colour print well above */
  return spread / Math.max(1, n) < 38;
}

/**
 * Stretch each channel back to its full range. On a colour print this
 * also removes the cast of a faded dye layer; on a toned monochrome
 * print the channels are stretched together so the toning survives.
 */
export function unfade(px: Uint8ClampedArray, amount: number, mono: boolean) {
  if (amount <= 0) return;
  const hr = new Uint32Array(256);
  const hg = new Uint32Array(256);
  const hb = new Uint32Array(256);
  const hl = new Uint32Array(256);
  const n = px.length / 4;
  for (let i = 0; i < px.length; i += 4) {
    hr[px[i]]++;
    hg[px[i + 1]]++;
    hb[px[i + 2]]++;
    hl[(0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) | 0]++;
  }
  const lut = (lo: number, hi: number) => {
    const t = new Uint8Array(256);
    const span = Math.max(8, hi - lo);
    for (let v = 0; v < 256; v++) {
      const s = Math.min(255, Math.max(0, ((v - lo) / span) * 255));
      t[v] = Math.round(v + (s - v) * amount);
    }
    return t;
  };
  const q = [0.004, 0.996] as const;
  let R: Uint8Array;
  let G: Uint8Array;
  let B: Uint8Array;
  if (mono) {
    const l = lut(percentile(hl, n, q[0]), percentile(hl, n, q[1]));
    R = G = B = l;
  } else {
    R = lut(percentile(hr, n, q[0]), percentile(hr, n, q[1]));
    G = lut(percentile(hg, n, q[0]), percentile(hg, n, q[1]));
    B = lut(percentile(hb, n, q[0]), percentile(hb, n, q[1]));
  }
  for (let i = 0; i < px.length; i += 4) {
    px[i] = R[px[i]];
    px[i + 1] = G[px[i + 1]];
    px[i + 2] = B[px[i + 2]];
  }
}

export function retone(px: Uint8ClampedArray, tone: Tone) {
  if (tone === "as-is") return;
  for (let i = 0; i < px.length; i += 4) {
    const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    if (tone === "mono") {
      px[i] = px[i + 1] = px[i + 2] = l;
    } else {
      /* a classic selenium-sepia split: warm mids, near-neutral ends */
      const t = l / 255;
      const k = 4 * t * (1 - t);
      px[i] = l + 22 * k;
      px[i + 1] = l + 6 * k;
      px[i + 2] = l - 18 * k;
    }
  }
}

/** Unsharp mask on luma only, so sharpening never adds colour fringes. */
export function sharpen(px: Uint8ClampedArray, w: number, h: number, amount: number) {
  if (amount <= 0) return;
  const L = new Float32Array(w * h);
  for (let i = 0, p = 0; p < L.length; i += 4, p++) L[p] = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
  /* 3×3 gaussian */
  const B = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let wt = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = Math.min(h - 1, Math.max(0, y + dy));
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.min(w - 1, Math.max(0, x + dx));
          const k = (dx ? 1 : 2) * (dy ? 1 : 2);
          s += L[yy * w + xx] * k;
          wt += k;
        }
      }
      B[y * w + x] = s / wt;
    }
  }
  const k = amount * 1.6;
  for (let i = 0, p = 0; p < L.length; i += 4, p++) {
    const d = (L[p] - B[p]) * k;
    px[i] += d;
    px[i + 1] += d;
    px[i + 2] += d;
  }
}

/* -- the whole repair, in stages the Reveal can scrub ------------- */

export type Repaired = {
  /** specks and scratches filled; everything else as scanned */
  clean: Uint8ClampedArray;
  /** plus range, tone and sharpening */
  final: Uint8ClampedArray;
  /** 1 where a pixel was repainted */
  mask: Uint8Array;
  touched: number;
  mono: boolean;
};

/** `scale` is this render's size against the preview's, so export finds the same defects. */
export function repair(src: Uint8ClampedArray, w: number, h: number, s: RestoreSettings, scale = 1): Repaired {
  const L = lumaOf(src, w, h);
  const specks = findSpecks(L, w, h, s.dust, scale);
  const lines = findScratches(L, w, h, s.scratches);
  const mask = new Uint8Array(w * h);
  let touched = 0;
  for (let i = 0; i < mask.length; i++) {
    if (specks[i] || lines[i]) {
      mask[i] = 1;
      touched++;
    }
  }
  const clean = src.slice();
  inpaint(clean, w, h, mask);

  const final = clean.slice();
  const mono = isMonochrome(src);
  unfade(final, s.fade, mono || s.tone !== "as-is");
  retone(final, s.tone);
  sharpen(final, w, h, s.sharpen);
  return { clean, final, mask, touched, mono };
}
