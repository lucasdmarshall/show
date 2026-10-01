/* ------------------------------------------------------------------
   Album layout — pure geometry, no imports, so the engine checks can
   run it under plain Node.
   ------------------------------------------------------------------ */

export type Rect = { x: number; y: number; w: number; h: number };

/* How many photographs each spread holds, cycling so a long album has
   rhythm — a full-bleed hero, then a pair, then a grid. */
const RHYTHM = [1, 3, 2, 4, 2, 3, 5, 2];

export function planSpreads(aspects: number[]): number[][] {
  const out: number[][] = [];
  let i = 0;
  let r = 0;
  while (i < aspects.length) {
    let n = RHYTHM[r % RHYTHM.length];
    /* a lone landscape photograph earns the whole spread */
    if (n === 1 && aspects[i] < 1.2) n = 2;
    n = Math.min(n, aspects.length - i);
    out.push(Array.from({ length: n }, (_, k) => i + k));
    i += n;
    r++;
  }
  return out;
}

/**
 * Justified rows: each row's photographs share one height and together
 * fill the width exactly, so nothing is cropped. One or two rows,
 * whichever leaves less of the page empty.
 */
export function layoutSpread(aspects: number[], W: number, H: number, margin: number, gutter: number): Rect[] {
  const iw = W - margin * 2;
  const ih = H - margin * 2;
  const n = aspects.length;
  if (n === 1 && margin === 0) return [{ x: 0, y: 0, w: W, h: H }];

  /* Justified rows fill the width exactly with no cropping; the block
     is then scaled to fit the page and centred. What differs between
     candidate splits is how much of the page is left empty. */
  const rows = (split: number[][]) => {
    const heights = split.map((row) => (iw - gutter * (row.length - 1)) / row.reduce((s, i) => s + aspects[i], 0));
    const total = heights.reduce((s, h) => s + h, 0) + gutter * (split.length - 1);
    const k = Math.min(1, ih / total);
    const bw = iw * k;
    const bh = total * k;
    const ox = margin + (iw - bw) / 2;
    let y = margin + (ih - bh) / 2;
    const rects: Rect[] = [];
    let used = 0;
    split.forEach((row, ri) => {
      const rh = heights[ri] * k;
      let x = ox;
      row.forEach((i) => {
        const w = aspects[i] * rh;
        rects.push({ x, y, w, h: rh });
        used += w * rh;
        x += w + gutter * k;
      });
      y += rh + gutter * k;
    });
    return { rects, crop: 1 - used / (iw * ih) };
  };

  const idx = aspects.map((_, i) => i);
  let best = rows([idx]);
  for (let cut = 1; cut < n; cut++) {
    const cand = rows([idx.slice(0, cut), idx.slice(cut)]);
    if (cand.crop < best.crop) best = cand;
  }
  lastCrop = best.crop;
  return best.rects;
}

let lastCrop = 0;

/**
 * A lay-flat spread: a single photograph may run across the fold, but
 * two or more are split between the pages so no face lands in the
 * gutter. The split is whichever crops least.
 */
export function layoutAlbum(aspects: number[], W: number, H: number, margin: number, gutter: number): Rect[] {
  const n = aspects.length;
  if (n <= 1) return [{ x: 0, y: 0, w: W, h: H }];
  const half = W / 2;
  let best: { rects: Rect[]; crop: number } | null = null;
  for (let k = 1; k < n; k++) {
    const left = layoutSpread(aspects.slice(0, k), half, H, margin, gutter);
    const lc = lastCrop;
    const right = layoutSpread(aspects.slice(k), half, H, margin, gutter);
    const rc = lastCrop;
    /* the emptier page decides; balanced pages are preferred a little */
    const crop = Math.max(lc, rc) + Math.abs(k - n / 2) * 0.03;
    if (!best || crop < best.crop) {
      best = { crop, rects: [...left, ...right.map((r) => ({ ...r, x: r.x + half }))] };
    }
  }
  return best!.rects;
}

