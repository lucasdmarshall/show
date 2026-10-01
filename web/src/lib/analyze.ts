/* ------------------------------------------------------------------
   Reverse — what can honestly be read off a photograph, on the device.

   Everything here is measured, not guessed at by a model: exposure,
   contrast, where the light falls from, colour temperature, saturation,
   how much of the frame is sharp, and the palette. Each reading carries
   the number it came from, so the photographer can disagree with it.

   Subject, wardrobe and pose are not in here. They need a model pass,
   and this file will not pretend otherwise.
   ------------------------------------------------------------------ */

export type ReadingId =
  | "aspect"
  | "key"
  | "contrast"
  | "direction"
  | "temperature"
  | "saturation"
  | "depth";

export type Reading = {
  id: ReadingId;
  group: string;
  groupMy: string;
  /** The measurement, in words. */
  value: string;
  valueMy: string;
  /** The number it came from, shown so it can be argued with. */
  measure: string;
  /** What the engine gets told. */
  descriptor: string;
};

export type Analysis = {
  width: number;
  height: number;
  aspect: string;
  palette: string[];
  readings: Reading[];
};

const SAMPLE = 192;

const ASPECTS: [string, number][] = [
  ["1:1", 1],
  ["4:5", 0.8],
  ["2:3", 0.667],
  ["9:16", 0.5625],
  ["3:2", 1.5],
  ["16:9", 1.778],
];

function nearestAspect(ratio: number): string {
  let best = ASPECTS[0];
  let bestDelta = Infinity;
  for (const entry of ASPECTS) {
    const delta = Math.abs(Math.log(ratio / entry[1]));
    if (delta < bestDelta) {
      bestDelta = delta;
      best = entry;
    }
  }
  return best[0];
}

const luma = (r: number, g: number, b: number) =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

function hex(r: number, g: number, b: number) {
  const h = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export async function analyze(file: File): Promise<Analysis> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  const scale = SAMPLE / Math.max(width, height);
  const w = Math.max(2, Math.round(width * scale));
  const h = Math.max(2, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const { data } = ctx.getImageData(0, 0, w, h);

  /* -- pass one: tone, colour, and where the light sits ------------- */
  let sum = 0;
  let sumSq = 0;
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let satSum = 0;
  let leftSum = 0;
  let leftN = 0;
  let rightSum = 0;
  let rightN = 0;
  let topSum = 0;
  let topN = 0;
  let bottomSum = 0;
  let bottomN = 0;
  const lum = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const l = luma(r, g, b);
      lum[y * w + x] = l;

      sum += l;
      sumSq += l * l;
      rSum += r;
      gSum += g;
      bSum += b;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      satSum += max === 0 ? 0 : (max - min) / max;

      if (x < w / 2) {
        leftSum += l;
        leftN++;
      } else {
        rightSum += l;
        rightN++;
      }
      if (y < h / 2) {
        topSum += l;
        topN++;
      } else {
        bottomSum += l;
        bottomN++;
      }
    }
  }

  const n = w * h;
  const mean = sum / n;
  const sd = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
  const meanSat = satSum / n;
  const rAvg = rSum / n;
  const gAvg = gSum / n;
  const bAvg = bSum / n;

  /* -- pass two: where the detail is, centre against edge ---------- */
  let centreEnergy = 0;
  let centreN = 0;
  let edgeEnergy = 0;
  let edgeN = 0;
  const cx = w / 2;
  const cy = h / 2;
  const inner = Math.min(w, h) * 0.3;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      /* Laplacian — high where the image is locally sharp. */
      const e = Math.abs(
        4 * lum[i] - lum[i - 1] - lum[i + 1] - lum[i - w] - lum[i + w],
      );
      const dist = Math.hypot(x - cx, y - cy);
      if (dist < inner) {
        centreEnergy += e;
        centreN++;
      } else {
        edgeEnergy += e;
        edgeN++;
      }
    }
  }

  const centreSharp = centreN ? centreEnergy / centreN : 0;
  const edgeSharp = edgeN ? edgeEnergy / edgeN : 0;
  const sharpRatio = edgeSharp > 0 ? centreSharp / edgeSharp : 1;

  /* -- palette: coarse quantise, most frequent buckets -------------- */
  const buckets = new Map<number, { c: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const key =
      (data[i] >> 5 << 10) | (data[i + 1] >> 5 << 5) | (data[i + 2] >> 5);
    const entry = buckets.get(key);
    if (entry) {
      entry.c++;
      entry.r += data[i];
      entry.g += data[i + 1];
      entry.b += data[i + 2];
    } else {
      buckets.set(key, { c: 1, r: data[i], g: data[i + 1], b: data[i + 2] });
    }
  }
  const palette = [...buckets.values()]
    .sort((a, b) => b.c - a.c)
    .slice(0, 6)
    .map((e) => hex(e.r / e.c, e.g / e.c, e.b / e.c));

  /* ---------------------------------------------------------------- */
  const readings: Reading[] = [];
  const aspect = nearestAspect(width / height);

  readings.push({
    id: "aspect",
    group: "Frame",
    groupMy: "ဘောင်",
    value: `${aspect} · ${width}×${height}`,
    valueMy: `${aspect} · ${width}×${height}`,
    measure: (width / height).toFixed(3),
    descriptor: "",
  });

  /* exposure key */
  const key =
    mean < 0.3
      ? {
          v: "Low key",
          my: "မှောင်နေ",
          d: "low-key exposure, most of the frame sitting in shadow, highlights held back",
        }
      : mean > 0.62
        ? {
            v: "High key",
            my: "လင်းနေ",
            d: "high-key exposure, bright throughout, shadows lifted and open",
          }
        : {
            v: "Mid key",
            my: "အလယ်အလတ်",
            d: "balanced mid exposure, full range from shadow to highlight",
          };
  readings.push({
    id: "key",
    group: "Exposure",
    groupMy: "အလင်းအမှောင်",
    value: key.v,
    valueMy: key.my,
    measure: `mean luma ${mean.toFixed(3)}`,
    descriptor: key.d,
  });

  /* contrast */
  const contrast =
    sd < 0.13
      ? { v: "Flat", my: "ပြားနေ", d: "low contrast, compressed tonal range, soft separation" }
      : sd > 0.24
        ? { v: "High", my: "ကွာဟမှုများ", d: "high contrast, deep blacks against clean highlights" }
        : { v: "Normal", my: "ပုံမှန်", d: "natural contrast, neither crushed nor flat" };
  readings.push({
    id: "contrast",
    group: "Contrast",
    groupMy: "ကွာဟမှု",
    value: contrast.v,
    valueMy: contrast.my,
    measure: `σ ${sd.toFixed(3)}`,
    descriptor: contrast.d,
  });

  /* light direction */
  const lr = leftSum / leftN - rightSum / rightN;
  const tb = topSum / topN - bottomSum / bottomN;
  const horiz = Math.abs(lr) > 0.035 ? (lr > 0 ? "left" : "right") : null;
  const vert = Math.abs(tb) > 0.05 ? (tb > 0 ? "above" : "below") : null;
  const dirWords = horiz
    ? vert
      ? `from camera ${horiz} and ${vert}`
      : `from camera ${horiz}`
    : vert
      ? `from ${vert}`
      : "frontally and evenly";
  const dirMy = horiz
    ? horiz === "left"
      ? "ဘယ်ဘက်မှ"
      : "ညာဘက်မှ"
    : vert === "above"
      ? "အပေါ်မှ"
      : "ရှေ့တည့်တည့်";
  readings.push({
    id: "direction",
    group: "Light",
    groupMy: "အလင်း",
    value: `Falls ${dirWords}`,
    valueMy: `${dirMy} ကျရောက်`,
    measure: `L−R ${lr.toFixed(3)} · T−B ${tb.toFixed(3)}`,
    descriptor: `the key light falling ${dirWords}, shadow side unfilled`,
  });

  /* colour temperature */
  const warmth = (rAvg - bAvg) / 255;
  const temp =
    warmth > 0.07
      ? { v: "Warm", my: "နွေး", d: "warm colour temperature, amber cast through the highlights" }
      : warmth < -0.04
        ? { v: "Cool", my: "အေး", d: "cool colour temperature, blue cast holding the shadows" }
        : { v: "Neutral", my: "ကြားနေ", d: "neutral white balance, no colour cast" };
  readings.push({
    id: "temperature",
    group: "Temperature",
    groupMy: "အရောင်အပူချိန်",
    value: temp.v,
    valueMy: temp.my,
    measure: `R−B ${warmth.toFixed(3)} · G ${(gAvg / 255).toFixed(2)}`,
    descriptor: temp.d,
  });

  /* saturation */
  const sat =
    meanSat < 0.16
      ? { v: "Muted", my: "မှိန်", d: "desaturated palette, colour held well back" }
      : meanSat > 0.38
        ? { v: "Saturated", my: "ပြင်း", d: "richly saturated colour, hues pushed" }
        : { v: "Natural", my: "သဘာဝ", d: "natural saturation, colour true to the subject" };
  readings.push({
    id: "saturation",
    group: "Saturation",
    groupMy: "အရောင်ပြင်းအား",
    value: sat.v,
    valueMy: sat.my,
    measure: `mean S ${meanSat.toFixed(3)}`,
    descriptor: sat.d,
  });

  /* depth of field */
  const depth =
    sharpRatio > 1.7
      ? {
          v: "Shallow",
          my: "အနက်တိမ်",
          d: "shallow depth of field, the subject sharp and the surround dissolving",
        }
      : sharpRatio < 1.05
        ? {
            v: "Deep",
            my: "အနက်များ",
            d: "deep focus, sharp from foreground to background",
          }
        : {
            v: "Moderate",
            my: "အလယ်အလတ်",
            d: "moderate depth of field, background soft but still readable",
          };
  readings.push({
    id: "depth",
    group: "Focus",
    groupMy: "ဖိုကပ်",
    value: depth.v,
    valueMy: depth.my,
    measure: `centre/edge ${sharpRatio.toFixed(2)}`,
    descriptor: depth.d,
  });

  return { width, height, aspect, palette, readings };
}

/** What a device cannot read off pixels, stated plainly. */
export const NOT_MEASURED = [
  { label: "Subject", labelMy: "လူပုံ" },
  { label: "Wardrobe", labelMy: "ဝတ်စုံ" },
  { label: "Pose and expression", labelMy: "ဟန်နှင့် မျက်နှာထား" },
  { label: "Place", labelMy: "နေရာ" },
];
