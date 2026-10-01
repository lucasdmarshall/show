"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FIELDS,
  FORMATS,
  PALETTES,
  TEMPLATES,
  initialDoc,
  pagesOf,
  planSpreads,
  render,
  type Doc,
  type Fonts,
  type Photo,
  type TemplateId,
} from "@/lib/album";
import { check, isZawgyi, zg2uni } from "@/lib/myanmar";
import { canvas, download, toBlob, stem } from "@/lib/image";
import { compileParts } from "@/lib/compile";
import { zip } from "@/lib/zip";
import { keep } from "@/lib/vault";
import { Grp } from "./Choices";
import { PromptDock } from "./PromptDock";
import { Generate } from "./Generate";
import "./album.css";

/* The preview is drawn at this long side; export at the format's own. */
const PREVIEW = 1100;
/* Photographs for export are decoded no larger than this. */
const EXPORT_PHOTO = 3000;

type Pic = { id: string; file: Blob; name: string; aspect: number };

function useFonts(): Fonts | null {
  const [fonts, setFonts] = useState<Fonts | null>(null);
  useEffect(() => {
    const css = getComputedStyle(document.body);
    const f: Fonts = {
      sans: css.getPropertyValue("--font-jakarta").trim() || "sans-serif",
      my: css.getPropertyValue("--font-padauk").trim() || "sans-serif",
      serif: css.getPropertyValue("--font-myserif").trim() || "serif",
    };
    /* canvas does not wait for web fonts: load every face first */
    const sample = "မင်္ဂလာ ဖိတ်ကြားလွှာ SHOW 2026";
    Promise.all(
      [f.sans, f.my, f.serif].flatMap((fam) => [400, 700].map((w) => document.fonts.load(`${w} 40px ${fam}`, sample))),
    )
      .catch(() => undefined)
      .then(() => setFonts(f));
  }, []);
  return fonts;
}

/* Photographs are decoded when a page needs them, not all at once —
   an album of 300 would not fit in a phone's memory. */
function useBitmaps() {
  const cache = useRef(new Map<string, ImageBitmap>());
  const get = useCallback(async (p: Pic, max: number): Promise<ImageBitmap> => {
    const key = `${p.id}@${max}`;
    const hit = cache.current.get(key);
    if (hit) return hit;
    const probe = await createImageBitmap(p.file);
    const k = Math.min(1, max / Math.max(probe.width, probe.height));
    const bmp =
      k < 1
        ? await createImageBitmap(probe, { resizeWidth: Math.round(probe.width * k), resizeHeight: Math.round(probe.height * k), resizeQuality: "high" })
        : probe;
    if (bmp !== probe) probe.close();
    if (max <= PREVIEW) {
      cache.current.set(key, bmp);
      if (cache.current.size > 24) {
        const first = cache.current.keys().next().value!;
        cache.current.get(first)?.close();
        cache.current.delete(first);
      }
    }
    return bmp;
  }, []);
  useEffect(() => {
    const c = cache.current;
    return () => c.forEach((b) => b.close());
  }, []);
  return get;
}

async function aspectOf(f: Blob) {
  const b = await createImageBitmap(f);
  const a = b.width / b.height;
  b.close();
  return a;
}

export function Album({ my }: { my: boolean }) {
  const [docs, setDocs] = useState<Record<TemplateId, Doc>>(
    () => Object.fromEntries(TEMPLATES.map((t) => [t.id, initialDoc(t.id)])) as Record<TemplateId, Doc>,
  );
  const [tpl, setTpl] = useState<TemplateId>("invitation");
  const [pics, setPics] = useState<Record<TemplateId, Pic[]>>(
    () => Object.fromEntries(TEMPLATES.map((t) => [t.id, []])) as unknown as Record<TemplateId, Pic[]>,
  );
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fonts = useFonts();
  const bitmap = useBitmaps();
  const cv = useRef<HTMLCanvasElement>(null);
  const addRef = useRef<HTMLInputElement>(null);

  const doc = docs[tpl];
  const photos = pics[tpl];
  const info = TEMPLATES.find((t) => t.id === tpl)!;
  const fmt = FORMATS.find((f) => f.id === doc.format)!;
  const aspects = photos.map((p) => p.aspect);
  const pages = pagesOf(doc, aspects);
  const pg = Math.min(page, pages - 1);

  const setDoc = (change: Partial<Doc>) => setDocs((d) => ({ ...d, [tpl]: { ...d[tpl], ...change } }));
  const setField = (id: string, v: string) => setDoc({ fields: { ...doc.fields, [id]: v } });

  /* the photographs this page draws */
  const pagePics = useCallback(
    (d: Doc, list: Pic[], p: number) => {
      if (d.template !== "spread") return list.slice(0, 1);
      const plan = planSpreads(list.map((x) => x.aspect));
      return (plan[p] ?? []).map((i) => list[i]);
    },
    [],
  );

  /* -- preview ---------------------------------------------------- */
  useEffect(() => {
    if (!fonts || !cv.current) return;
    let live = true;
    const t = window.setTimeout(async () => {
      const need = pagePics(doc, photos, pg);
      const bmps = await Promise.all(need.map((p) => bitmap(p, doc.template === "spread" ? 900 : PREVIEW)));
      if (!live || !cv.current) return;
      const k = PREVIEW / Math.max(fmt.w, fmt.h);
      const c = cv.current;
      c.width = Math.round(fmt.w * k);
      c.height = Math.round(fmt.h * k);
      const ctx = c.getContext("2d")!;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      /* spreads index into the whole album; hand render the page's own
         photographs at their album positions */
      if (doc.template === "spread") {
        const plan = planSpreads(photos.map((p) => p.aspect));
        const full: Photo[] = photos.map(() => ({ width: 1, height: 1 }) as unknown as Photo);
        (plan[pg] ?? []).forEach((idx, j) => (full[idx] = bmps[j]));
        render(ctx, doc, full, fonts, pg);
      } else {
        render(ctx, doc, bmps, fonts, 0);
      }
    }, 60);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [doc, photos, pg, fonts, fmt, bitmap, pagePics]);

  /* -- photographs in -------------------------------------------- */
  const addFiles = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    setBusy(my ? "ပုံ ဖတ်နေသည်…" : "Reading photographs…");
    const made: Pic[] = [];
    for (const f of imgs) {
      try {
        made.push({ id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 6)}`, file: f, name: f.name, aspect: await aspectOf(f) });
      } catch {
        /* skip what will not decode */
      }
    }
    setPics((p) => ({ ...p, [tpl]: info.photos === 1 ? made.slice(0, 1) : [...p[tpl], ...made] }));
    setBusy(null);
  };

  /* -- export ----------------------------------------------------- */
  const renderFull = async (p: number): Promise<Blob> => {
    const need = pagePics(doc, photos, p);
    const bmps = await Promise.all(need.map((x) => bitmap(x, EXPORT_PHOTO)));
    const c = canvas(fmt.w, fmt.h);
    const ctx = c.getContext("2d")!;
    if (doc.template === "spread") {
      const plan = planSpreads(photos.map((x) => x.aspect));
      const full: Photo[] = photos.map(() => ({ width: 1, height: 1 }) as unknown as Photo);
      (plan[p] ?? []).forEach((idx, j) => (full[idx] = bmps[j]));
      render(ctx, doc, full, fonts!, p);
    } else render(ctx, doc, bmps, fonts!, 0);
    bmps.forEach((b) => b.close());
    /* print wants PNG; social wants a JPEG it will not recompress badly */
    const print = doc.format === "a5" || doc.format === "card" || doc.format === "spread";
    return toBlob(c, print ? "image/png" : "image/jpeg", 0.94);
  };

  const exportAll = async () => {
    if (!fonts) return;
    setNotice(null);
    const name = stem(doc.fields.title || doc.fields.names || doc.fields.headline || info.label).replace(/\s+/g, "-").slice(0, 40) || "show";
    try {
      if (pages === 1) {
        setBusy(my ? "ထုတ်နေသည်…" : "Exporting…");
        const b = await renderFull(0);
        download(b, `${name}.${b.type === "image/png" ? "png" : "jpg"}`);
        void keep(b, "album", `${info.label} · ${name}`);
      } else {
        const entries: { name: string; data: Blob }[] = [];
        for (let p = 0; p < pages; p++) {
          setBusy(my ? `စာမျက်နှာ ${p + 1}/${pages}` : `Page ${p + 1} of ${pages}`);
          const b = await renderFull(p);
          entries.push({ name: `${name}-spread-${String(p + 1).padStart(2, "0")}.png`, data: b });
        }
        download(await zip(entries), `${name}-album.zip`);
        void keep(entries[0].data, "album", `${info.label} · ${name}`);
      }
      setNotice(
        my
          ? `${fmt.w}×${fmt.h} နဲ့ ထုတ်ပြီး — မြန်မာစာကို တကယ့်စာလုံးအဖြစ် စီထား`
          : `Exported at ${fmt.w}×${fmt.h} — the Burmese is real type, not a model's guess`,
      );
    } catch {
      setNotice(my ? "ထုတ်လို့ မရပါ" : "Export failed");
    } finally {
      setBusy(null);
    }
  };

  /* -- premium: a textless design plate from a model ---------------- */
  const pal = PALETTES.find((p) => p.id === doc.palette)!;
  const plate = useMemo(
    () =>
      compileParts(
        [
          {
            invitation: "an ornate Burmese wedding invitation background, fine gold filigree and kanote scrollwork border",
            cover: "an elegant wedding album cover background, fine-art texture",
            spread: "an album page background texture",
            pricelist: "a luxury photography studio price list background, subtle texture, generous empty space",
            promo: "a festive promotional poster background, celebratory mood",
            testimonial: "a soft elegant background for a customer quote",
          }[tpl],
          `palette of ${pal.label.toLowerCase()}, background ${pal.bg}, accents ${pal.accent}`,
          "large empty area left clear for typography",
          "no text, no letters, no numbers, no writing of any kind",
        ],
        ["text", "letters", "typography", "watermark", "signature", "logo"],
        fmt.w > fmt.h ? "16:9" : fmt.w === fmt.h ? "1:1" : "4:5",
        { photographic: false },
      ),
    [tpl, pal, fmt],
  );

  return (
    <div className="album">
      <div className="album__tpls" role="tablist" aria-label={my ? "အမျိုးအစား" : "What you are making"}>
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tpl === t.id}
            className={`mode ${my ? "my" : ""}`}
            onClick={() => {
              setTpl(t.id);
              setPage(0);
            }}
          >
            {my ? t.labelMy : t.label}
          </button>
        ))}
      </div>

      <div className="album__body">
        <section className="album__stage" aria-label={my ? "အစမ်းကြည့်" : "Preview"}>
          <div className="album__canvas" style={{ aspectRatio: `${fmt.w} / ${fmt.h}` }}>
            <canvas ref={cv} aria-label={my ? "ဒီဇိုင်း" : "The design"} />
            {!fonts ? <span className="album__loading t-micro">{my ? "စာလုံး ဖွင့်နေသည်" : "Loading type"}</span> : null}
          </div>
          {pages > 1 ? (
            <div className="album__pages">
              <button type="button" className="lib__act" onClick={() => setPage(Math.max(0, pg - 1))} disabled={pg === 0}>
                ←
              </button>
              <span className="t-micro">
                {my ? `Spread ${pg + 1} / ${pages}` : `Spread ${pg + 1} of ${pages}`}
              </span>
              <button type="button" className="lib__act" onClick={() => setPage(Math.min(pages - 1, pg + 1))} disabled={pg >= pages - 1}>
                →
              </button>
            </div>
          ) : null}
          <p className={`album__truth ${my ? "my" : "t-small"}`}>
            {my
              ? "မြန်မာစာကို model က မရေးဘူး — browser ရဲ့ shaper နဲ့ တကယ့်စာလုံး စီထားလို့ မင်္ဂလာ၊ ကျွန်ုပ်၊ သဉ္ဇာ လို ပါဌ်ဆင့်တွေအထိ အမှန်ပဲ ထွက်မယ်။"
              : "No model writes the Burmese here. It is set as real type by the browser's shaper, so medials, stacked consonants and tone marks come out right."}
          </p>
        </section>

        <section className="album__panel" aria-label={my ? "ပြင်ဆင်ရန်" : "Edit"}>
          <Grp title={info.photos > 1 ? "Photographs" : "Photograph"} titleMy="ဓာတ်ပုံ" my={my} aside={photos.length ? `${photos.length}` : undefined}>
            <div
              className="album__drop"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void addFiles([...e.dataTransfer.files]);
              }}
            >
              <button type="button" className="btn btn--quiet" onClick={() => addRef.current?.click()}>
                {info.photos > 1
                  ? my
                    ? "ပုံများ ထည့်မည်"
                    : "Add photographs"
                  : photos.length
                    ? my
                      ? "ပုံ ပြောင်းမည်"
                      : "Change photograph"
                    : my
                      ? "ပုံ ထည့်မည်"
                      : "Add a photograph"}
              </button>
              {photos.length ? (
                <button type="button" className="lib__act lib__act--warn" onClick={() => setPics((p) => ({ ...p, [tpl]: [] }))}>
                  {my ? "ဖယ်မည်" : "Remove"}
                </button>
              ) : null}
              {busy ? <span className="t-small album__busy">{busy}</span> : null}
              <input
                ref={addRef}
                type="file"
                accept="image/*"
                multiple={info.photos > 1}
                hidden
                onChange={(e) => {
                  void addFiles([...(e.target.files ?? [])]);
                  e.target.value = "";
                }}
              />
            </div>
            {tpl === "spread" && photos.length ? (
              <p className={`room__hint ${my ? "my" : "t-small"}`}>
                {my
                  ? `ပုံ ${photos.length} ပုံကို spread ${pages} ခု အလိုအလျောက် ခွဲစီထား`
                  : `${photos.length} photographs laid out across ${pages} spreads automatically`}
              </p>
            ) : null}
          </Grp>

          <Grp title="Words" titleMy="စာသား" my={my}>
            <div className="album__fields">
              {FIELDS[tpl].map((f) => {
                const v = doc.fields[f.id] ?? "";
                const zg = isZawgyi(v);
                const issues = zg ? [] : check(v);
                return (
                  <label key={f.id} className="afield">
                    <span className={`afield__label ${my ? "my" : "t-micro"}`}>{my ? f.labelMy : f.label}</span>
                    <textarea
                      className="field my"
                      rows={f.multi ? 3 : 1}
                      value={v}
                      onChange={(e) => setField(f.id, e.target.value)}
                    />
                    {zg ? (
                      <span className="afield__warn">
                        <span className={my ? "my" : "t-small"}>{my ? "Zawgyi နဲ့ ရေးထားပုံရတယ်" : "This looks like Zawgyi"}</span>
                        <button type="button" className="lib__act" onClick={() => setField(f.id, zg2uni(v))}>
                          {my ? "Unicode ပြောင်းမည်" : "Convert to Unicode"}
                        </button>
                      </span>
                    ) : issues.length ? (
                      <span className={`afield__warn ${my ? "my" : "t-small"}`}>{my ? issues[0].my : issues[0].en}</span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </Grp>

          {tpl === "pricelist" ? (
            <Grp title="Packages" titleMy="Package များ" my={my} aside={`${doc.items.length}`}>
              <div className="album__items">
                {doc.items.map((it, i) => (
                  <div key={i} className="aitem">
                    <input
                      className="field my"
                      value={it.name}
                      aria-label={my ? "အမည်" : "Name"}
                      onChange={(e) => setDoc({ items: doc.items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                    />
                    <input
                      className="field aitem__price"
                      inputMode="numeric"
                      value={it.price}
                      aria-label={my ? "ဈေး" : "Price"}
                      onChange={(e) =>
                        setDoc({ items: doc.items.map((x, j) => (j === i ? { ...x, price: Number(e.target.value.replace(/\D/g, "")) || 0 } : x)) })
                      }
                    />
                    <input
                      className="field my aitem__note"
                      value={it.note}
                      aria-label={my ? "မှတ်ချက်" : "Note"}
                      onChange={(e) => setDoc({ items: doc.items.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)) })}
                    />
                    <button type="button" className="lib__act lib__act--warn" aria-label={my ? "ဖျက်" : "Remove"} onClick={() => setDoc({ items: doc.items.filter((_, j) => j !== i) })}>
                      ×
                    </button>
                  </div>
                ))}
                {doc.items.length < 8 ? (
                  <button type="button" className="lib__act" onClick={() => setDoc({ items: [...doc.items, { name: "Package", price: 100000, note: "" }] })}>
                    + {my ? "Package ထည့်" : "Add package"}
                  </button>
                ) : null}
              </div>
            </Grp>
          ) : null}

          <Grp title="Look" titleMy="ပုံစံ" my={my}>
            <div className="grp__opts">
              {PALETTES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="chip album__pal"
                  aria-pressed={doc.palette === p.id}
                  onClick={() => setDoc({ palette: p.id })}
                  style={{ "--p-bg": p.bg, "--p-ac": p.accent } as React.CSSProperties}
                >
                  <span className="album__dot" aria-hidden="true" />
                  <span className={my ? "my" : undefined}>{my ? p.labelMy : p.label}</span>
                </button>
              ))}
            </div>
            <div className="album__toggles">
              <label className="batch__switch">
                <input type="checkbox" checked={doc.serif} onChange={(e) => setDoc({ serif: e.target.checked })} />
                <span className={my ? "my" : "t-small"}>{my ? "ခံ့ညားတဲ့ serif စာလုံး" : "Formal serif Burmese"}</span>
              </label>
              <label className="batch__switch">
                <input type="checkbox" checked={doc.burmeseDigits} onChange={(e) => setDoc({ burmeseDigits: e.target.checked })} />
                <span className={my ? "my" : "t-small"}>{my ? "မြန်မာ ဂဏန်း (၁၂၃)" : "Burmese numerals (၁၂၃)"}</span>
              </label>
            </div>
          </Grp>

          <Grp title="Size" titleMy="အရွယ်" my={my}>
            <div className="grp__opts">
              {FORMATS.filter((f) => (tpl === "spread" ? f.id === "spread" : f.id !== "spread")).map((f) => (
                <button key={f.id} type="button" className="chip" aria-pressed={doc.format === f.id} onClick={() => setDoc({ format: f.id })}>
                  <span className={my ? "my" : undefined}>{my ? f.labelMy : f.label}</span>
                </button>
              ))}
            </div>
          </Grp>

          <div className="album__acts">
            {notice ? (
              <p className={`grade__notice ${my ? "my" : "t-small"}`} role="status">
                {notice}
              </p>
            ) : null}
            <button type="button" className="btn" onClick={exportAll} disabled={!fonts || !!busy || (tpl === "spread" && !photos.length)}>
              {busy ?? (pages > 1 ? (my ? `Spread ${pages} ခု ထုတ်မည် (.zip)` : `Export ${pages} spreads (.zip)`) : my ? "ထုတ်မည်" : "Export")}
            </button>
          </div>

          <div className="restore__premium">
            <Grp title="A design plate from a model" titleMy="Model နဲ့ ဒီဇိုင်း နောက်ခံ" my={my}>
              <p className={`room__hint ${my ? "my" : "t-small"}`}>
                {my
                  ? "Model ကို စာမပါတဲ့ နောက်ခံပဲ ဆွဲခိုင်းမယ် — စာကို SHOW က စီမယ်။ ရလဒ်က ဒီ template ရဲ့ ပုံ ဖြစ်သွားမယ်။"
                  : "The model is asked for a design with no text at all — SHOW sets the words. The result becomes this template's picture."}
              </p>
            </Grp>
            <div className="inset-dock">
              <PromptDock out={plate} my={my} />
            </div>
            <Generate
              my={my}
              section="album"
              out={plate}
              aspect={fmt.w > fmt.h ? "16:9" : fmt.w === fmt.h ? "1:1" : "4:5"}
              onResults={async (blobs) => {
                const b = blobs[0];
                if (!b) return;
                setPics((p) => ({ ...p, [tpl]: [{ id: `gen-${Date.now()}`, file: b, name: "plate", aspect: 1 }] }));
                const a = await aspectOf(b);
                setPics((p) => ({ ...p, [tpl]: p[tpl].map((x) => (x.name === "plate" ? { ...x, aspect: a } : x)) }));
              }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
