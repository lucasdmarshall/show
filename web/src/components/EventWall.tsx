"use client";

import { useEffect, useRef, useState } from "react";
import { qr, wallUrl, type EventDoc, type EventPhoto } from "@/lib/event";
import { urlOf } from "@/lib/vault";

/* ------------------------------------------------------------------
   The live wall — the venue TV. Five ways to show the night, the
   event's name in Burmese across the top, and a QR in the corner.
   It reads the same store the desk writes, so a photograph appears
   here the moment it is made guest-ready.
   ------------------------------------------------------------------ */

export const WALLS = [
  { id: "mosaic", label: "Mosaic", labelMy: "Mosaic" },
  { id: "slideshow", label: "Slideshow", labelMy: "တစ်ပုံချင်း" },
  { id: "polaroid", label: "Polaroids", labelMy: "Polaroid" },
  { id: "strip", label: "Film strip", labelMy: "ဖလင်တန်း" },
  { id: "newest", label: "Newest first", labelMy: "အသစ်ဆုံး" },
];

function useTick(ms: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setN((x) => x + 1), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return n;
}

export function EventWall({ ev, pics, my, onClose }: { ev: EventDoc; pics: EventPhoto[]; my: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [code, setCode] = useState<string | null>(null);
  const tick = useTick(ev.wall === "slideshow" ? 5000 : 4000);
  const n = pics.length;

  useEffect(() => {
    ref.current?.requestFullscreen?.().catch(() => undefined);
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("keydown", k);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [onClose]);

  useEffect(() => {
    let live = true;
    qr(wallUrl(ev), "#08080a", "#f2efe9").then((u) => live && setCode(u));
    return () => {
      live = false;
    };
  }, [ev]);

  const newest = [...pics].reverse();
  const at = (i: number) => pics[((i % n) + n) % n];

  let body: React.ReactNode = null;
  if (n) {
    switch (ev.wall) {
      case "slideshow": {
        const p = at(tick);
        body = (
          <div className="wall-slide" key={p.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={urlOf(p.blob)} alt="" />
          </div>
        );
        break;
      }
      case "mosaic": {
        /* the grid grows with the night, so it is never half empty */
        const [cols, rows] = n <= 2 ? [2, 1] : n <= 4 ? [2, 2] : n <= 6 ? [3, 2] : n <= 9 ? [3, 3] : [4, 3];
        const cells = Array.from({ length: Math.min(cols * rows, n) }, (_, i) => at(i + tick * cols));
        body = (
          <div className="wall-mosaic" style={{ "--cols": cols, "--rows": rows } as React.CSSProperties}>
            {cells.map((p, i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img key={`${p.id}-${i}`} src={urlOf(p.thumb)} alt="" />
            ))}
          </div>
        );
        break;
      }
      case "polaroid": {
        const cells = Array.from({ length: Math.min(5, n) }, (_, i) => at(i + tick));
        body = (
          <div className="wall-pola">
            {cells.map((p, i) => (
              <figure key={`${p.id}-${i}`} style={{ "--r": `${[-6, 4, -2, 7, -4][i]}deg` } as React.CSSProperties}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urlOf(p.thumb)} alt="" />
              </figure>
            ))}
          </div>
        );
        break;
      }
      case "strip": {
        body = (
          <div className="wall-strip">
            <div className="wall-strip__track" style={{ "--n": n } as React.CSSProperties}>
              {[...pics, ...pics].map((p, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={`${p.id}-${i}`} src={urlOf(p.thumb)} alt="" />
              ))}
            </div>
          </div>
        );
        break;
      }
      case "newest": {
        body = (
          <div className="wall-new">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="wall-new__hero" src={urlOf(newest[0].blob)} alt="" key={newest[0].id} />
            <div className="wall-new__row">
              {newest.slice(1, 7).map((p) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={p.id} src={urlOf(p.thumb)} alt="" />
              ))}
            </div>
          </div>
        );
        break;
      }
    }
  }

  return (
    <div ref={ref} className="wallv" role="dialog" aria-modal="true" aria-label={my ? "Live wall" : "Live wall"}>
      <header className="wallv__head">
        <span className="wallv__my my">{ev.nameMy || ev.name}</span>
        {ev.nameMy ? <span className="wallv__en">{ev.name}</span> : null}
      </header>
      <div className="wallv__body">{body}</div>
      <aside className="wallv__qr">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {code ? <img src={code} alt="" /> : null}
        <span className="my">ကိုယ့်ပုံတွေ ယူဖို့ scan ဖတ်ပါ</span>
      </aside>
      <button type="button" className="wallv__x" onClick={onClose} aria-label={my ? "ပိတ်" : "Close"}>
        ×
      </button>
    </div>
  );
}
