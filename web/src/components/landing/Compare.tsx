"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "motion/react";
import type { Showcase } from "@/lib/landing";

/* ------------------------------------------------------------------
   A showcase pair: before on the left, after on the right, the seam
   wherever it was let go. It opens at the middle and, the first time
   it comes into view, sways once to say it can be moved.

   Without a photograph each side draws a placeholder in the pair's own
   colours, labelled with where the file goes.
   ------------------------------------------------------------------ */

function Figures({ group }: { group: boolean }) {
  /* a portrait silhouette — one sitter, or a family */
  const one = (cx: number, s: number) => (
    <g key={cx} transform={`translate(${cx} 0) scale(${s})`}>
      <ellipse cx="0" cy="-118" rx="27" ry="33" />
      <path d="M-78 0 C-74 -48 -48 -70 -18 -76 L18 -76 C48 -70 74 -48 78 0 Z" />
    </g>
  );
  return (
    <svg className="ph__fig" viewBox="-160 -170 320 170" preserveAspectRatio="xMidYMax meet">
      {group ? [one(-92, 0.78), one(0, 0.92), one(92, 0.8)] : one(0, 1)}
    </svg>
  );
}

function Side({ item, kind, my }: { item: Showcase; kind: "before" | "after"; my: boolean }) {
  const src = item[kind];
  if (src) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return <img className="cmp__img" src={src} alt={`${my ? item.titleMy : item.title} — ${kind}`} draggable={false} />;
  }
  const [a, b, c] = kind === "before" ? [...item.tone.before, item.tone.before[1]] : item.tone.after;
  return (
    <div className={`ph ph--${kind}`} style={{ "--a": a, "--b": b, "--c": c } as React.CSSProperties}>
      <Figures group={item.aspect > 1} />
      <span className="ph__path">public/landing/showcase/{item.id}-{kind}.jpg</span>
    </div>
  );
}

export function Compare({ item, my }: { item: Showcase; my: boolean }) {
  const frame = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(0.5);
  const [dragging, setDragging] = useState(false);
  const touched = useRef(false);
  const seen = useInView(frame, { once: true, amount: 0.6 });

  /* one sway, the first time it is seen — never once someone has moved it */
  useEffect(() => {
    if (!seen || touched.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = animate(0.5, [0.5, 0.66, 0.36, 0.5], {
      duration: 2.2,
      ease: "easeInOut",
      onUpdate: (v) => {
        if (!touched.current) setPos(v);
      },
    });
    return () => c.stop();
  }, [seen]);

  const fromEvent = (e: React.PointerEvent) => {
    const r = frame.current!.getBoundingClientRect();
    setPos(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
  };

  const label = (en: string, mm: string) => <span className={my ? "my" : "t-micro"}>{my ? mm : en}</span>;

  return (
    <div
      ref={frame}
      className="cmp"
      data-dragging={dragging || undefined}
      style={{ aspectRatio: String(item.aspect) }}
      onPointerDown={(e) => {
        touched.current = true;
        setDragging(true);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
        fromEvent(e);
      }}
      onPointerMove={(e) => dragging && fromEvent(e)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    >
      <div className="cmp__layer">
        <Side item={item} kind="after" my={my} />
      </div>
      <div className="cmp__layer cmp__layer--before" style={{ clipPath: `inset(0 ${(1 - pos) * 100}% 0 0)` }}>
        <Side item={item} kind="before" my={my} />
      </div>

      <span className="cmp__tag cmp__tag--before" style={{ opacity: pos > 0.12 ? 1 : 0 }}>
        {label("Before", "မူရင်း")}
      </span>
      <span className="cmp__tag cmp__tag--after" style={{ opacity: pos < 0.88 ? 1 : 0 }}>
        {label("After", "ပြင်ပြီး")}
      </span>

      <div
        className="cmp__seam"
        style={{ left: `${pos * 100}%` }}
        role="slider"
        tabIndex={0}
        aria-label={my ? `${item.titleMy} — မူရင်းနဲ့ ပြင်ပြီး` : `${item.title} — before and after`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos * 100)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.01 : 0.05;
          const next =
            e.key === "ArrowLeft" ? pos - step : e.key === "ArrowRight" ? pos + step : e.key === "Home" ? 0 : e.key === "End" ? 1 : null;
          if (next === null) return;
          e.preventDefault();
          touched.current = true;
          setPos(Math.min(1, Math.max(0, next)));
        }}
      >
        <span className="cmp__knob" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </div>
  );
}
