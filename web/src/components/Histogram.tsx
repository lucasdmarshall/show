"use client";

import type { Histogram as H } from "@/lib/grade";

/* SVG, not canvas: it themes through CSS and stays crisp at any size. */

function area(bins: Uint32Array, peak: number, h: number) {
  let d = `M0 ${h}`;
  for (let i = 0; i < 256; i++) {
    const v = Math.min(1, Math.sqrt(bins[i]) / peak);
    d += ` L${i} ${(h - v * h).toFixed(2)}`;
  }
  return `${d} L255 ${h} Z`;
}

function line(bins: Uint32Array, peak: number, h: number) {
  let d = "";
  for (let i = 0; i < 256; i++) {
    const v = Math.min(1, Math.sqrt(bins[i]) / peak);
    d += `${i === 0 ? "M" : " L"}${i} ${(h - v * h).toFixed(2)}`;
  }
  return d;
}

export function Histogram({ data, my }: { data: H | null; my: boolean }) {
  const h = 64;
  if (!data) return <div className="hist hist--empty" aria-hidden="true" />;

  /* Scale by the tallest interior bin, so a clipped end cannot flatten
     everything else into a line along the floor. */
  let peak = 1;
  for (const bins of [data.r, data.g, data.b]) {
    for (let i = 1; i < 255; i++) peak = Math.max(peak, Math.sqrt(bins[i]));
  }

  const lowPct = data.clipLow * 100;
  const highPct = data.clipHigh * 100;

  return (
    <figure className="hist">
      <svg
        viewBox={`0 0 255 ${h}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={
          my
            ? `Histogram — အမှောင်ဘက် ${lowPct.toFixed(1)}%၊ အလင်းဘက် ${highPct.toFixed(1)}% ပြတ်နေ`
            : `Histogram — ${lowPct.toFixed(1)}% clipped to black, ${highPct.toFixed(1)}% to white`
        }
      >
        <path className="hist__r" d={area(data.r, peak, h)} />
        <path className="hist__g" d={area(data.g, peak, h)} />
        <path className="hist__b" d={area(data.b, peak, h)} />
        <path className="hist__l" d={line(data.l, peak, h)} />
      </svg>
      <figcaption className="hist__clip t-micro">
        <span data-warn={lowPct > 0.5 || undefined}>
          {my ? "အမှောင်" : "Black"} {lowPct.toFixed(1)}%
        </span>
        <span data-warn={highPct > 0.5 || undefined}>
          {my ? "အလင်း" : "White"} {highPct.toFixed(1)}%
        </span>
      </figcaption>
    </figure>
  );
}
