"use client";

import { useMemo, useState } from "react";
import { getMode, MODES, type ModeId } from "@/lib/catalogue";
import { compile, type Selection } from "@/lib/compile";
import { PromptDock } from "./PromptDock";
import type { Images } from "@/lib/references";
import { NO_PHOTOS, PhotoRefs, type Photos } from "./PhotoRefs";
import type { Snapshot } from "@/lib/library";
import "./studio.css";
import { StudioPhone } from "./StudioPhone";

const ASPECTS = [
  "1:1",
  "4:5",
  "3:4",
  "2:3",
  "9:16",
  "3:2",
  "4:3",
  "16:9",
  "21:9",
];

/* A group shows this many options until it is opened. */
const SHOWN = 10;

/* What each discipline usually wants to be shaped like. */
const DEFAULT_ASPECT: Record<ModeId, string> = {
  portrait: "4:5",
  ceremony: "3:2",
  product: "1:1",
  food: "4:5",
  creature: "3:2",
  place: "3:2",
  imagine: "2:3",
};

const initialSelections = () =>
  Object.fromEntries(MODES.map((m) => [m.id, { ...m.preset }])) as Record<
    ModeId,
    Selection
  >;

const initialExtras = () =>
  Object.fromEntries(MODES.map((m) => [m.id, ""])) as Record<ModeId, string>;

/** What Studio hands to Create. */
export type CreateSeed = {
  prompt: string;
  negative: string;
  aspect: string;
  from: string;
  /** the photograph to edit — image 1 in the prompt */
  image?: Blob | null;
  /** references, in the order the prompt numbers them */
  refs?: Blob[];
};

export type StudioSeed = {
  mode?: ModeId;
  selection?: Selection;
  aspect?: string;
  extra?: string;
};

export function Studio({
  my,
  seed,
  onSave,
  onImage,
}: {
  my: boolean;
  seed?: StudioSeed;
  onSave?: (title: string, snap: Snapshot) => void;
  onImage?: (seed: CreateSeed) => void;
}) {
  const seedMode = seed?.mode ?? "portrait";
  const [mode, setMode] = useState<ModeId>(seedMode);
  const [selections, setSelections] = useState<Record<ModeId, Selection>>(
    () => {
      const base = initialSelections();
      if (seed?.selection) base[seedMode] = seed.selection;
      return base;
    },
  );
  const [extras, setExtras] = useState<Record<ModeId, string>>(() => {
    const base = initialExtras();
    if (seed?.extra) base[seedMode] = seed.extra;
    return base;
  });
  const [aspects, setAspects] = useState<Record<ModeId, string>>(() => {
    const base = { ...DEFAULT_ASPECT };
    if (seed?.aspect) base[seedMode] = seed.aspect;
    return base;
  });
  const [query, setQuery] = useState("");
  const [opened, setOpened] = useState<Set<string>>(new Set());
  /* the photographs travel across modes: the same bride, a different set */
  const [photos, setPhotos] = useState<Photos>(NO_PHOTOS);

  const active = getMode(mode);
  const total = active.groups.reduce((n, g) => n + g.options.length, 0);
  const selection = selections[mode];
  const extra = extras[mode];
  const aspect = aspects[mode];

  const images: Images | undefined = useMemo(
    () =>
      photos.base || photos.refs.length
        ? {
            base: !!photos.base,
            keep: photos.keep,
            refs: photos.refs.map((r) => ({ role: r.role, note: r.note })),
          }
        : undefined,
    [photos],
  );

  const out = useMemo(
    () => compile(selection, mode, aspect, extra, images),
    [selection, mode, aspect, extra, images],
  );

  const toggle = (groupId: string, optionId: string, multi: boolean) => {
    setSelections((prev) => {
      const forMode = prev[mode];
      const current = forMode[groupId] ?? [];
      const next = !multi
        ? current[0] === optionId
          ? []
          : [optionId]
        : current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId];
      return { ...prev, [mode]: { ...forMode, [groupId]: next } };
    });
  };

  /* Create gets the photographs only from the desktop studio — the phone
     studio is prompt-first and has none to give */
  const make = onImage
    ? (refined: { prompt: string; negative: string } | null) =>
        onImage({
          prompt: refined ? refined.prompt : out.positive,
          negative: refined ? refined.negative : out.negative,
          aspect,
          from: my ? active.labelMy : active.label,
          image: photos.base?.blob ?? null,
          refs: photos.refs.map((r) => r.blob),
        })
    : undefined;
  const save = onSave
    ? (title: string) =>
        onSave(title, {
          source: "studio",
          mode,
          selection,
          extra,
          aspect,
          positive: out.positive,
          negative: out.negative,
          tokens: out.tokens,
        })
    : undefined;

  return (
    <>
    <StudioPhone
      my={my}
      mode={mode}
      active={active}
      onMode={setMode}
      selection={selection}
      onToggle={toggle}
      aspects={ASPECTS}
      aspect={aspect}
      onAspect={(a) => setAspects((p) => ({ ...p, [mode]: a }))}
      extra={extra}
      onExtra={(v) => setExtras((p) => ({ ...p, [mode]: v }))}
      out={out}
      onImage={make}
      onSave={save}
    />
    <div className="studio">
      {/* ---------------- decisions ---------------- */}
      <section
        className="studio__decide"
        aria-label={my ? "ဆုံးဖြတ်ချက်များ" : "Decisions"}
      >
        {/* what are we making */}
        <div
          className="modes"
          role="tablist"
          aria-label={my ? "အမျိုးအစား" : "What you are making"}
        >
          {MODES.map((m) => (
            <button
              key={m.id}
              role="tab"
              type="button"
              className={`mode ${my ? "my" : ""}`}
              aria-selected={mode === m.id}
              onClick={() => setMode(m.id)}
            >
              {my ? m.labelMy : m.label}
            </button>
          ))}
        </div>
        <p className={`modes__hint ${my ? "my" : "t-small"}`}>
          {my ? active.hintMy : active.hint}
        </p>

        {/* photographers edit far more than they invent: the photographs first */}
        <PhotoRefs value={photos} onChange={setPhotos} my={my} />

        {/* with this many choices, finding one has to be instant */}
        <div className="finder">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-4-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            className={`finder__input ${my ? "my" : ""}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              my ? `ရွေးစရာ ${total} ခုထဲက ရှာပါ…` : `Search ${total} choices…`
            }
            aria-label={my ? "ရှာရန်" : "Search choices"}
          />
          {query ? (
            <button
              type="button"
              className="finder__clear"
              onClick={() => setQuery("")}
              aria-label={my ? "ရှင်း" : "Clear"}
            >
              ×
            </button>
          ) : null}
        </div>

        {active.groups.map((group) => {
          const picked = selection[group.id] ?? [];
          const q = query.trim().toLowerCase();
          const matches = q
            ? group.options.filter((opt) =>
                `${opt.label} ${opt.labelMy} ${opt.descriptor}`
                  .toLowerCase()
                  .includes(q),
              )
            : group.options;
          if (q && !matches.length) return null;
          const isOpen = !!q || opened.has(group.id);
          /* closed: the first few, plus anything already chosen further down */
          const visible = isOpen
            ? matches
            : matches.filter((opt, i) => i < SHOWN || picked.includes(opt.id));
          const hidden = matches.length - visible.length;
          return (
            <section className="grp" key={group.id}>
              <header className="grp__head">
                <h2 className={my ? "my grp__title" : "t-micro grp__title"}>
                  {my ? group.labelMy : group.label}
                </h2>
                <span className="grp__count t-micro" aria-hidden="true">
                  {group.multi ? `${picked.length}` : picked.length ? "1" : "—"}
                </span>
              </header>

              <div className="grp__opts" role="group">
                {visible.map((opt) => {
                  const on = picked.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className="chip"
                      aria-pressed={on}
                      onClick={() => toggle(group.id, opt.id, !!group.multi)}
                      title={opt.descriptor}
                    >
                      <span className={my ? "my" : undefined}>
                        {my ? opt.labelMy : opt.label}
                      </span>
                      {opt.mm ? (
                        <span
                          className="chip__mm"
                          title={
                            my
                              ? "မြန်မာ concept — model နားလည်အောင် ဘာသာပြန်ပေးထားသည်"
                              : "Burmese concept — translated so a model can read it"
                          }
                        >
                          MM
                        </span>
                      ) : null}
                    </button>
                  );
                })}
                {hidden > 0 ? (
                  <button
                    type="button"
                    className="chip chip--more"
                    onClick={() => setOpened((st) => new Set(st).add(group.id))}
                  >
                    <span className={my ? "my" : undefined}>
                      {my ? `+ နောက်ထပ် ${hidden} ခု` : `+ ${hidden} more`}
                    </span>
                  </button>
                ) : isOpen && !q && group.options.length > SHOWN ? (
                  <button
                    type="button"
                    className="chip chip--more"
                    onClick={() =>
                      setOpened((st) => {
                        const n = new Set(st);
                        n.delete(group.id);
                        return n;
                      })
                    }
                  >
                    <span className={my ? "my" : undefined}>
                      {my ? "ချုံ့မည်" : "Show fewer"}
                    </span>
                  </button>
                ) : null}
              </div>
            </section>
          );
        })}

        {query.trim() ? null : (
          <>
            <section className="grp">
              <header className="grp__head">
                <h2 className={my ? "my grp__title" : "t-micro grp__title"}>
                  {my ? "အချိုးအစား" : "Aspect"}
                </h2>
              </header>
              <div className="grp__opts" role="group">
                {ASPECTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    className="chip chip--num"
                    aria-pressed={aspect === a}
                    onClick={() => setAspects((p) => ({ ...p, [mode]: a }))}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </section>

            {/* the catalogue will never cover everything */}
            <section className="grp">
              <header className="grp__head">
                <h2 className={my ? "my grp__title" : "t-micro grp__title"}>
                  {my ? "ကိုယ်တိုင် ထပ်ဖြည့်ရန်" : "Anything else"}
                </h2>
              </header>
              <textarea
                className={`field ${my ? "my" : ""}`}
                rows={2}
                value={extra}
                placeholder={
                  my
                    ? "ဥပမာ — ဘယ်ဘက်မှာ ခွေးတစ်ကောင် ထိုင်နေတယ်"
                    : "e.g. a dog asleep at the left edge"
                }
                onChange={(e) =>
                  setExtras((p) => ({ ...p, [mode]: e.target.value }))
                }
              />
            </section>
          </>
        )}
      </section>

      <PromptDock out={out} my={my} onImage={make} onSave={save} />
    </div>
    </>
  );
}
