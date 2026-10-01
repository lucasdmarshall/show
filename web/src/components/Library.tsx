"use client";

import { Fragment, useMemo, useState } from "react";
import {
  countChange,
  depthOf,
  diffWords,
  removeEntry,
  removeVersion,
  rename,
  setHead,
  useLibrary,
  type Snapshot,
  type Version,
} from "@/lib/library";
import "./library.css";

const when = (t: number) => {
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

type Props = {
  my: boolean;
  onOpen: (snap: Snapshot, entryId: string, versionId: string) => void;
};

export function Library({ my, onOpen }: Props) {
  const entries = useLibrary();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pair, setPair] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const entry = entries.find((e) => e.id === openId) ?? null;

  const diff = useMemo(() => {
    if (!entry || pair.length !== 2) return null;
    const a = entry.versions.find((v) => v.id === pair[0]);
    const b = entry.versions.find((v) => v.id === pair[1]);
    if (!a || !b) return null;
    const parts = diffWords(a.snap.positive, b.snap.positive);
    return { a, b, parts, ...countChange(parts) };
  }, [entry, pair]);

  const pick = (id: string) =>
    setPair((prev) =>
      prev.includes(id)
        ? prev.filter((v) => v !== id)
        : prev.length < 2
          ? [...prev, id]
          : [prev[1], id],
    );

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard blocked — the text is on screen */
    }
  };

  if (entries.length === 0) {
    return (
      <div className="soon">
        <p className="t-micro">{my ? "စာကြည့်တိုက်" : "Library"}</p>
        <p className={my ? "my" : "t-small"}>
          {my
            ? "ဘာမှ မသိမ်းရသေးပါ။ Studio သို့ Reverse မှာ prompt တစ်ခု ထုတ်ပြီး “စာကြည့်တိုက်ထဲ သိမ်းမည်” ကို နှိပ်ပါ။"
            : "Nothing saved yet. Compile a prompt in Studio or Reverse, then choose Save to library."}
        </p>
        <p className="soon__state t-micro">
          {my ? "ဒီစက်ထဲမှာသာ သိမ်းသည်" : "Stored on this device only"}
        </p>
      </div>
    );
  }

  return (
    <div className="lib">
      {/* ---------------- entries ---------------- */}
      <section className="lib__list" aria-label={my ? "သိမ်းထားသည်" : "Saved prompts"}>
        <header className="lib__head">
          <h2 className={my ? "my" : "t-micro"}>
            {my ? `သိမ်းထားသည် ${entries.length}` : `${entries.length} saved`}
          </h2>
        </header>

        <ul className="cards">
          {entries.map((e) => {
            const head = e.versions.find((v) => v.id === e.head) ?? e.versions[0];
            return (
              <li key={e.id}>
                <button
                  type="button"
                  className="card"
                  aria-current={openId === e.id ? "true" : undefined}
                  onClick={() => {
                    setOpenId(e.id);
                    setPair([]);
                    setEditing(false);
                  }}
                >
                  <span className="card__top">
                    <span className={`card__title ${my ? "my" : ""}`}>{e.title}</span>
                    <span className="card__src t-micro">{head.snap.source}</span>
                  </span>
                  <span className="card__line">{head.snap.positive.slice(0, 90)}…</span>
                  <span className="card__meta t-micro">
                    {e.versions.length} {e.versions.length === 1 ? "version" : "versions"} ·{" "}
                    {head.snap.tokens} tokens · {when(e.at)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---------------- one entry ---------------- */}
      <section className="lib__detail" aria-label={my ? "အသေးစိတ်" : "Detail"}>
        {!entry ? (
          <p className={`lib__hint ${my ? "my" : "t-small"}`}>
            {my ? "တစ်ခုကို ရွေးပါ။" : "Choose one."}
          </p>
        ) : (
          <>
            <header className="lib__head lib__head--detail">
              {editing ? (
                <form
                  className="lib__rename"
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    rename(entry.id, draft);
                    setEditing(false);
                  }}
                >
                  <input
                    className={`field ${my ? "my" : ""}`}
                    autoFocus
                    value={draft}
                    onChange={(ev) => setDraft(ev.target.value)}
                    onKeyDown={(ev) => ev.key === "Escape" && setEditing(false)}
                  />
                  <button type="submit" className="lib__act">
                    {my ? "သိမ်း" : "Save"}
                  </button>
                </form>
              ) : (
                <>
                  <h2 className={`lib__title ${my ? "my" : "t-h3"}`}>{entry.title}</h2>
                  <button
                    type="button"
                    className="lib__act"
                    onClick={() => {
                      setDraft(entry.title);
                      setEditing(true);
                    }}
                  >
                    {my ? "အမည်ပြောင်း" : "Rename"}
                  </button>
                  <button
                    type="button"
                    className="lib__act lib__act--warn"
                    onClick={() => {
                      removeEntry(entry.id);
                      setOpenId(null);
                    }}
                  >
                    {my ? "ဖျက်" : "Delete"}
                  </button>
                </>
              )}
            </header>

            <p className={`lib__note ${my ? "my" : "t-small"}`}>
              {my
                ? "နှစ်ခု ရွေးလိုက်ရင် ဘာပြောင်းသွားလဲ စာလုံးလိုက် ပြပါမယ်။"
                : "Select two and the change is shown word by word."}
            </p>

            <ol className="vers">
              {entry.versions.map((v) => (
                <VersionRow
                  key={v.id}
                  v={v}
                  depth={depthOf(entry.versions, v.id)}
                  isHead={entry.head === v.id}
                  picked={pair.indexOf(v.id)}
                  my={my}
                  canDelete={entry.versions.length > 1}
                  onPick={() => pick(v.id)}
                  onUse={() => {
                    setHead(entry.id, v.id);
                    onOpen(v.snap, entry.id, v.id);
                  }}
                  onCopy={() => void copy(v.snap.positive)}
                  onDelete={() => {
                    removeVersion(entry.id, v.id);
                    setPair((p) => p.filter((x) => x !== v.id));
                  }}
                />
              ))}
            </ol>

            {diff ? (
              <section className="diff" aria-live="polite">
                <header className="diff__head">
                  <span className="t-micro">
                    {diff.a.label} → {diff.b.label}
                  </span>
                  <span className="diff__count t-micro">
                    <em className="d-add">+{diff.add}</em>
                    <em className="d-del">−{diff.del}</em>
                  </span>
                </header>
                <p className="diff__body">
                  {diff.parts.map((p, i) => (
                    <Fragment key={i}>
                      {i > 0 ? " " : ""}
                      {p.kind === "same" ? (
                        p.text
                      ) : (
                        <span className={`d-${p.kind}`}>{p.text}</span>
                      )}
                    </Fragment>
                  ))}
                </p>
              </section>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function VersionRow({
  v,
  depth,
  isHead,
  picked,
  my,
  canDelete,
  onPick,
  onUse,
  onCopy,
  onDelete,
}: {
  v: Version;
  depth: number;
  isHead: boolean;
  picked: number;
  my: boolean;
  canDelete: boolean;
  onPick: () => void;
  onUse: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="ver" style={{ marginInlineStart: `${Math.min(depth, 5) * 18}px` }}>
      <button
        type="button"
        className="ver__pick"
        aria-pressed={picked >= 0}
        onClick={onPick}
        aria-label={my ? "နှိုင်းယှဉ်ရန် ရွေး" : "Select to compare"}
      >
        {picked >= 0 ? picked + 1 : ""}
      </button>

      <span className="ver__body">
        <span className="ver__top">
          <span className={`ver__label ${my ? "my" : ""}`}>{v.label}</span>
          {isHead ? <span className="ver__head t-micro">{my ? "လက်ရှိ" : "Current"}</span> : null}
          <span className="ver__meta t-micro">
            {v.snap.aspect} · {v.snap.tokens}t · {when(v.at)}
          </span>
        </span>
        <span className="ver__text">{v.snap.positive.slice(0, 120)}…</span>
      </span>

      <span className="ver__acts">
        <button type="button" className="lib__act" onClick={onUse}>
          {my ? "ဖွင့်" : "Open"}
        </button>
        <button type="button" className="lib__act" onClick={onCopy}>
          {my ? "ကူး" : "Copy"}
        </button>
        {canDelete ? (
          <button type="button" className="lib__act lib__act--warn" onClick={onDelete}>
            {my ? "ဖျက်" : "Delete"}
          </button>
        ) : null}
      </span>
    </li>
  );
}
