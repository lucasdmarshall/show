"use client";

import { useEffect, useState } from "react";

/* ------------------------------------------------------------------
   "The photograph is the only colour."

   The chrome is achromatic by design. The single accent in the UI is
   pulled from whatever image is on screen, then clamped so it stays
   legible against --ink in either theme.
   ------------------------------------------------------------------ */

type Accent = { accent: string; accentInk: string } | null;

const SAMPLE = 32;

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) return { h: 0, s: 0, l };

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;

  return { h: h * 360, s, l };
}

export function useImageAccent(src: string | null, dark: boolean): Accent {
  const [accent, setAccent] = useState<Accent>(null);

  useEffect(() => {
    if (!src) return;
    let cancelled = false;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";

    img.onload = () => {
      if (cancelled) return;

      const canvas = document.createElement("canvas");
      canvas.width = SAMPLE;
      canvas.height = SAMPLE;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);

      let data: Uint8ClampedArray;
      try {
        data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
      } catch {
        return; /* tainted canvas — keep the bone fallback */
      }

      /* Average the hue of the most saturated third of the pixels.
         Averaging hue on a circle, so accumulate as vectors. */
      const pixels: { h: number; s: number; l: number }[] = [];
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 200) continue;
        pixels.push(rgbToHsl(data[i], data[i + 1], data[i + 2]));
      }
      if (pixels.length === 0) return;

      pixels.sort((a, b) => b.s - a.s);
      const top = pixels.slice(0, Math.max(1, Math.round(pixels.length / 3)));

      let x = 0;
      let y = 0;
      let sSum = 0;
      for (const p of top) {
        const rad = (p.h * Math.PI) / 180;
        x += Math.cos(rad) * p.s;
        y += Math.sin(rad) * p.s;
        sSum += p.s;
      }

      const meanS = sSum / top.length;
      /* Not enough chroma to be worth showing — stay achromatic. */
      if (meanS < 0.06) return;

      let h = (Math.atan2(y, x) * 180) / Math.PI;
      if (h < 0) h += 360;

      /* Clamp so the accent can never overpower or fail contrast. */
      const s = Math.min(0.42, Math.max(0.16, meanS * 0.7));
      const l = dark ? 0.78 : 0.42;

      const hsl = `hsl(${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%)`;
      const ink = dark ? "#0a0a0b" : "#f7f6f4";

      setAccent({ accent: hsl, accentInk: ink });
    };

    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src, dark]);

  return accent;
}
