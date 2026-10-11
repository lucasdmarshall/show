"use client";

import { useRef, useState } from "react";
import { MODES, type Mode, type ModeId } from "@/lib/catalogue";
import type { Compiled, Selection } from "@/lib/compile";
import { usePrompt } from "./usePrompt";
import { I, ICON, PromptFrame } from "./PromptBox";
import "./studio-phone.css";

/* ------------------------------------------------------------------
   Studio on a phone.

   The prompt comes first, in a gold frame, and rewrites itself as the
   choices below change. The choices are an index — one numbered line
   per group with what is chosen in it — and a line opens in place to
   choose. The one action, Make image, waits above the tabs.
   ------------------------------------------------------------------ */

const two = (n: number) => String(n).padStart(2, "0");

type Props = {
  my: boolean;
  mode: ModeId;
  active: Mode;
  onMode: (id: ModeId) => void;
  selection: Selection;
  onToggle: (group: string, option: string, multi: boolean) => void;
  aspects: string[];
  aspect: string;
  onAspect: (a: string) => void;
  extra: string;
  onExtra: (v: string) => void;
  out: Compiled;
  onImage?: (refined: { prompt: string; negative: string } | null) => void;
  onSave?: (title: string) => void;
};

export function StudioPhone({
  my,
  mode,
  active,
  onMode,
  selection,
  onToggle,
  aspects,
  aspect,
  onAspect,
  extra,
  onExtra,
  out,
  onImage,
  onSave,
}: Props) {
  const p = usePrompt(out, my);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [naming, setNaming] = useState(false);
  const [title, setTitle] = useState("");
  const [saved, setSaved] = useState(false);
  const touch = useRef<number | null>(null);

  const at = MODES.findIndex((m) => m.id === mode);
  const step = (d: number) => {
    onMode(MODES[(at + d + MODES.length) % MODES.length].id);
    setOpenGroup(null);
  };

  const chosen = active.groups.reduce((n, g) => n + (selection[g.id]?.length ?? 0), 0);
  const q = query.trim().toLowerCase();
  const label = (o: { label: string; labelMy: string }) => (my ? o.labelMy : o.label);

  const save = () => {
    onSave?.(title);
    setTitle("");
    setNaming(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  return (
    <div className="sphone">
      {/* -- what are we making: one big word, swiped or stepped ---------- */}
      <header
        className="sphone__head"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          const x0 = touch.current;
          touch.current = null;
          if (x0 === null) return;
          const dx = e.changedTouches[0].clientX - x0;
          if (Math.abs(dx) > 48) step(dx < 0 ? 1 : -1);
        }}
      >
        <div className="sphone__title">
          <p className={`sphone__count ${my ? "my" : "t-micro"}`}>
            {two(at + 1)} / {two(MODES.length)} · {my ? "စတူဒီယို" : "Studio"}
          </p>
          <h1 key={mode} className={`sphone__mode ${my ? "my" : ""}`}>
            {label(active)}
          </h1>
          <p className={`sphone__hint ${my ? "my" : ""}`}>{my ? active.hintMy : active.hint}</p>
        </div>
        <div className="sphone__arrows">
          <button type="button" className="ring" onClick={() => step(-1)} aria-label={my ? "အရင်" : "Previous"}>
            <I d={ICON.left} />
          </button>
          <button type="button" className="ring ring--gold" onClick={() => step(1)} aria-label={my ? "နောက်" : "Next"}>
            <I d={ICON.right} />
          </button>
        </div>
      </header>

      {/* -- the prompt, first ----------------------------------------------- */}
      <PromptFrame p={p} my={my} count={chosen} />

      {/* -- finding one of two hundred ------------------------------------- */}
      <label className="sphone__find">
        <I d={ICON.search} />
        <input
          className={my ? "my" : undefined}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={my ? "ရွေးစရာ ရှာပါ…" : "Search choices…"}
          aria-label={my ? "ရှာရန်" : "Search choices"}
        />
        {query ? (
          <button type="button" onClick={() => setQuery("")} aria-label={my ? "ရှင်း" : "Clear"}>
            ×
          </button>
        ) : null}
      </label>

      {/* -- the index -------------------------------------------------------- */}
      <ol className="index">
        {active.groups.map((g, i) => {
          const picked = selection[g.id] ?? [];
          const options = q
            ? g.options.filter((o) => `${o.label} ${o.labelMy} ${o.descriptor}`.toLowerCase().includes(q))
            : g.options;
          if (q && !options.length) return null;
          const open = !!q || openGroup === g.id;
          const value = g.options.filter((o) => picked.includes(o.id)).map(label);
          return (
            <li key={g.id} className="ix" data-open={open || undefined}>
              <button
                type="button"
                className="ix__head"
                aria-expanded={open}
                onClick={() => setOpenGroup(open ? null : g.id)}
              >
                <span className="ix__n">{two(i + 1)}</span>
                <span className={`ix__name ${my ? "my" : ""}`}>{label(g)}</span>
                <span className={`ix__value ${my ? "my" : ""}`} data-empty={!value.length || undefined}>
                  {value.length ? (value.length > 2 ? `${value.length} ${my ? "ခု" : "chosen"}` : value.join(", ")) : my ? "မရွေး" : "Any"}
                </span>
                <span className="ix__chev">
                  <I d={ICON.chev} />
                </span>
              </button>
              {open ? (
                <div className="ix__opts" role="group" aria-label={label(g)}>
                  {options.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className="opt"
                      aria-pressed={picked.includes(o.id)}
                      onClick={() => onToggle(g.id, o.id, !!g.multi)}
                    >
                      <span className={my ? "my" : undefined}>{label(o)}</span>
                      {o.mm ? <span className="opt__mm">MM</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}

        {q ? null : (
          <>
            <li className="ix" data-open={openGroup === "_aspect" || undefined}>
              <button
                type="button"
                className="ix__head"
                aria-expanded={openGroup === "_aspect"}
                onClick={() => setOpenGroup(openGroup === "_aspect" ? null : "_aspect")}
              >
                <span className="ix__n">{two(active.groups.length + 1)}</span>
                <span className={`ix__name ${my ? "my" : ""}`}>{my ? "အချိုးအစား" : "Aspect"}</span>
                <span className="ix__value">{aspect}</span>
                <span className="ix__chev">
                  <I d={ICON.chev} />
                </span>
              </button>
              {openGroup === "_aspect" ? (
                <div className="ix__opts" role="group">
                  {aspects.map((a) => (
                    <button key={a} type="button" className="opt opt--num" aria-pressed={aspect === a} onClick={() => onAspect(a)}>
                      {a}
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
            <li className="ix" data-open={openGroup === "_extra" || undefined}>
              <button
                type="button"
                className="ix__head"
                aria-expanded={openGroup === "_extra"}
                onClick={() => setOpenGroup(openGroup === "_extra" ? null : "_extra")}
              >
                <span className="ix__n">{two(active.groups.length + 2)}</span>
                <span className={`ix__name ${my ? "my" : ""}`}>{my ? "ထပ်ဖြည့်ရန်" : "Anything else"}</span>
                <span className="ix__value" data-empty={!extra.trim() || undefined}>
                  {extra.trim() ? (my ? "ရေးထား" : "Written") : "—"}
                </span>
                <span className="ix__chev">
                  <I d={ICON.chev} />
                </span>
              </button>
              {openGroup === "_extra" ? (
                <div className="ix__opts">
                  <textarea
                    className={`field ${my ? "my" : ""}`}
                    rows={3}
                    value={extra}
                    autoFocus
                    placeholder={my ? "ဥပမာ — ဘယ်ဘက်မှာ ခွေးတစ်ကောင် ထိုင်နေတယ်" : "e.g. a dog asleep at the left edge"}
                    onChange={(e) => onExtra(e.target.value)}
                  />
                </div>
              ) : null}
            </li>
          </>
        )}
      </ol>

      {/* -- the one action, above the tabs ------------------------------------ */}
      <div className="sphone__make">
        {naming ? (
          <form
            className="sphone__name"
            onSubmit={(e) => {
              e.preventDefault();
              save();
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
            <button type="submit" className="sphone__go sphone__go--small">
              <span className={my ? "my" : undefined}>{my ? "သိမ်း" : "Save"}</span>
            </button>
          </form>
        ) : (
          <>
            <button
              type="button"
              className="sphone__go"
              disabled={!out.positive.trim() || !onImage}
              onClick={() => onImage?.(p.forImage)}
            >
              <I d={ICON.spark} />
              <span className={my ? "my" : undefined}>{my ? "Image ထုတ်မည်" : "Make image"}</span>
            </button>
            {onSave ? (
              <button
                type="button"
                className="ring ring--big"
                data-done={saved || undefined}
                onClick={() => setNaming(true)}
                aria-label={my ? "စာကြည့်တိုက်ထဲ သိမ်းမည်" : "Save to library"}
              >
                <I d={saved ? ICON.check : ICON.mark} />
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
