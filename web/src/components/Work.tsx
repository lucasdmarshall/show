"use client";

import { useEffect, useState } from "react";
import { persist, urlOf, usage, useWork, work, del, type WorkItem } from "@/lib/vault";
import { download, stem } from "@/lib/image";
import { zip } from "@/lib/zip";
import { getSection, type SectionId } from "@/lib/sections";
import "./work.css";

type Filter = "all" | "portfolio" | "trash" | string;

const mb = (n: number) => (n / 1024 / 1024).toFixed(n > 1e8 ? 0 : 1);

export function Work({ my, onGo }: { my: boolean; onGo?: (id: SectionId) => void }) {
  const items = useWork();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [space, setSpace] = useState<{ used: number; quota: number } | null>(null);
  const [kept, setKept] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    usage().then((u) => live && setSpace(u));
    return () => {
      live = false;
    };
  }, [items.length]);

  const live = items.filter((i) => !i.trashed);
  const trash = items.filter((i) => i.trashed);
  const sources = [...new Set(live.map((i) => i.source))];
  const shown =
    filter === "trash"
      ? trash
      : filter === "portfolio"
        ? live.filter((i) => i.exhibit)
        : filter === "all"
          ? live
          : live.filter((i) => i.source === filter);
  const current = items.find((i) => i.id === open) ?? null;

  const toggleSel = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const exhibit = async (it: WorkItem, on: boolean) => {
    const order = Math.max(0, ...live.filter((x) => x.exhibit).map((x) => x.exhibit!.order)) + 1;
    await work.patch(it.id, { exhibit: on ? (it.exhibit ?? { caption: it.title, captionMy: "", order }) : null });
  };

  const zipSelected = async () => {
    const list = live.filter((i) => selected.has(i.id));
    const z = await zip(list.map((i) => ({ name: `${stem(i.title).replace(/[\\/:*?"<>|]/g, "-") || i.source}.jpg`, data: i.blob })));
    download(z, `show-work-${list.length}.zip`);
  };

  const label = (source: string) => {
    try {
      const s = getSection(source as SectionId);
      return my ? s.labelMy : s.label;
    } catch {
      return source;
    }
  };

  if (!items.length) {
    return (
      <div className="work work--empty">
        <p className="t-micro">{my ? "အလုပ်" : "Work"}</p>
        <h2 className={my ? "my" : "t-h3"}>{my ? "လုပ်သမျှ ဒီမှာ အလိုလို ရောက်လာမယ်" : "Everything you make lands here by itself"}</h2>
        <p className={my ? "my" : "t-small"}>
          {my
            ? "Grade၊ Batch၊ Restore၊ Harmonize၊ Album က ထုတ်လိုက်တာတိုင်း ဒီစက်ထဲမှာပဲ သိမ်းထားမယ် — ကိုယ်မဆုံးဖြတ်မချင်း ဘယ်သူမှ မမြင်ရ။"
            : "Every export from Grade, Batch, Restore, Harmonize and Album is kept here, on this device — private until you decide otherwise."}
        </p>
        {onGo ? (
          <button type="button" className="btn btn--quiet" onClick={() => onGo("grade")}>
            {my ? "Grade နဲ့ စမယ်" : "Start with Grade"}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="work">
      <header className="work__head">
        <div className="work__filters" role="tablist">
          {(
            [
              ["all", my ? "အားလုံး" : "All", live.length],
              ...sources.map((s) => [s, label(s), live.filter((i) => i.source === s).length]),
              ["portfolio", my ? "ပြခန်းထဲ" : "In portfolio", live.filter((i) => i.exhibit).length],
              ["trash", my ? "အမှိုက်ပုံး" : "Trash", trash.length],
            ] as [string, string, number][]
          ).map(([id, text, n]) => (
            <button key={id} type="button" role="tab" aria-selected={filter === id} className="batch__filter" onClick={() => setFilter(id)}>
              <span className={my ? "my" : undefined}>{text}</span>
              <span className="batch__n">{n}</span>
            </button>
          ))}
        </div>
        <div className="work__meta">
          <span className="t-micro">{my ? "ဒီစက်ထဲမှာပဲ · သီးသန့်" : "On this device · private"}</span>
          {space ? (
            <span className="t-micro work__space">
              {mb(space.used)} / {mb(space.quota)} MB
            </span>
          ) : null}
          {kept === null ? (
            <button type="button" className="lib__act" onClick={async () => setKept(await persist())}>
              {my ? "ဖျက်မခံရအောင် ထိန်းမယ်" : "Keep safe from clean-up"}
            </button>
          ) : (
            <span className="t-micro">{kept ? (my ? "ထိန်းထားပြီ" : "Protected") : my ? "Browser က ခွင့်မပြု" : "The browser declined"}</span>
          )}
        </div>
      </header>

      {selected.size ? (
        <div className="work__bulk">
          <span className="t-small">{my ? `${selected.size} ခု ရွေးထား` : `${selected.size} selected`}</span>
          <button type="button" className="lib__act" onClick={() => void zipSelected()}>
            {my ? ".zip ဒေါင်းမည်" : "Download .zip"}
          </button>
          <button
            type="button"
            className="lib__act"
            onClick={async () => {
              for (const id of selected) {
                const it = live.find((x) => x.id === id);
                if (it && !it.exhibit) await exhibit(it, true);
              }
              setSelected(new Set());
            }}
          >
            {my ? "ပြခန်းထဲ ထည့်" : "Add to portfolio"}
          </button>
          <button
            type="button"
            className="lib__act lib__act--warn"
            onClick={async () => {
              for (const id of selected) await work.patch(id, { trashed: Date.now() });
              setSelected(new Set());
            }}
          >
            {my ? "အမှိုက်ပုံးထဲ" : "Move to trash"}
          </button>
          <button type="button" className="lib__act" onClick={() => setSelected(new Set())}>
            {my ? "မရွေးတော့" : "Clear"}
          </button>
        </div>
      ) : null}

      {filter === "trash" && trash.length ? (
        <p className={`work__trashnote ${my ? "my" : "t-small"}`}>
          {my ? "အမှိုက်ပုံးထဲက ပုံတွေကို ပြန်ယူလို့ရသေးတယ်။ အပြီးဖျက်တာကတော့ ပြန်မရတော့ဘူး။" : "Anything in the trash can still be put back. Deleting for good cannot be undone."}
        </p>
      ) : null}

      <ul className="work__grid">
        {shown.map((it) => (
          <li key={it.id} className="wtile" data-selected={selected.has(it.id) || undefined}>
            <button type="button" className="wtile__img" onClick={() => setOpen(it.id)} style={{ aspectRatio: `${it.w} / ${it.h}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urlOf(it.thumb)} alt={it.title} loading="lazy" />
              {it.exhibit ? <span className="wtile__ex t-micro">{my ? "ပြခန်း" : "Portfolio"}</span> : null}
            </button>
            <div className="wtile__meta">
              <label className="wtile__pick">
                <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggleSel(it.id)} aria-label={my ? "ရွေး" : "Select"} />
              </label>
              <span className="wtile__title">{it.title}</span>
              <span className={`wtile__src ${my ? "my" : "t-micro"}`}>{label(it.source)}</span>
            </div>
          </li>
        ))}
      </ul>

      {current ? (
        <Viewer
          it={current}
          my={my}
          label={label(current.source)}
          onClose={() => setOpen(null)}
          onExhibit={(on) => void exhibit(current, on)}
          onCaption={(caption, captionMy) => void work.patch(current.id, { exhibit: { ...(current.exhibit ?? { order: 0, caption: "", captionMy: "" }), caption, captionMy } })}
          onTrash={() => {
            void work.patch(current.id, { trashed: Date.now(), exhibit: null });
            setOpen(null);
          }}
          onRestore={() => void work.patch(current.id, { trashed: null })}
          onDelete={async () => {
            await del("work", current.id);
            await work.reload();
            setOpen(null);
          }}
        />
      ) : null}
    </div>
  );
}

function Viewer({
  it,
  my,
  label,
  onClose,
  onExhibit,
  onCaption,
  onTrash,
  onRestore,
  onDelete,
}: {
  it: WorkItem;
  my: boolean;
  label: string;
  onClose: () => void;
  onExhibit: (on: boolean) => void;
  onCaption: (en: string, mm: string) => void;
  onTrash: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const [url] = useState(() => URL.createObjectURL(it.blob));
  const [confirm, setConfirm] = useState(false);
  const [cap, setCap] = useState(it.exhibit?.caption ?? it.title);
  const [capMy, setCapMy] = useState(it.exhibit?.captionMy ?? "");
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);

  return (
    <div className="bdetail wview" role="dialog" aria-modal="true" aria-label={it.title}>
      <div className="bdetail__bar">
        <span className="bdetail__name">
          {it.title} · <span className={my ? "my" : undefined}>{label}</span> · {new Date(it.created).toLocaleDateString()}
        </span>
        <button type="button" className="lib__act" onClick={onClose}>
          {my ? "ပိတ်" : "Close"}
        </button>
      </div>
      <div className="wview__img">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={it.title} />
      </div>
      <div className="wview__acts">
        <span className="t-micro">
          {it.w}×{it.h} · {(it.blob.size / 1024 / 1024).toFixed(1)} MB
        </span>
        <button type="button" className="lib__act" onClick={() => download(it.blob, `${stem(it.title) || "show"}.jpg`)}>
          {my ? "ဒေါင်းမည်" : "Download"}
        </button>
        {it.trashed ? (
          <>
            <button type="button" className="lib__act" onClick={onRestore}>
              {my ? "ပြန်ယူမည်" : "Put back"}
            </button>
            {confirm ? (
              <button type="button" className="lib__act lib__act--warn" onClick={onDelete}>
                {my ? "သေချာတယ် — အပြီးဖျက်" : "Yes — delete for good"}
              </button>
            ) : (
              <button type="button" className="lib__act lib__act--warn" onClick={() => setConfirm(true)}>
                {my ? "အပြီးဖျက်မည်" : "Delete for good"}
              </button>
            )}
          </>
        ) : (
          <>
            <button type="button" className="lib__act" onClick={() => onExhibit(!it.exhibit)}>
              {it.exhibit ? (my ? "ပြခန်းက ဖယ်" : "Take out of portfolio") : my ? "ပြခန်းထဲ ထည့်" : "Add to portfolio"}
            </button>
            <button type="button" className="lib__act lib__act--warn" onClick={onTrash}>
              {my ? "အမှိုက်ပုံးထဲ" : "Move to trash"}
            </button>
          </>
        )}
      </div>
      {it.exhibit ? (
        <form
          className="wview__cap"
          onSubmit={(e) => {
            e.preventDefault();
            onCaption(cap, capMy);
          }}
        >
          <input className="field" value={cap} onChange={(e) => setCap(e.target.value)} placeholder="Caption" aria-label="Caption" />
          <input className="field my" value={capMy} onChange={(e) => setCapMy(e.target.value)} placeholder="မြန်မာ စာတန်း" aria-label="Burmese caption" />
          <button type="submit" className="btn btn--quiet">
            {my ? "သိမ်း" : "Save"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
