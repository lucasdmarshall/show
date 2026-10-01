"use client";

import { useMemo, useRef, useState } from "react";
import { curveLUT, type Channel, type Curves as CurveSet, type Point } from "@/lib/grade";

/* ------------------------------------------------------------------
   Curves — tap to add a point where the line should pass, drag to
   bend it, pull a point out of the box (or press Delete) to remove it.
   The ends slide vertically only, so black and white stay anchored.
   ------------------------------------------------------------------ */

const S = 256;
const GAP = 0.012;

const CHANNELS: { id: Channel; label: string }[] = [
  { id: "master", label: "RGB" },
  { id: "r", label: "R" },
  { id: "g", label: "G" },
  { id: "b", label: "B" },
];

function pathOf(points: Point[]) {
  const lut = curveLUT(points);
  let d = "";
  for (let i = 0; i < 256; i++) {
    d += `${i === 0 ? "M" : " L"}${i} ${(S - lut[i]).toFixed(1)}`;
  }
  return d;
}

type Props = {
  curves: CurveSet;
  onChange: (channel: Channel, points: Point[]) => void;
  /** Luma histogram, drawn faintly behind the curve. */
  backdrop?: Uint32Array | null;
  my: boolean;
};

export function Curves({ curves, onChange, backdrop, my }: Props) {
  const [channel, setChannel] = useState<Channel>("master");
  const [drag, setDrag] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const points = curves[channel];

  const back = useMemo(() => {
    if (!backdrop) return null;
    let peak = 1;
    for (let i = 1; i < 255; i++) peak = Math.max(peak, Math.sqrt(backdrop[i]));
    let d = `M0 ${S}`;
    for (let i = 0; i < 256; i++) {
      d += ` L${i} ${(S - Math.min(1, Math.sqrt(backdrop[i]) / peak) * S * 0.9).toFixed(1)}`;
    }
    return `${d} L255 ${S} Z`;
  }, [backdrop]);

  const at = (e: React.PointerEvent): Point => {
    const r = svgRef.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
  };

  const place = (idx: number, [x, y]: Point, list: Point[]): Point[] => {
    const next = list.map((p) => [...p] as Point);
    const last = next.length - 1;
    const px =
      idx === 0 ? 0 : idx === last ? 1 : Math.min(next[idx + 1][0] - GAP, Math.max(next[idx - 1][0] + GAP, x));
    next[idx] = [px, Math.min(1, Math.max(0, y))];
    return next;
  };

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const target = e.target as Element;
    const hit = target.getAttribute("data-idx");
    svgRef.current!.setPointerCapture(e.pointerId);

    if (hit !== null) {
      setDrag(Number(hit));
      return;
    }

    /* a new point, placed exactly where the finger went down */
    const [x, y] = at(e);
    if (x <= GAP || x >= 1 - GAP) return;
    const idx = points.findIndex((p) => p[0] > x);
    if (idx <= 0) return;
    const next = [...points.slice(0, idx), [x, Math.min(1, Math.max(0, y))] as Point, ...points.slice(idx)];
    onChange(channel, next);
    setDrag(idx);
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (drag === null) return;
    onChange(channel, place(drag, at(e), points));
  };

  const onUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (drag === null) return;
    const [, y] = at(e);
    const interior = drag > 0 && drag < points.length - 1;
    /* dragged well outside the box: take it away */
    if (interior && (y < -0.08 || y > 1.08)) {
      onChange(channel, points.filter((_, i) => i !== drag));
    }
    setDrag(null);
  };

  const onKey = (idx: number) => (e: React.KeyboardEvent<SVGCircleElement>) => {
    const step = e.shiftKey ? 10 / 255 : 1 / 255;
    const [x, y] = points[idx];
    let next: Point | null = null;
    if (e.key === "ArrowUp") next = [x, y + step];
    else if (e.key === "ArrowDown") next = [x, y - step];
    else if (e.key === "ArrowLeft") next = [x - step, y];
    else if (e.key === "ArrowRight") next = [x + step, y];
    else if ((e.key === "Delete" || e.key === "Backspace") && idx > 0 && idx < points.length - 1) {
      e.preventDefault();
      onChange(channel, points.filter((_, i) => i !== idx));
      return;
    }
    if (!next) return;
    e.preventDefault();
    onChange(channel, place(idx, next, points));
  };

  const others = CHANNELS.filter((c) => c.id !== channel && curves[c.id].length > 2);

  return (
    <div className="curves">
      <div className="curves__chans" role="tablist" aria-label={my ? "Channel" : "Channel"}>
        {CHANNELS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={channel === c.id}
            data-ch={c.id}
            onClick={() => setChannel(c.id)}
          >
            {c.label}
            {curves[c.id].length > 2 ? <span className="curves__dot" aria-hidden="true" /> : null}
          </button>
        ))}
        <button
          type="button"
          className="curves__reset"
          disabled={points.length === 2 && points[0][1] === 0 && points[1][1] === 1}
          onClick={() =>
            onChange(channel, [
              [0, 0],
              [1, 1],
            ])
          }
        >
          {my ? "ပြန်ထား" : "Reset"}
        </button>
      </div>

      <svg
        ref={svgRef}
        className="curves__box"
        viewBox={`0 0 ${S} ${S}`}
        data-ch={channel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => setDrag(null)}
        aria-label={
          my
            ? "Curve — နှိပ်ရင် အမှတ်ထည့်၊ ဆွဲရင် ကွေး၊ ဘောင်အပြင် ဆွဲထုတ်ရင် ဖျက်"
            : "Curve — tap to add a point, drag to bend, drag out of the box to remove"
        }
      >
        {back ? <path className="curves__back" d={back} /> : null}
        {[64, 128, 192].map((v) => (
          <g key={v} className="curves__grid">
            <line x1={v} y1={0} x2={v} y2={S} />
            <line x1={0} y1={v} x2={S} y2={v} />
          </g>
        ))}
        <line className="curves__diag" x1={0} y1={S} x2={S} y2={0} />
        {others.map((c) => (
          <path key={c.id} className="curves__ghost" data-ch={c.id} d={pathOf(curves[c.id])} />
        ))}
        <path className="curves__line" d={pathOf(points)} />
        {points.map(([x, y], i) => (
          <g key={i}>
            {/* the visible dot is small; the finger gets a 44px target */}
            <circle data-idx={i} className="curves__hit" cx={x * S} cy={S - y * S} r={20} />
            <circle
              data-idx={i}
              className="curves__pt"
              data-active={drag === i || undefined}
              cx={x * S}
              cy={S - y * S}
              r={6.5}
              tabIndex={0}
              role="button"
              aria-label={`${my ? "အမှတ်" : "Point"} ${i + 1}: in ${Math.round(x * 255)}, out ${Math.round(y * 255)}`}
              onKeyDown={onKey(i)}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
