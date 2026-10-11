"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BUILT_IN,
  NEUTRAL,
  compilePipeline,
  histogram,
  isNeutral,
  removeLook,
  renderFinal,
  renderStages,
  saveLook,
  toCube,
  useOwnLooks,
  type Channel,
  type Histogram as H,
  type Look,
  type Point,
  type Settings,
} from "@/lib/grade";
import { Reveal, type RevealLayer } from "./Reveal";
import { Histogram } from "./Histogram";
import { Curves } from "./Curves";
import { DropZone } from "./DropZone";
import { keep } from "@/lib/vault";
import { compileRoom, opt, toggle } from "@/lib/rooms";
import type { Group } from "@/lib/catalogue";
import type { Selection } from "@/lib/compile";
import { Choices } from "./Choices";
import { PromptDock } from "./PromptDock";
import { Generate, Results } from "./Generate";
import { AiTabs, type Way } from "./AiTabs";
import { useIsPhone } from "@/lib/useIsPhone";
import { MaybeBar, PromptBox } from "./PromptBox";

import "./grade.css";

/* The preview is graded at this size; export goes back to the file. */
const PREVIEW = 1400;
/* Past this many pixels a phone's canvas refuses to allocate. */
const MAX_AREA = 16_000_000;

type Stages = { tone: string; colour: string; curves: string };

type DialDef = {
  key: Exclude<keyof Settings, "curves">;
  label: string;
  labelMy: string;
  min: number;
  max: number;
  step: number;
  /** slider units per settings unit */
  scale: number;
  unit?: string;
};

const TONE: DialDef[] = [
  {
    key: "exposure",
    label: "Exposure",
    labelMy: "အလင်းဝင်မှု",
    min: -200,
    max: 200,
    step: 5,
    scale: 100,
    unit: "EV",
  },
  {
    key: "contrast",
    label: "Contrast",
    labelMy: "ကွာဟမှု",
    min: -100,
    max: 100,
    step: 1,
    scale: 100,
  },
  {
    key: "highlights",
    label: "Highlights",
    labelMy: "အလင်းပိုင်း",
    min: -100,
    max: 100,
    step: 1,
    scale: 100,
  },
  {
    key: "shadows",
    label: "Shadows",
    labelMy: "အမှောင်ပိုင်း",
    min: -100,
    max: 100,
    step: 1,
    scale: 100,
  },
];

const COLOUR: DialDef[] = [
  {
    key: "temperature",
    label: "Temperature",
    labelMy: "အပူချိန်",
    min: -100,
    max: 100,
    step: 1,
    scale: 100,
  },
  {
    key: "tint",
    label: "Tint",
    labelMy: "အစိမ်း/ပန်းရောင်",
    min: -100,
    max: 100,
    step: 1,
    scale: 100,
  },
  {
    key: "saturation",
    label: "Saturation",
    labelMy: "အရောင်ပြင်းအား",
    min: -100,
    max: 100,
    step: 1,
    scale: 100,
  },
];

const toBlob = (c: HTMLCanvasElement, type: string, q: number) =>
  new Promise<Blob>((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), type, q),
  );

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function Dial({
  d,
  value,
  my,
  onChange,
}: {
  d: DialDef;
  value: number;
  my: boolean;
  onChange: (v: number) => void;
}) {
  const raw = Math.round(value * d.scale);
  const shown = d.unit
    ? `${value > 0 ? "+" : ""}${value.toFixed(2)} ${d.unit}`
    : `${raw > 0 ? "+" : ""}${raw}`;
  const pct = ((raw - d.min) / (d.max - d.min)) * 100;
  const zero = ((0 - d.min) / (d.max - d.min)) * 100;

  return (
    <div className="dial" data-moved={raw !== 0 || undefined}>
      <div className="dial__row">
        <span className={`dial__label ${my ? "my" : ""}`}>
          {my ? d.labelMy : d.label}
        </span>
        {raw !== 0 ? (
          <button
            type="button"
            className="dial__reset"
            onClick={() => onChange(0)}
            aria-label={
              my ? `${d.labelMy} ပြန်ထား` : `Reset ${d.label.toLowerCase()}`
            }
          >
            ↺
          </button>
        ) : null}
        <output className="dial__val">{shown}</output>
      </div>
      <input
        type="range"
        className="dial__range"
        min={d.min}
        max={d.max}
        step={d.step}
        value={raw}
        aria-label={my ? d.labelMy : d.label}
        onChange={(e) => onChange(Number(e.target.value) / d.scale)}
        style={
          {
            "--from": `${Math.min(pct, zero)}%`,
            "--to": `${Math.max(pct, zero)}%`,
          } as React.CSSProperties
        }
      />
    </div>
  );
}

/* The model regrades — colour and tone, nothing else. */
const AI_GRADE: Group[] = [
  {
    id: "look",
    label: "Look",
    labelMy: "ပုံစံ",
    order: 0,
    options: [
      opt("clean", "Natural & clean", "သဘာဝ သန့်သန့်", "a clean, natural colour grade: true whites, accurate skin, gentle contrast"),
      opt("portra", "Warm film", "နွေးထွေး film", "a warm Kodak Portra film look: creamy highlights, soft warm skin, fine grain"),
      opt("gold", "Kodak Gold", "Kodak Gold", "a Kodak Gold 200 look: golden warmth, saturated yellows and reds, nostalgic"),
      opt("chrome", "Classic chrome", "Classic chrome", "a Fujifilm Classic Chrome look: muted colour, deep shadows, documentary calm"),
      opt("cine", "Cinematic", "ရုပ်ရှင်ဆန်", "a cinematic teal-and-orange grade: warm skin against cool shadows, rich contrast"),
      opt("monsoon", "Monsoon", "မိုးရာသီ", "a moody monsoon grade: cool diffuse light, deep greens, soft wet sheen", { mm: true }),
      opt("golden", "Golden hour", "ရွှေရောင် ညနေ", "the warmth of golden hour: low amber light, glowing rim, long soft shadows"),
      opt("pastel", "Soft pastel", "ပန်းနု", "a soft pastel grade: lifted shadows, airy highlights, gentle desaturated colour"),
      opt("wedding", "Wedding gold", "မင်္ဂလာ ရွှေ", "a Burmese wedding grade: rich golds and silk reds glowing, warm skin, luxurious", { mm: true }),
      opt("bw", "Black & white", "အဖြူအမည်း", "a rich black-and-white conversion: deep blacks, luminous skin, fine silver grain"),
    ],
  },
  {
    id: "fix",
    label: "Fix as well",
    labelMy: "တစ်ခါတည်း ပြင်",
    order: 1,
    multi: true,
    options: [
      opt("exposure", "Exposure", "အလင်း", "the exposure balanced: no blown highlights, open shadows"),
      opt("white", "White balance", "White balance", "the white balance corrected to neutral"),
      opt("skin", "Skin tones", "အသားအရေ", "even, natural skin tones without smoothing or beautifying"),
      opt("sky", "Sky", "ကောင်းကင်", "the sky recovered with natural colour and detail"),
    ],
  },
  {
    id: "strength",
    label: "How strong",
    labelMy: "ဘယ်လောက် ပြင်းမလဲ",
    order: 2,
    options: [
      opt("subtle", "Subtle", "နည်းနည်း", "applied subtly"),
      opt("clear", "Clear", "သိသာ", "applied clearly"),
      opt("bold", "Bold", "ပြင်းပြင်း", "applied boldly"),
    ],
  },
];

export function Grade({ my }: { my: boolean }) {
  /* the model grades by default; curves on this device are the second way */
  const [way, setWay] = useState<Way>("ai");
  const [aiSel, setAiSel] = useState<Selection>({ look: ["portra"], fix: ["exposure", "skin"], strength: ["clear"] });
  const [results, setResults] = useState<{ urls: string[]; blobs: Blob[]; seed: number } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [origUrl, setOrigUrl] = useState<string | null>(null);
  const [src, setSrc] = useState<ImageData | null>(null);
  const [aspect, setAspect] = useState(1.5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [settings, setSettings] = useState<Settings>(NEUTRAL);
  const [lookId, setLookId] = useState<string | null>(null);
  const [stages, setStages] = useState<Stages | null>(null);
  const [hist, setHist] = useState<H | null>(null);

  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const [lookName, setLookName] = useState("");

  const ownLooks = useOwnLooks();
  const generation = useRef(0);
  const stageUrls = useRef<Stages | null>(null);
  const canvases = useRef<{
    tone: HTMLCanvasElement;
    colour: HTMLCanvasElement;
    curves: HTMLCanvasElement;
  } | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const phone = useIsPhone();

  /* -- load ------------------------------------------------------ */
  const take = useCallback(
    async (f: File | null | undefined) => {
      if (!f) return;
      if (!f.type.startsWith("image/")) {
        setError(my ? "ဓာတ်ပုံဖိုင် မဟုတ်ပါ။" : "That is not an image file.");
        return;
      }
      setError(null);
      setBusy(true);
      try {
        const bmp = await createImageBitmap(f);
        const scale = Math.min(1, PREVIEW / Math.max(bmp.width, bmp.height));
        const w = Math.round(bmp.width * scale);
        const h = Math.round(bmp.height * scale);
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(bmp, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h);
        setAspect(bmp.width / bmp.height);
        bmp.close();

        canvases.current = {
          tone: Object.assign(document.createElement("canvas"), {
            width: w,
            height: h,
          }),
          colour: Object.assign(document.createElement("canvas"), {
            width: w,
            height: h,
          }),
          curves: Object.assign(document.createElement("canvas"), {
            width: w,
            height: h,
          }),
        };

        setResults(null);
        setOrigUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(f);
        });
        setFile(f);
        setSrc(data);
      } catch {
        setError(
          my ? "ဒီပုံကို ဖတ်လို့ မရပါ။" : "That image could not be read.",
        );
      } finally {
        setBusy(false);
      }
    },
    [my],
  );

  /* -- render: every stage, debounced, newest wins --------------- */
  useEffect(() => {
    if (!src || !canvases.current) return;
    const gen = ++generation.current;
    const cv = canvases.current;

    const timer = window.setTimeout(async () => {
      const p = compilePipeline(settings);
      const n = src.data.length;
      const out = {
        tone: new Uint8ClampedArray(n),
        colour: new Uint8ClampedArray(n),
        curves: new Uint8ClampedArray(n),
      };
      renderStages(src.data, p, out);
      if (gen !== generation.current) return;

      const put = (c: HTMLCanvasElement, px: Uint8ClampedArray<ArrayBuffer>) =>
        c
          .getContext("2d")!
          .putImageData(new ImageData(px, src.width, src.height), 0, 0);
      put(cv.tone, out.tone);
      put(cv.colour, out.colour);
      put(cv.curves, out.curves);

      const [a, b, c] = await Promise.all([
        toBlob(cv.tone, "image/jpeg", 0.9),
        toBlob(cv.colour, "image/jpeg", 0.9),
        toBlob(cv.curves, "image/jpeg", 0.9),
      ]);
      if (gen !== generation.current) return;

      const next = {
        tone: URL.createObjectURL(a),
        colour: URL.createObjectURL(b),
        curves: URL.createObjectURL(c),
      };
      const prev = stageUrls.current;
      stageUrls.current = next;
      setStages(next);
      setHist(histogram(out.curves));
      if (prev) {
        /* after the new frames have painted */
        window.setTimeout(() => {
          URL.revokeObjectURL(prev.tone);
          URL.revokeObjectURL(prev.colour);
          URL.revokeObjectURL(prev.curves);
        }, 400);
      }
    }, 70);

    return () => window.clearTimeout(timer);
  }, [src, settings]);

  useEffect(
    () => () => {
      const s = stageUrls.current;
      if (s) Object.values(s).forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  const ar = aspect > 1.6 ? "16:9" : aspect >= 1.2 ? "3:2" : aspect > 0.9 ? "1:1" : aspect < 0.7 ? "2:3" : "4:5";
  const aiOut = useMemo(
    () =>
      compileRoom(AI_GRADE, aiSel, ar, {
        lead: ["regrade the colour and tone of this photograph only"],
        negatives: ["changed face", "changed composition", "added objects", "plastic skin", "oversaturation"],
        edit: { strength: 0.3, keep: ["every face and identity", "every object and its shape", "the composition", "the sharpness"] },
      }),
    [aiSel, ar],
  );

  const layers: RevealLayer[] = useMemo(() => {
    const o = origUrl ?? "";
    return [
      { id: "orig", label: "Original", labelMy: "မူရင်း", src: o },
      {
        id: "tone",
        label: "Tone",
        labelMy: "အလင်းအမှောင်",
        src: stages?.tone ?? o,
      },
      {
        id: "colour",
        label: "Colour",
        labelMy: "အရောင်",
        src: stages?.colour ?? o,
      },
      {
        id: "curves",
        label: "Curves",
        labelMy: "Curve",
        src: stages?.curves ?? o,
      },
    ];
  }, [origUrl, stages]);

  /* -- editing ---------------------------------------------------- */
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setLookId(null);
  };

  const setCurve = (ch: Channel, pts: Point[]) => {
    setSettings((prev) => ({ ...prev, curves: { ...prev.curves, [ch]: pts } }));
    setLookId(null);
  };

  const apply = (look: Look) => {
    setSettings(structuredClone(look.settings));
    setLookId(look.id);
  };

  const stem = (file?.name ?? "photo").replace(/\.[^.]+$/, "");

  /* -- export ----------------------------------------------------- */
  const exportJpg = async () => {
    if (!file) return;
    setExporting(true);
    setNotice(null);
    try {
      const bmp = await createImageBitmap(file);
      const area = bmp.width * bmp.height;
      const k = area > MAX_AREA ? Math.sqrt(MAX_AREA / area) : 1;
      const w = Math.round(bmp.width * k);
      const h = Math.round(bmp.height * k);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(bmp, 0, 0, w, h);
      bmp.close();
      const img = ctx.getImageData(0, 0, w, h);
      renderFinal(img.data, compilePipeline(settings));
      ctx.putImageData(img, 0, 0);
      const out = await toBlob(c, "image/jpeg", 0.95);
      download(out, `${stem}-show.jpg`);
      void keep(out, "grade", stem);
      setNotice(
        k < 1
          ? my
            ? `${w}×${h} နဲ့ ထုတ်ပြီး — ဖုန်းရဲ့ canvas ကန့်သတ်ချက်ကြောင့် လျှော့ထားရ`
            : `Exported at ${w}×${h} — reduced to fit this device's canvas limit`
          : my
            ? `${w}×${h} မူရင်းအရွယ်နဲ့ ထုတ်ပြီး`
            : `Exported at full size, ${w}×${h}`,
      );
    } catch {
      setNotice(my ? "ထုတ်လို့ မရပါ။" : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const exportCube = () => {
    const name =
      [...BUILT_IN, ...ownLooks].find((l) => l.id === lookId)?.name ??
      `${stem} grade`;
    download(
      new Blob([toCube(settings, name)], { type: "text/plain" }),
      `${name.replace(/\s+/g, "-").toLowerCase()}.cube`,
    );
    setNotice(
      my
        ? ".cube ထုတ်ပြီး — Resolve, Premiere, Lightroom, Photoshop မှာ သုံးလို့ရ"
        : ".cube exported — opens in Resolve, Premiere, Lightroom and Photoshop",
    );
  };

  /* -- empty ------------------------------------------------------ */
  if (!src) {
    return (
      <div className="grade grade--empty">
        <DropZone
          my={my}
          title="Grade a photograph"
          titleMy="ဓာတ်ပုံတစ်ပုံ အရောင်ညှိမယ်"
          sub="Pick a look and AI regrades the colour and tone — faces and everything in the frame stay as shot. Curves and a .cube LUT on this device are there too."
          subMy="Look တစ်ခု ရွေးလိုက်ရင် AI က အရောင်နဲ့ အလင်းအမှောင်ကို ညှိပေးမယ် — မျက်နှာနဲ့ ပုံထဲက အရာအားလုံး မူရင်းအတိုင်း။ ဒီစက်ပေါ်မှာ curve နဲ့ .cube LUT လည်း ရှိတယ်။"
          busy={busy}
          error={error}
          onFile={(f) => void take(f)}
        />
      </div>
    );
  }

  const allLooks = [...ownLooks, ...BUILT_IN];

  return (
    <div className="grade">
      {/* ---------------- the image ---------------- */}
      <section
        className="grade__stage"
        aria-label={my ? "ဓာတ်ပုံ" : "Photograph"}
      >
        <AiTabs way={way} onWay={setWay} my={my} />
        {way === "ai" ? (
          results ? (
            <Results urls={results.urls} chosen={0} onChoose={() => {}} my={my} before={origUrl} aspect={aspect} />
          ) : (
            <div className="grade__frame" style={{ "--ar": aspect } as React.CSSProperties}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="ai__photo" src={origUrl ?? ""} alt={my ? "မူရင်း ဓာတ်ပုံ" : "The photograph"} />
            </div>
          )
        ) : (
        <>
        {/* width follows the height budget, so the frame is always the
            photograph's own shape and the handle maps onto real pixels */}
        <div
          className="grade__frame"
          style={{ "--ar": aspect } as React.CSSProperties}
        >
          <Reveal
            key={origUrl}
            src={origUrl ?? ""}
            alt={my ? "အရောင်ညှိမှု အဆင့်လိုက်" : "Grade, stage by stage"}
            layers={layers}
            my={my}
            fit="contain"
            aspect={aspect}
            initial={0.92}
            className="grade__reveal"
          />
        </div>
        <Histogram data={hist} my={my} />
        </>
        )}
      </section>

      {/* ---------------- controls ---------------- */}
      <section
        className="grade__panel"
        aria-label={my ? "ထိန်းချုပ်မှု" : "Controls"}
      >
        {way === "ai" ? (
          <>
            {phone ? <PromptBox out={aiOut} my={my} /> : null}
            <Choices groups={AI_GRADE} selection={aiSel} onToggle={(g, o) => setAiSel(toggle(AI_GRADE, aiSel, g, o))} my={my} />
            {phone ? null : (
              <div className="inset-dock">
                <PromptDock out={aiOut} my={my} />
              </div>
            )}
            <MaybeBar phone={phone}>
            <Generate
              my={my}
              section="grade"
              out={aiOut}
              aspect={ar}
              image={file}
              strength={0.3}
              label="Grade with AI"
              labelMy="AI နဲ့ အရောင်ညှိမည်"
              onResults={(blobs, seed) => {
                results?.urls.forEach((u) => URL.revokeObjectURL(u));
                setResults({ blobs, seed, urls: blobs.map((b) => URL.createObjectURL(b)) });
                if (phone) window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
            </MaybeBar>
            <div className="grade__row">
              {results ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const b = results.blobs[0];
                    download(b, `${(file?.name ?? "photo").replace(/\.[^.]+$/, "")}-graded-${results.seed}.jpg`);
                    void keep(b, "grade", `seed ${results.seed}`);
                  }}
                >
                  {my ? "သိမ်းမည်" : "Save"}
                </button>
              ) : null}
              <button type="button" className="btn btn--quiet" onClick={() => replaceInput.current?.click()}>
                {my ? "တခြားပုံ" : "Another photo"}
              </button>
            </div>
          </>
        ) : (
        <>
        <div
          className="grade__looks"
          role="group"
          aria-label={my ? "Look များ" : "Looks"}
        >
          {allLooks.map((l) => (
            <span key={l.id} className="look">
              <button
                type="button"
                className={`chip ${my ? "my" : ""}`}
                aria-pressed={lookId === l.id}
                onClick={() => apply(l)}
              >
                {my ? l.nameMy : l.name}
              </button>
              {l.own ? (
                <button
                  type="button"
                  className="look__x"
                  aria-label={my ? `${l.name} ကို ဖျက်မည်` : `Remove ${l.name}`}
                  onClick={() => removeLook(l.id)}
                >
                  ×
                </button>
              ) : null}
            </span>
          ))}
        </div>

        <section className="grp">
          <header className="grp__head">
            <h2 className={my ? "my grp__title" : "t-micro grp__title"}>
              {my ? "အလင်းအမှောင်" : "Tone"}
            </h2>
          </header>
          {TONE.map((d) => (
            <Dial
              key={d.key}
              d={d}
              my={my}
              value={settings[d.key]}
              onChange={(v) => set(d.key, v)}
            />
          ))}
        </section>

        <section className="grp">
          <header className="grp__head">
            <h2 className={my ? "my grp__title" : "t-micro grp__title"}>
              {my ? "အရောင်" : "Colour"}
            </h2>
          </header>
          {COLOUR.map((d) => (
            <Dial
              key={d.key}
              d={d}
              my={my}
              value={settings[d.key]}
              onChange={(v) => set(d.key, v)}
            />
          ))}
        </section>

        <section className="grp">
          <header className="grp__head">
            <h2 className={my ? "my grp__title" : "t-micro grp__title"}>
              Curves
            </h2>
          </header>
          <Curves
            curves={settings.curves}
            onChange={setCurve}
            backdrop={hist?.l ?? null}
            my={my}
          />
        </section>

        {/* ---------------- leave ---------------- */}
        <div className="grade__acts">
          {notice ? (
            <p
              className={`grade__notice ${my ? "my" : "t-small"}`}
              role="status"
            >
              {notice}
            </p>
          ) : null}

          {naming ? (
            <form
              className="dock__name"
              onSubmit={(e) => {
                e.preventDefault();
                saveLook(lookName, settings);
                setLookName("");
                setNaming(false);
              }}
            >
              <input
                className={`field ${my ? "my" : ""}`}
                autoFocus
                value={lookName}
                placeholder={my ? "Look နာမည်" : "Name the look"}
                onChange={(e) => setLookName(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setNaming(false)}
              />
              <button type="submit" className="btn btn--quiet">
                {my ? "သိမ်း" : "Save"}
              </button>
            </form>
          ) : null}

          <div className="grade__row">
            <button
              type="button"
              className="btn"
              onClick={exportJpg}
              disabled={exporting}
            >
              {exporting
                ? my
                  ? "ထုတ်နေသည်…"
                  : "Exporting…"
                : my
                  ? "JPG ထုတ်မည်"
                  : "Export JPG"}
            </button>
            <button
              type="button"
              className="btn btn--quiet"
              onClick={exportCube}
              disabled={isNeutral(settings)}
            >
              .cube
            </button>
          </div>
          <div className="grade__row grade__row--quiet">
            <button
              type="button"
              className="lib__act"
              disabled={isNeutral(settings)}
              onClick={() => setNaming(true)}
            >
              {my ? "Look သိမ်းမည်" : "Save look"}
            </button>
            <button
              type="button"
              className="lib__act"
              disabled={isNeutral(settings)}
              onClick={() => {
                setSettings(NEUTRAL);
                setLookId(null);
              }}
            >
              {my ? "အားလုံး ပြန်ထား" : "Reset all"}
            </button>
            <button
              type="button"
              className="lib__act"
              onClick={() => replaceInput.current?.click()}
            >
              {my ? "တခြားပုံ" : "Another photo"}
            </button>
          </div>
        </div>
        </>
        )}
        <input
          ref={replaceInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void take(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </section>
    </div>
  );
}
