"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import "./reveal.css";

/* The frame is full-bleed within the shell at every breakpoint. */
const SIZES = "(min-width: 1440px) 1376px, 100vw";

/* ------------------------------------------------------------------
   The Reveal — SHOW's signature interaction.

   Two layers: a before/after comparison. Left of the handle is the
   result, right of it the original, and the handle stays exactly where
   it is let go — a photographer judges an edit at the seam, not at the
   ends.

   More than two: the pipeline. The handle sweeps through the stages —
   crossing a tick advances the stage — so one gesture reads out how far,
   and how it was made.

   Every Reveal opens into a full-screen viewer (⤢, or double-click)
   where the same comparison can be zoomed to the pixel and panned,
   both layers moving together so the seam never lies.
   ------------------------------------------------------------------ */

export type RevealLayer = {
  id: string;
  /** English stage name, e.g. "Light" */
  label: string;
  /** Burmese stage name */
  labelMy: string;
  /**
   * Prototype mode: a CSS filter describing this stage's contribution.
   * Production mode uses `src` instead — a real rendered layer.
   */
  filter?: string;
  src?: string;
};

type RevealProps = {
  src: string;
  alt: string;
  /** layers[0] must be the untouched original. */
  layers: RevealLayer[];
  /** Show Burmese stage names. */
  my?: boolean;
  className?: string;
  /**
   * `cover` crops to the frame's own shape — right for a showcase.
   * `contain` keeps every pixel — right for judging a grade.
   */
  fit?: "cover" | "contain";
  /** width / height; overrides the frame's default shape. */
  aspect?: number;
  /** Where the handle starts, 0–1. */
  initial?: number;
  /** Wheel, pinch and drag-to-pan inside the frame (the viewer turns this on). */
  zoomable?: boolean;
  /** Offer the full-screen viewer. On by default. */
  expandable?: boolean;
};

type View = { z: number; x: number; y: number };
type Gesture =
  | { kind: "slide" }
  | { kind: "pan"; sx: number; sy: number; ox: number; oy: number }
  | { kind: "pinch"; d0: number; z0: number; mx: number; my: number; ox: number; oy: number };

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const MAX_Z = 8;
const NEAR_HANDLE = 28;

export function Reveal({
  src,
  alt,
  layers,
  my = false,
  className,
  fit = "cover",
  aspect,
  initial = 0.5,
  zoomable = false,
  expandable = true,
}: RevealProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const [labelVisible, setLabelVisible] = useState(false);
  const [view, setView] = useState<View>({ z: 1, x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const labelTimer = useRef<number | null>(null);
  const touched = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const sliderId = useId();

  const count = layers.length;
  /* two layers compare; more walk a pipeline */
  const compare = count === 2;
  const lastIndex = Math.max(1, count - 1);

  /* Stage is the tick nearest the handle — or, comparing, always the result. */
  const stage = compare ? 1 : Math.min(lastIndex, Math.round(progress * lastIndex));
  const active = layers[stage] ?? layers[0];

  const ticks = useMemo(() => (compare ? [] : layers.map((_, i) => i / lastIndex)), [layers, lastIndex, compare]);

  /* --- label auto-hide ------------------------------------------- */
  const flashLabel = useCallback(() => {
    setLabelVisible(true);
    if (labelTimer.current) window.clearTimeout(labelTimer.current);
    labelTimer.current = window.setTimeout(() => setLabelVisible(false), 1400);
  }, []);

  useEffect(() => {
    return () => {
      if (labelTimer.current) window.clearTimeout(labelTimer.current);
    };
  }, []);

  /* --- zoom ------------------------------------------------------- */
  const clampView = useCallback((v: View): View => {
    const el = frameRef.current;
    if (!el) return v;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const z = Math.min(MAX_Z, Math.max(1, v.z));
    return { z, x: Math.min(0, Math.max(w - w * z, v.x)), y: Math.min(0, Math.max(h - h * z, v.y)) };
  }, []);

  /** Zoom to `nz`, keeping the frame point (px, py) still under the finger. */
  const zoomAt = useCallback(
    (px: number, py: number, nz: number, from?: View) =>
      setView((cur) => {
        const v = from ?? cur;
        const z = Math.min(MAX_Z, Math.max(1, nz));
        return clampView({ z, x: px - ((px - v.x) * z) / v.z, y: py - ((py - v.y) * z) / v.z });
      }),
    [clampView],
  );

  /* wheel zoom needs a non-passive listener to keep the page still */
  useEffect(() => {
    const el = frameRef.current;
    if (!el || !zoomable) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      touched.current = true;
      const r = el.getBoundingClientRect();
      setView((v) => {
        const z = Math.min(MAX_Z, Math.max(1, v.z * Math.exp(-e.deltaY * 0.0015)));
        const px = e.clientX - r.left;
        const py = e.clientY - r.top;
        return clampView({ z, x: px - ((px - v.x) * z) / v.z, y: py - ((py - v.y) * z) / v.z });
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomable, clampView]);

  /* --- pointer ---------------------------------------------------- */
  const local = (clientX: number, clientY: number) => {
    const r = frameRef.current!.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top, w: r.width };
  };

  const setFromClientX = useCallback((clientX: number) => {
    const el = frameRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    setProgress(clamp01((clientX - rect.left) / rect.width));
  }, []);

  const startPinch = () => {
    const [a, b] = [...pointers.current.values()];
    const r = frameRef.current!.getBoundingClientRect();
    gesture.current = {
      kind: "pinch",
      d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      z0: view.z,
      mx: (a.x + b.x) / 2 - r.left,
      my: (a.y + b.y) / 2 - r.top,
      ox: view.x,
      oy: view.y,
    };
    setDragging(false);
    setPanning(false);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-reveal-control]")) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* a pointer the browser no longer tracks — follow it without capture */
    }
    touched.current = true;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (zoomable && pointers.current.size === 2) {
      startPinch();
      return;
    }
    if (pointers.current.size > 1) return;

    const p = local(e.clientX, e.clientY);
    const nearHandle = Math.abs(p.x - progress * p.w) < NEAR_HANDLE;
    /* zoomed in: the handle still slides, everywhere else pans */
    if (zoomable && view.z > 1.001 && !nearHandle) {
      gesture.current = { kind: "pan", sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y };
      setPanning(true);
      return;
    }
    gesture.current = { kind: "slide" };
    setDragging(true);
    setFromClientX(e.clientX);
    flashLabel();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "slide") {
      setFromClientX(e.clientX);
      flashLabel();
    } else if (g.kind === "pan") {
      setView((v) => clampView({ ...v, x: g.ox + (e.clientX - g.sx), y: g.oy + (e.clientY - g.sy) }));
    } else if (g.kind === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const r = frameRef.current!.getBoundingClientRect();
      const mx = (a.x + b.x) / 2 - r.left;
      const my2 = (a.y + b.y) / 2 - r.top;
      const z = Math.min(MAX_Z, Math.max(1, (g.z0 * d) / g.d0));
      /* the point under the fingers' midpoint stays put, and follows them */
      setView(
        clampView({
          z,
          x: mx - ((g.mx - g.ox) * z) / g.z0,
          y: my2 - ((g.my - g.oy) * z) / g.z0,
        }),
      );
    }
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const el = e.currentTarget as HTMLElement;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    const g = gesture.current;
    if (pointers.current.size > 0) {
      /* one finger left after a pinch: carry on as a pan */
      if (g?.kind === "pinch") {
        const [p] = [...pointers.current.values()];
        gesture.current = { kind: "pan", sx: p.x, sy: p.y, ox: view.x, oy: view.y };
      }
      return;
    }
    gesture.current = null;
    setPanning(false);
    if (g?.kind === "slide") {
      setDragging(false);
      /* a pipeline settles onto its nearest stage; a comparison stays put */
      if (!compare) setProgress(Math.round(progress * lastIndex) / lastIndex);
    }
  };

  const onDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-reveal-control]")) return;
    if (zoomable) {
      const p = local(e.clientX, e.clientY);
      if (view.z > 1.001) setView({ z: 1, x: 0, y: 0 });
      else zoomAt(p.x, p.y, 2.5);
    } else if (expandable) {
      setExpanded(true);
    }
  };

  /* --- keyboard --------------------------------------------------- */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const fine = e.shiftKey;
    const step = compare ? (fine ? 0.01 : 0.05) : fine ? 0.02 : 1 / lastIndex;
    let next: number | null = null;

    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = progress + step;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = progress - step;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 1;
    else if (zoomable && (e.key === "+" || e.key === "=")) {
      e.preventDefault();
      const el = frameRef.current!;
      zoomAt(el.clientWidth / 2, el.clientHeight / 2, view.z * 1.5);
      return;
    } else if (zoomable && e.key === "-") {
      e.preventDefault();
      const el = frameRef.current!;
      zoomAt(el.clientWidth / 2, el.clientHeight / 2, view.z / 1.5);
      return;
    } else if (zoomable && e.key === "0") {
      e.preventDefault();
      setView({ z: 1, x: 0, y: 0 });
      return;
    } else if (expandable && !zoomable && (e.key === "Enter" || e.key === "f")) {
      e.preventDefault();
      setExpanded(true);
      return;
    }

    if (next === null) return;
    e.preventDefault();
    touched.current = true;
    const snapped = fine || compare ? next : Math.round(next * lastIndex) / lastIndex;
    setProgress(clamp01(snapped));
    flashLabel();
  };

  /* --- idle hint: nudge once, on first sight ---------------------- */
  useEffect(() => {
    const el = frameRef.current;
    if (!el || zoomable) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let done = false;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || done || touched.current) return;
        done = true;
        io.disconnect();

        /* nudge toward the centre, whichever side the handle starts on */
        const from = initial;
        const peak = initial > 0.5 ? initial - 0.08 : initial + 0.08;
        const start = performance.now();
        const total = 1100;
        const tick = (now: number) => {
          /* the moment someone takes the handle, the hint lets go */
          if (touched.current) return;
          const t = Math.min(1, (now - start) / total);
          const wave = Math.sin(t * Math.PI);
          const eased = 1 - Math.pow(1 - wave, 3);
          setProgress(from + (peak - from) * eased);
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );

    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the hint runs once, from where the handle started
  }, []);

  const pct = progress * 100;
  const original = layers[0];
  const zoomed = view.z > 1.001;
  const layerStyle: React.CSSProperties = zoomable
    ? { transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`, transformOrigin: "0 0" }
    : {};

  return (
    <figure className={className} style={{ margin: 0 }}>
      <div
        ref={frameRef}
        className="reveal"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
        role="slider"
        tabIndex={0}
        aria-label={alt}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-valuetext={`${my ? active.labelMy : active.label} — ${Math.round(pct)}%`}
        aria-describedby={sliderId}
        data-dragging={dragging || undefined}
        data-panning={panning || undefined}
        data-zoomable={zoomable || undefined}
        data-zoomed={zoomed || undefined}
        data-compare={compare || undefined}
        data-fit={fit}
        style={aspect ? { aspectRatio: String(aspect) } : undefined}
      >
        {/* base: the untouched original */}
        <div className="reveal__layer" style={layerStyle}>
          <Image
            src={original.src ?? src}
            alt=""
            fill
            sizes={SIZES}
            priority
            className="reveal__img"
            style={{ filter: original.filter }}
            draggable={false}
          />
        </div>

        {/* the result (or the current stage), wiped in from the left */}
        <div className="reveal__clip" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}>
          <div className="reveal__layer" style={layerStyle}>
            <Image
              key={active.id}
              src={active.src ?? src}
              alt=""
              fill
              sizes={SIZES}
              priority
              className="reveal__img reveal__img--stage"
              style={{ filter: active.filter }}
              draggable={false}
            />
          </div>
        </div>

        {/* stage ticks */}
        {ticks.length ? (
          <div className="reveal__ticks" aria-hidden="true">
            {ticks.map((t, i) => (
              <span
                key={layers[i].id}
                className="reveal__tick"
                data-passed={progress >= t - 0.001 || undefined}
                style={{ left: `${t * 100}%` }}
              />
            ))}
          </div>
        ) : null}

        {/* comparing: which side is which, always on screen */}
        {compare ? (
          <>
            <span className={`reveal__side reveal__side--l ${my ? "my" : "t-micro"}`} data-hidden={pct < 12 || undefined} aria-hidden="true">
              {my ? layers[1].labelMy : layers[1].label}
            </span>
            <span className={`reveal__side reveal__side--r ${my ? "my" : "t-micro"}`} data-hidden={pct > 88 || undefined} aria-hidden="true">
              {my ? layers[0].labelMy : layers[0].label}
            </span>
          </>
        ) : null}

        {/* handle */}
        <div className="reveal__handle" style={{ left: `${pct}%` }} aria-hidden="true">
          <span className="reveal__line" />
          <span className="reveal__grip">
            <svg viewBox="0 0 24 24">
              <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          {compare ? null : (
            <span className={`reveal__label ${my ? "my" : "t-micro"}`} data-visible={labelVisible || dragging || undefined}>
              {my ? active.labelMy : active.label}
            </span>
          )}
        </div>

        {/* controls */}
        {zoomable ? (
          <div className="reveal__zoom" data-reveal-control>
            <button type="button" onClick={() => zoomAt(frameRef.current!.clientWidth / 2, frameRef.current!.clientHeight / 2, view.z / 1.5)} aria-label={my ? "ချုံ့" : "Zoom out"} disabled={!zoomed}>
              −
            </button>
            <button type="button" className="reveal__pct" onClick={() => setView({ z: 1, x: 0, y: 0 })} aria-label={my ? "အပြည့်ပြ" : "Fit"}>
              {Math.round(view.z * 100)}%
            </button>
            <button type="button" onClick={() => zoomAt(frameRef.current!.clientWidth / 2, frameRef.current!.clientHeight / 2, view.z * 1.5)} aria-label={my ? "ချဲ့" : "Zoom in"} disabled={view.z >= MAX_Z}>
              +
            </button>
          </div>
        ) : expandable ? (
          <button
            type="button"
            className="reveal__expand"
            data-reveal-control
            onClick={() => setExpanded(true)}
            aria-label={my ? "အပြည့် ဖွင့်ကြည့်" : "Open full screen to zoom"}
            title={my ? "ချဲ့ကြည့် (double-click)" : "Zoom in (double-click)"}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>

      <figcaption id={sliderId} className="reveal__caption t-small">
        <span className="reveal__stages" aria-hidden="true">
          {layers.map((l, i) => (
            <span key={l.id} data-on={i === stage || undefined}>
              {my ? l.labelMy : l.label}
            </span>
          ))}
        </span>
        <span className="reveal__pos" aria-hidden="true">
          {Math.round(pct)}%
        </span>
      </figcaption>

      {expanded ? (
        <RevealViewer
          src={src}
          alt={alt}
          layers={layers}
          my={my}
          aspect={aspect}
          initial={progress}
          onClose={(p) => {
            setProgress(p);
            setExpanded(false);
          }}
        />
      ) : null}
    </figure>
  );
}

/* -- the full-screen viewer ----------------------------------------- */

function RevealViewer({
  src,
  alt,
  layers,
  my,
  aspect,
  initial,
  onClose,
}: {
  src: string;
  alt: string;
  layers: RevealLayer[];
  my: boolean;
  aspect?: number;
  initial: number;
  onClose: (progress: number) => void;
}) {
  const [ratio, setRatio] = useState<number | null>(aspect ?? null);
  const box = useRef<HTMLDivElement>(null);

  /* the frame takes the photograph's own shape, so zoom has no bars to wander into */
  useEffect(() => {
    if (ratio) return;
    const img = new window.Image();
    img.onload = () => setRatio(img.naturalWidth / img.naturalHeight || 1);
    img.src = layers[layers.length - 1].src ?? src;
  }, [ratio, layers, src]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(initial);
    document.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.querySelector<HTMLElement>(".reveal")?.focus();
    return () => {
      document.removeEventListener("keydown", k);
      document.body.style.overflow = prev;
    };
  }, [onClose, initial]);

  return (
    <div className="rviewer" role="dialog" aria-modal="true" aria-label={alt}>
      <div className="rviewer__bar">
        <span className={`rviewer__hint ${my ? "my" : "t-small"}`}>
          {my
            ? "ဆွဲပြီး ယှဉ်ကြည့် · wheel / လက်နှစ်ချောင်းနဲ့ ချဲ့ · double-click 250% · ချဲ့ထားရင် ဆွဲပြီး ရွှေ့"
            : "Drag to compare · scroll or pinch to zoom · double-click for 250% · drag to pan when zoomed"}
        </span>
        <button type="button" className="rviewer__close" onClick={() => onClose(initial)} aria-label={my ? "ပိတ်" : "Close"}>
          ×
        </button>
      </div>
      <div ref={box} className="rviewer__stage">
        {ratio ? (
          <div className="rviewer__frame" style={{ "--ar": ratio } as React.CSSProperties}>
            <Reveal src={src} alt={alt} layers={layers} my={my} fit="contain" aspect={ratio} initial={initial} zoomable expandable={false} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
