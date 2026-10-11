"use client";

import { useState } from "react";
import type { Compiled } from "@/lib/compile";
import { usePrompt } from "./usePrompt";
import "./prompt-box.css";

/* ------------------------------------------------------------------
   The prompt on a phone: a gold frame at the top of the room that
   rewrites itself as the choices below change, with refine, copy and
   show-all as small round buttons. Make waits in MakeBar, above the tabs.
   ------------------------------------------------------------------ */

export const ICON = {
  left: "M15 6l-6 6 6 6",
  right: "M9 6l6 6-6 6",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  copy: "M9 9h10v10H9zM5 15V5h10",
  check: "M5 12l5 5 9-10",
  grow: "M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7",
  shrink: "M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7",
  mark: "M7 4h10v16l-5-4-5 4z",
  chev: "M6 9l6 6 6-6",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-4-4",
};

export function I({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type P = ReturnType<typeof usePrompt>;

/** The frame itself, driven by a usePrompt the caller owns. */
export function PromptFrame({ p, my, count }: { p: P; my: boolean; count?: number }) {
  const [grown, setGrown] = useState(false);
  return (
    <section className="pbox" data-grown={grown || undefined} aria-label="Prompt">
      <header className="pbox__head">
        <span className="pbox__label t-micro">
          Prompt{count !== undefined ? ` · ${count}` : ""}
          {p.useRefined ? " · AI" : ""}
        </span>
        <span className="pbox__tools">
          <button
            type="button"
            className="ring ring--gold"
            onClick={() => void p.refine()}
            disabled={p.refining}
            data-busy={p.refining || undefined}
            aria-label={my ? "AI နဲ့ ပြင်မည်" : "Refine with AI"}
            title={my ? "AI နဲ့ ပြင်မည်" : "Refine with AI"}
          >
            <I d={ICON.spark} />
          </button>
          <button type="button" className="ring" onClick={() => void p.copy()} aria-label={my ? "ကူးမည်" : "Copy prompt"}>
            <I d={p.copied ? ICON.check : ICON.copy} />
          </button>
          <button
            type="button"
            className="ring"
            onClick={() => setGrown((v) => !v)}
            aria-expanded={grown}
            aria-label={grown ? (my ? "ချုံ့မည်" : "Collapse") : my ? "အပြည့်ကြည့်မည်" : "Show all"}
          >
            <I d={grown ? ICON.shrink : ICON.grow} />
          </button>
        </span>
      </header>

      {p.live ? (
        <div className="pbox__switch" role="tablist" aria-label={my ? "ဘယ် prompt" : "Which prompt"}>
          <button type="button" role="tab" aria-selected={!p.showRefined} onClick={() => p.setShowRefined(false)}>
            <span className={my ? "my" : undefined}>{my ? "မူရင်း" : "Crafted"}</span>
          </button>
          <button type="button" role="tab" aria-selected={p.showRefined} onClick={() => p.setShowRefined(true)}>
            <span className={my ? "my" : undefined}>{my ? "AI ပြင်ပြီး" : "AI refined"}</span>
          </button>
        </div>
      ) : null}

      <p className="pbox__text" data-busy={p.refining || undefined} aria-live="polite">
        {p.text}
      </p>

      {grown && p.negative ? (
        <p className="pbox__avoid">
          <span className={my ? "my" : "t-micro"}>{my ? "ရှောင်ရန်" : "Avoid"}</span> {p.negative}
        </p>
      ) : null}
      {grown && p.useRefined && p.live!.notes.length ? (
        <ul className="pbox__notes t-small">
          {p.live!.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
      {p.refineMsg ? <p className={`pbox__msg ${my ? "my" : "t-small"}`}>{p.refineMsg}</p> : null}
    </section>
  );
}

/** The frame for a room: it owns its own prompt state. */
export function PromptBox({ out, my, count }: { out: Compiled; my: boolean; count?: number }) {
  const p = usePrompt(out, my);
  return <PromptFrame p={p} my={my} count={count} />;
}

/** The room's Make button (and whatever goes with it), held above the tabs. */
export function MakeBar({ children }: { children: React.ReactNode }) {
  return <div className="make-bar">{children}</div>;
}

/** MakeBar on a phone; on a wider screen its children sit where they are. */
export function MaybeBar({ phone, children }: { phone: boolean; children: React.ReactNode }) {
  return phone ? <MakeBar>{children}</MakeBar> : <>{children}</>;
}
