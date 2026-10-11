"use client";

import { useState } from "react";
import type { Compiled } from "@/lib/compile";
import { connected } from "@/lib/premium";
import { usePrompt } from "./usePrompt";

/* The compiled prompt, wherever it came from — the catalogue in Studio
   or a measured photograph in Reverse.

   Two systems meet here. The prompt is always free: one text, written
   for modern image models, to copy anywhere. "Refine with AI" hands it
   to a language model that writes it better without changing a
   decision. "Make image" takes it — refined or not — to the Create page
   and SHOW's own image models. Nothing is ever cut for length. */

type Props = {
  out: Compiled;
  my: boolean;
  /** Given a title, put the current state in the library. */
  onSave?: (title: string) => void;
  /** Take the prompt to Create; `refined` is the AI version when one is showing. */
  onImage?: (refined: { prompt: string; negative: string } | null) => void;
  /** What a room adds after the prompt — its premium button, usually. */
  children?: React.ReactNode;
};

export function PromptDock({ out, my, onSave, onImage, children }: Props) {
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [title, setTitle] = useState("");
  const [saved, setSaved] = useState(false);

  const { text, negative, live, useRefined, showRefined, setShowRefined, refining, refineMsg, refine, copied, copy } =
    usePrompt(out, my);

  const commit = () => {
    if (!onSave) return;
    onSave(title);
    setTitle("");
    setNaming(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  return (
    <section
      className="dock"
      data-open={open || undefined}
      aria-label={my ? "ထုတ်ထားသော prompt" : "Compiled prompt"}
    >
      <button
        type="button"
        className="dock__grab"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="dock__grabline" aria-hidden="true" />
        <span className="t-micro">PROMPT{useRefined ? " · AI" : ""}</span>
      </button>

      <div className="dock__body">
        {/* refine: the AI rewrite, and a way back to what was crafted */}
        <div className="refine">
          {live ? (
            <div className="refine__switch" role="tablist" aria-label={my ? "ဘယ် prompt" : "Which prompt"}>
              <button type="button" role="tab" aria-selected={!showRefined} onClick={() => setShowRefined(false)}>
                <span className={my ? "my" : undefined}>{my ? "မူရင်း" : "Crafted"}</span>
              </button>
              <button type="button" role="tab" aria-selected={showRefined} onClick={() => setShowRefined(true)}>
                ✦ <span className={my ? "my" : undefined}>{my ? "AI ပြင်ပြီး" : "AI refined"}</span>
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="refine__go"
            onClick={() => void refine()}
            disabled={refining || !out.positive.trim()}
            data-busy={refining || undefined}
          >
            <span aria-hidden="true" className="refine__spark">✦</span>
            {refining
              ? my
                ? "AI ပြင်နေသည်…"
                : "Refining…"
              : live
                ? my
                  ? "ထပ် refine"
                  : "Refine again"
                : "Refine with AI"}
          </button>
        </div>

        <pre className="dock__out" aria-live="polite" data-refined={useRefined || undefined} data-busy={refining || undefined}>
          <code>{text}</code>
        </pre>

        {negative ? (
          <pre className="dock__out dock__out--neg">
            <code>
              <span className={`dock__lbl ${my ? "my" : "t-micro"}`}>{my ? "ရှောင်ရန်" : "Avoid"}</span>
              {negative}
            </code>
          </pre>
        ) : null}

        {refineMsg ? <p className={`gen__msg ${my ? "my" : "t-small"}`}>{refineMsg}</p> : null}

        {useRefined && live!.notes.length ? (
          <ul className="dock__notes dock__notes--ai t-small">
            {live!.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
            <li className="dock__by">
              {live!.model === "dev"
                ? my
                  ? "Model မချိတ်ရသေး — server က ရှင်းပေးရုံပဲ"
                  : "No model connected — tidied by the server"
                : `${live!.model} · ${my ? `ဒီနေ့ ${live!.left} ကြိမ် ကျန်` : `${live!.left} left today`}`}
            </li>
          </ul>
        ) : out.notes.length ? (
          <ul className="dock__notes t-small">
            {out.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}

        <div className="dock__acts">
          <div className="dock__row">
            <button type="button" className="btn" onClick={copy}>
              {copied
                ? my
                  ? "ကူးပြီး"
                  : "Copied"
                : my
                  ? "Prompt ကူးမည်"
                  : "Copy prompt"}
            </button>
            {onImage ? (
              <button
                type="button"
                className="btn btn--image"
                onClick={() => onImage(useRefined ? { prompt: live!.prompt, negative: live!.negative } : null)}
                disabled={!out.positive.trim()}
              >
                <span aria-hidden="true">✦</span>
                <span className={my ? "my" : undefined}>{my ? "Image ထုတ်မည်" : "Make image"}</span>
              </button>
            ) : null}
          </div>

          {onSave ? (
            naming ? (
              <form
                className="dock__name"
                onSubmit={(e) => {
                  e.preventDefault();
                  commit();
                }}
              >
                <input
                  className={`field ${my ? "my" : ""}`}
                  autoFocus
                  value={title}
                  placeholder={my ? "နာမည် ပေးပါ" : "Name it"}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setNaming(false);
                  }}
                />
                <button type="submit" className="btn btn--quiet">
                  {my ? "သိမ်းမည်" : "Save"}
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="btn btn--quiet"
                onClick={() => setNaming(true)}
              >
                {saved
                  ? my
                    ? "သိမ်းပြီး"
                    : "Saved"
                  : my
                    ? "စာကြည့်တိုက်ထဲ သိမ်းမည်"
                    : "Save to library"}
              </button>
            )
          ) : null}
          {!connected() && onImage ? (
            <p className={`dock__offline ${my ? "my" : "t-small"}`}>
              {my ? "ပုံထုတ်တာနဲ့ AI refine က server ချိတ်မှ ရမယ်" : "Making images and AI refine arrive with the server"}
            </p>
          ) : null}
        </div>

        {children}
      </div>
    </section>
  );
}
