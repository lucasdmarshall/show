"use client";

import { useRef, useState } from "react";
import { KEEPS, ROLES, type RefRole } from "@/lib/references";
import { uid } from "@/lib/image";
import "./photorefs.css";

/* ------------------------------------------------------------------
   The photographs a prompt is about.

   Image 1 is the photograph to edit, with what must survive the edit.
   Every reference after it has a number, a job (face, outfit, light…)
   and, if needed, a note — and all of it is written into the prompt,
   because a model only uses a reference it is told about.
   ------------------------------------------------------------------ */

export type Pic = { id: string; blob: Blob; url: string };
export type RefPic = Pic & { role: RefRole; note: string };
export type Photos = { base: Pic | null; keep: string[]; refs: RefPic[] };

export const NO_PHOTOS: Photos = { base: null, keep: ["face"], refs: [] };
const MAX_REFS = 6;

function Drop({
  label,
  labelMy,
  my,
  multiple,
  onFiles,
  big,
}: {
  label: string;
  labelMy: string;
  my: boolean;
  multiple?: boolean;
  onFiles: (f: File[]) => void;
  big?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <button
      type="button"
      className={`pr-drop ${big ? "pr-drop--big" : ""}`}
      data-over={over || undefined}
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles([...e.dataTransfer.files].filter((f) => f.type.startsWith("image/")));
      }}
    >
      <span aria-hidden="true" className="pr-drop__plus">
        +
      </span>
      <span className={my ? "my" : "t-micro"}>{my ? labelMy : label}</span>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple={multiple}
        hidden
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </button>
  );
}

export function PhotoRefs({
  value,
  onChange: update,
  my,
}: {
  value: Photos;
  /* functional, so two photographs added in quick succession both land */
  onChange: (f: (p: Photos) => Photos) => void;
  my: boolean;
}) {
  const { base, keep, refs } = value;
  const onChange = (next: Partial<Photos>) => update((p) => ({ ...p, ...next }));
  const pic = (f: File): Pic => ({ id: uid(), blob: f, url: URL.createObjectURL(f) });
  const first = base ? 2 : 1;

  const setBase = (f: File[]) => {
    if (!f[0]) return;
    if (base) URL.revokeObjectURL(base.url);
    onChange({ base: pic(f[0]) });
  };
  const addRefs = (f: File[]) => {
    const added = f.map((x) => ({ ...pic(x), role: (base ? "outfit" : "face") as RefRole, note: "" }));
    update((p) => ({ ...p, refs: [...p.refs, ...added].slice(0, MAX_REFS) }));
  };
  const patchRef = (id: string, change: Partial<RefPic>) =>
    update((p) => ({ ...p, refs: p.refs.map((r) => (r.id === id ? { ...r, ...change } : r)) }));

  return (
    <section className="grp prefs">
      <header className="grp__head">
        <h2 className={my ? "my grp__title" : "t-micro grp__title"}>{my ? "ဓာတ်ပုံများ" : "Photographs"}</h2>
        <span className="grp__count t-micro">{(base ? 1 : 0) + refs.length || "—"}</span>
      </header>
      <p className={`prefs__why ${my ? "my" : "t-small"}`}>
        {my
          ? "ပုံတိုင်းကို prompt ထဲမှာ နံပါတ်တပ်ပြီး ဘာယူရမလဲ တိတိကျကျ ရေးပေးမယ် — model က reference ကို ပြောမှပဲ သုံးတာမို့လို့။"
          : "Each photograph gets a number in the prompt and is told exactly what to give — a model only uses a reference it is told about."}
      </p>

      <div className="prefs__row">
        {/* image 1 — the photograph to edit */}
        <div className="prefs__base">
          {base ? (
            <div className="pr-card pr-card--base">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={base.url} alt="" />
              <span className="pr-num t-micro">{my ? "ပုံ ၁ · ပြင်မယ့်ပုံ" : "Image 1 · to edit"}</span>
              <button
                type="button"
                className="pr-x"
                aria-label={my ? "ဖယ်" : "Remove"}
                onClick={() => {
                  URL.revokeObjectURL(base.url);
                  onChange({ base: null });
                }}
              >
                ×
              </button>
            </div>
          ) : (
            <Drop big label="Photo to edit" labelMy="ပြင်မယ့်ပုံ" my={my} onFiles={setBase} />
          )}
        </div>

        {/* references */}
        <div className="prefs__refs">
          {refs.map((r, i) => (
            <div key={r.id} className="pr-ref">
              <div className="pr-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.url} alt="" />
                <span className="pr-num t-micro">{my ? `ပုံ ${first + i}` : `Image ${first + i}`}</span>
                <button
                  type="button"
                  className="pr-x"
                  aria-label={my ? "ဖယ်" : "Remove"}
                  onClick={() => {
                    URL.revokeObjectURL(r.url);
                    update((p) => ({ ...p, refs: p.refs.filter((x) => x.id !== r.id) }));
                  }}
                >
                  ×
                </button>
              </div>
              <select
                className={`pr-role ${my ? "my" : ""}`}
                value={r.role}
                onChange={(e) => patchRef(r.id, { role: e.target.value as RefRole })}
                aria-label={my ? "ဒီပုံကနေ ဘာယူမလဲ" : "What to take from this image"}
              >
                {ROLES.map((role) => (
                  <option key={role.id} value={role.id}>
                    {my ? role.labelMy : role.label}
                  </option>
                ))}
              </select>
              <input
                className={`pr-note ${my ? "my" : ""}`}
                value={r.note}
                placeholder={my ? "မှတ်ချက် (ဥပမာ လည်ဆွဲပဲ)" : "Note (e.g. only the necklace)"}
                onChange={(e) => patchRef(r.id, { note: e.target.value })}
              />
            </div>
          ))}
          {refs.length < MAX_REFS ? <Drop label="Reference" labelMy="Reference ပုံ" my={my} multiple onFiles={addRefs} /> : null}
        </div>
      </div>

      {base ? (
        <div className="prefs__keep">
          <span className={`prefs__keep-label ${my ? "my" : "t-micro"}`}>{my ? "ပုံ ၁ ကနေ မပြောင်းစေချင်တာ" : "Keep from image 1"}</span>
          <div className="grp__opts">
            {KEEPS.map((k) => (
              <button
                key={k.id}
                type="button"
                className="chip"
                aria-pressed={keep.includes(k.id)}
                onClick={() => update((p) => ({ ...p, keep: p.keep.includes(k.id) ? p.keep.filter((x) => x !== k.id) : [...p.keep, k.id] }))}
              >
                <span className={my ? "my" : undefined}>{my ? k.labelMy : k.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
