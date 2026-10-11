"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  harmonize,
  HARMONY_NEUTRAL,
  HMODES,
  keyBackdrop,
  transparency,
  variants,
  type Harmony,
  type Place,
} from "@/lib/composite";
import { canvas, ctx2d, download, imageBlob, readImage, stem, toBlob } from "@/lib/image";
import { estimateTokens, type Compiled } from "@/lib/compile";
import { PERSON_KEEPS, TOGETHER_NEGATIVE, togetherPrompt } from "@/lib/together";
import { keep } from "@/lib/vault";
import { Reveal, type RevealLayer } from "./Reveal";
import { Amount, Grp } from "./Choices";
import { PromptDock } from "./PromptDock";
import { useIsPhone } from "@/lib/useIsPhone";
import { MaybeBar, PromptBox } from "./PromptBox";

import { Generate, Results } from "./Generate";
import "./grade.css";
import "./harmonize.css";

const PREVIEW = 1400;
const THUMB = 420;

type Subject = {
  file: File;
  /** cropped to its own outline, with alpha */
  cut: HTMLCanvasElement;
  /** it came with no transparency, so the backdrop was keyed out */
  keyed: boolean;
};

/* Decode the subject, key a plain backdrop if it has no alpha, and crop
   to the outline so "the feet" means the bottom of the person. */
async function prepareSubject(file: File, max: number, tolerance: number): Promise<Subject> {
  const { data } = await readImage(file, max);
  const w = data.width;
  const h = data.height;
  const keyed = transparency(data.data) < 0.02;
  if (keyed) {
    const a = keyBackdrop(data.data, w, h, tolerance);
    for (let p = 0; p < w * h; p++) data.data[p * 4 + 3] = a[p];
  }
  let x0 = w;
  let x1 = 0;
  let y0 = h;
  let y1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data.data[(y * w + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 <= x0 || y1 <= y0) {
    x0 = 0;
    y0 = 0;
    x1 = w - 1;
    y1 = h - 1;
  }
  const full = canvas(w, h);
  ctx2d(full).putImageData(data, 0, 0);
  const cut = canvas(x1 - x0 + 1, y1 - y0 + 1);
  ctx2d(cut).drawImage(full, -x0, -y0);
  return { file, cut, keyed };
}

/** The subject drawn onto a scene-sized transparent layer. */
function placeLayer(cut: HTMLCanvasElement, w: number, h: number, p: Place): Uint8ClampedArray {
  const c = canvas(w, h);
  const x = ctx2d(c);
  const dh = p.h * h;
  const dw = dh * (cut.width / cut.height);
  x.imageSmoothingQuality = "high";
  x.drawImage(cut, p.x * w - dw / 2, p.y * h - dh, dw, dh);
  return x.getImageData(0, 0, w, h).data;
}

function Slot({
  label,
  labelMy,
  hint,
  hintMy,
  url,
  my,
  onFile,
}: {
  label: string;
  labelMy: string;
  hint: string;
  hintMy: string;
  url: string | null;
  my: boolean;
  onFile: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <button
      type="button"
      className="slot"
      data-over={over || undefined}
      data-filled={url ? true : undefined}
      onClick={() => ref.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f?.type.startsWith("image/")) onFile(f);
      }}
    >
      {url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={url} alt="" />
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      )}
      <span className="slot__text">
        <span className={my ? "my" : "t-micro"}>{my ? labelMy : label}</span>
        <span className={`slot__hint ${my ? "my" : "t-small"}`}>{my ? hintMy : hint}</span>
      </span>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </button>
  );
}

const DIALS: { key: keyof Harmony; en: string; my: string }[] = [
  { key: "match", en: "Colour match", my: "အရောင်ညှိ" },
  { key: "wrap", en: "Light wrap", my: "အလင်းဝိုင်း" },
  { key: "edge", en: "Soft edge", my: "အနားနူး" },
  { key: "shadow", en: "Ground shadow", my: "မြေပြင်အရိပ်" },
  { key: "rim", en: "Rim light", my: "အနားအလင်း" },
  { key: "fog", en: "Fog & haze", my: "မြူ" },
  { key: "rays", en: "Light rays", my: "နေရောင်ခြည်" },
  { key: "foreground", en: "Foreground blur", my: "ရှေ့ဝါး" },
  { key: "grain", en: "Grain", my: "Grain" },
];

export function Harmonize({ my }: { my: boolean }) {
  const [sceneFile, setSceneFile] = useState<File | null>(null);
  const [sceneUrl, setSceneUrl] = useState<string | null>(null);
  const [scene, setScene] = useState<ImageData | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [subjectUrl, setSubjectUrl] = useState<string | null>(null);
  const [tolerance, setTolerance] = useState(0.35);

  const [place, setPlace] = useState<Place>({ x: 0.5, y: 0.96, h: 0.72 });
  const [placing, setPlacing] = useState(false);
  const [modeId, setModeId] = useState("natural");
  const [s, setS] = useState<Harmony>({ ...HARMONY_NEUTRAL, ...HMODES[0].set });
  const [reunion, setReunion] = useState(false);
  /* the model does the work; this device is the free second way */
  const [tab, setTab] = useState<"ai" | "device">("ai");
  /* AI: let the model choose where they stand, or follow a hand placement */
  const [hand, setHand] = useState(false);
  const [keepP, setKeepP] = useState<string[]>(["outfit"]);
  const [extra, setExtra] = useState("");

  const [stages, setStages] = useState<{ raw: string; out: string } | null>(null);
  const [outBlob, setOutBlob] = useState<Blob | null>(null);
  const [side, setSide] = useState(0);
  const [four, setFour] = useState<{ urls: string[]; sets: Harmony[] } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [results, setResults] = useState<{ urls: string[]; blobs: Blob[]; seed: number } | null>(null);
  const [chosen, setChosen] = useState(0);

  const gen = useRef(0);
  const prev = useRef<{ raw: string; out: string } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const phone = useIsPhone();

  const takeScene = useCallback(async (f: File) => {
    const { data } = await readImage(f, PREVIEW);
    setResults(null);
    setSceneFile(f);
    setScene(data);
    setSceneUrl((p) => {
      if (p) URL.revokeObjectURL(p);
      return URL.createObjectURL(f);
    });
  }, []);

  const takeSubject = useCallback(
    async (f: File) => {
      setSubject(await prepareSubject(f, PREVIEW, tolerance));
      setResults(null);
      setSubjectUrl((p) => {
        if (p) URL.revokeObjectURL(p);
        return URL.createObjectURL(f);
      });
    },
    [tolerance],
  );

  /* re-key when the tolerance moves */
  useEffect(() => {
    if (!subject?.keyed) return;
    const t = window.setTimeout(async () => setSubject(await prepareSubject(subject.file, PREVIEW, tolerance)), 160);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tolerance]);

  /* -- render, debounced ------------------------------------------ */
  useEffect(() => {
    if (!scene || !subject) return;
    const g = ++gen.current;
    const t = window.setTimeout(async () => {
      const { width: w, height: h } = scene;
      const fg = placeLayer(subject.cut, w, h, place);
      const r = harmonize({ bg: scene.data, fg, w, h }, s);
      const [a, b] = await Promise.all([
        imageBlob(new ImageData(r.raw as Uint8ClampedArray<ArrayBuffer>, w, h), "image/jpeg", 0.9),
        imageBlob(new ImageData(r.out as Uint8ClampedArray<ArrayBuffer>, w, h), "image/jpeg", 0.92),
      ]);
      if (g !== gen.current) return;
      const next = { raw: URL.createObjectURL(a), out: URL.createObjectURL(b) };
      const old = prev.current;
      prev.current = next;
      setStages(next);
      setOutBlob(b);
      setSide(r.side);
      if (old) window.setTimeout(() => Object.values(old).forEach((u) => URL.revokeObjectURL(u)), 400);
    }, placing || hand ? 30 : 110);
    return () => window.clearTimeout(t);
  }, [scene, subject, place, s, placing, hand]);

  useEffect(
    () => () => {
      if (prev.current) Object.values(prev.current).forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  const aspect = scene ? scene.width / scene.height : 1.5;

  const layers: RevealLayer[] = useMemo(
    () => [
      { id: "raw", label: "Pasted", labelMy: "ကပ်ထားရုံ", src: stages?.raw ?? sceneUrl ?? "" },
      { id: "out", label: "Harmonized", labelMy: "ညှိပြီး", src: stages?.out ?? sceneUrl ?? "" },
    ],
    [stages, sceneUrl],
  );

  const setMode = (id: string) => {
    const m = HMODES.find((x) => x.id === id)!;
    setModeId(id);
    setS({ ...HARMONY_NEUTRAL, ...m.set, side: s.side });
    setFour(null);
  };

  /* -- four readings, small, to pick from ------------------------ */
  const showFour = async () => {
    if (!scene || !subject) return;
    const k = THUMB / Math.max(scene.width, scene.height);
    const w = Math.round(scene.width * k);
    const h = Math.round(scene.height * k);
    const small = canvas(w, h);
    const full = canvas(scene.width, scene.height);
    ctx2d(full).putImageData(scene, 0, 0);
    ctx2d(small).drawImage(full, 0, 0, w, h);
    const bg = ctx2d(small).getImageData(0, 0, w, h).data;
    const fg = placeLayer(subject.cut, w, h, place);
    const sets = variants(s);
    const urls: string[] = [];
    for (const v of sets) {
      const r = harmonize({ bg, fg, w, h }, v);
      urls.push(URL.createObjectURL(await imageBlob(new ImageData(r.out as Uint8ClampedArray<ArrayBuffer>, w, h), "image/jpeg", 0.85)));
    }
    four?.urls.forEach((u) => URL.revokeObjectURL(u));
    setFour({ urls, sets });
  };

  /* -- placing: drag on the stage, wheel or slider to scale ------- */
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    const r = stageRef.current!.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    drag.current = { dx: px - place.x, dy: py - place.y };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* a pointer that already ended cannot be captured */
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const stage = stageRef.current;
    if (!d || !stage) return;
    const r = stage.getBoundingClientRect();
    /* read the offset now: the updater runs later, after a release may
       already have cleared the drag */
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width - d.dx));
    const y = Math.max(0.1, Math.min(1.2, (e.clientY - r.top) / r.height - d.dy));
    setPlace((p) => ({ ...p, x, y }));
  };

  /* -- the model: scene + person, face from the person's own photograph */
  const mode = HMODES.find((m) => m.id === modeId)!;
  const ar = aspect > 1.6 ? "16:9" : aspect >= 1 ? "3:2" : aspect < 0.7 ? "2:3" : "4:5";
  const out: Compiled = useMemo(() => {
    const positive = togetherPrompt({ placed: hand, keep: keepP, look: mode.descriptor, side, reunion, extra });
    return { positive, negative: TOGETHER_NEGATIVE.join(", "), tokens: estimateTokens(positive), notes: [] };
  }, [hand, keepP, mode, side, reunion, extra]);
  /* image 1: the scene as shot, or the hand-placed paste; image 2: the person */
  const aiImage: Blob | null = hand ? outBlob : sceneFile;
  const aiBefore = hand ? (stages?.out ?? null) : sceneUrl;

  /* -- export at full size ---------------------------------------- */
  const exportFull = async () => {
    if (!sceneFile || !subject) return;
    setExporting(true);
    setNotice(null);
    await new Promise((r) => setTimeout(r, 30));
    try {
      const { data } = await readImage(sceneFile, 0);
      const cut = await prepareSubject(subject.file, Math.max(data.width, data.height), tolerance);
      const fg = placeLayer(cut.cut, data.width, data.height, place);
      const r = harmonize({ bg: data.data, fg, w: data.width, h: data.height }, s);
      const c = canvas(data.width, data.height);
      ctx2d(c).putImageData(new ImageData(r.out as Uint8ClampedArray<ArrayBuffer>, data.width, data.height), 0, 0);
      const blob = await toBlob(c, "image/jpeg", 0.95);
      download(blob, `${stem(sceneFile.name)}-harmonized.jpg`);
      void keep(blob, "harmonize", stem(sceneFile.name));
      setNotice(my ? `${data.width}×${data.height} နဲ့ ထုတ်ပြီး — Work ထဲမှာ သိမ်းထား` : `Exported at ${data.width}×${data.height} — kept in Work`);
    } catch {
      setNotice(my ? "ထုတ်လို့ မရပါ" : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  /* -- empty: two slots ------------------------------------------- */
  if (!scene || !subject) {
    return (
      <div className="harm harm--empty">
        <header className="harm__intro">
          <h2 className={my ? "my" : "t-h3"}>{my ? "လူတစ်ယောက်ကို တခြားပုံထဲ ထည့်မယ်" : "Put someone into another photograph"}</h2>
          <p className={my ? "my" : "t-small"}>
            {my
              ? "နောက်ခံပုံ (ပုံ ၁) နဲ့ ထည့်ချင်တဲ့လူ့ပုံ (ပုံ ၂) ပေးပါ။ AI က လူကို နောက်ခံထဲ ထည့်ပြီး အလင်း၊ အရောင်၊ အရိပ်ကို ကိုက်အောင် လုပ်ပေးမယ်။ မျက်နှာကို ပုံ ၂ ကနေပဲ ယူပြီး မပြောင်းအောင် ထိန်းခိုင်းထားတယ်။"
              : "A scene (image 1) and the person to put in it (image 2). The model places them, then matches light, colour and shadow — and is told to take the face only from image 2, unchanged."}
          </p>
        </header>
        <div className="harm__slots">
          <Slot
            label="Image 1 · Scene"
            labelMy="ပုံ ၁ · နောက်ခံ"
            hint="Where they should be"
            hintMy="ရောက်စေချင်တဲ့ နေရာ"
            url={sceneUrl}
            my={my}
            onFile={(f) => void takeScene(f)}
          />
          <Slot
            label="Image 2 · Person"
            labelMy="ပုံ ၂ · လူ"
            hint="Any clear photo of them — no cut-out needed"
            hintMy="မျက်နှာ ပီပီသသ ပါတဲ့ ပုံ ဘယ်ပုံမဆို — နောက်ခံ ဖြုတ်စရာ မလို"
            url={subjectUrl}
            my={my}
            onFile={(f) => void takeSubject(f)}
          />
        </div>
      </div>
    );
  }

  /* the hand placement stage — shared by both tabs */
  const placeStage = (
    <div
      ref={stageRef}
      className="harm__place"
      style={{ aspectRatio: aspect }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onWheel={(e) => setPlace((p) => ({ ...p, h: Math.max(0.1, Math.min(1.4, p.h * (e.deltaY < 0 ? 1.04 : 0.96))) }))}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={(tab === "ai" ? stages?.out : stages?.raw) ?? sceneUrl ?? ""} alt="" draggable={false} />
      <span className="harm__feet" style={{ left: `${place.x * 100}%`, top: `${place.y * 100}%` }} />
    </div>
  );
  const sizeSlider = (
    <div className="harm__size">
      <Amount
        label="Size"
        labelMy="အရွယ်"
        value={place.h}
        min={0.1}
        max={1.4}
        onChange={(v) => setPlace((p) => ({ ...p, h: v }))}
        my={my}
        format={(v) => `${Math.round(v * 100)}%`}
      />
    </div>
  );
  const changeButtons = (
    <div className="grade__row grade__row--quiet">
      <button
        type="button"
        className="lib__act"
        onClick={() => {
          setSubject(null);
          setSubjectUrl(null);
          setStages(null);
          setResults(null);
        }}
      >
        {my ? "လူ ပြောင်း" : "Change person"}
      </button>
      <button
        type="button"
        className="lib__act"
        onClick={() => {
          setScene(null);
          setSceneUrl(null);
          setStages(null);
          setResults(null);
        }}
      >
        {my ? "နောက်ခံ ပြောင်း" : "Change scene"}
      </button>
    </div>
  );

  return (
    <div className="grade harm">
      <section className="grade__stage" aria-label={my ? "ဓာတ်ပုံ" : "Photograph"}>
        <div className="seg harm__tabs" role="group" aria-label={my ? "ဘယ်လို ပေါင်းမလဲ" : "How to put them in"}>
          <button type="button" className={my ? "my" : undefined} aria-pressed={tab === "ai"} onClick={() => setTab("ai")}>
            ✦ {my ? "AI နဲ့" : "With AI"}
          </button>
          <button type="button" className={my ? "my" : undefined} aria-pressed={tab === "device"} onClick={() => setTab("device")}>
            {my ? "ဖုန်းပေါ်မှာ · အခမဲ့" : "On this device · free"}
          </button>
        </div>

        {tab === "ai" ? (
          results ? (
            /* the result, against what it was made from */
            <Results urls={results.urls} chosen={chosen} onChoose={setChosen} my={my} before={aiBefore} aspect={aspect} />
          ) : hand ? (
            <>
              <div className="grade__frame" style={{ "--ar": aspect } as React.CSSProperties}>
                {placeStage}
              </div>
              <div className="harm__placebar">
                <p className={`harm__side ${my ? "my" : "t-small"}`}>
                  {my ? "ဆွဲပြီး နေရာချ — AI က ဒီနေရာ၊ ဒီအရွယ်အတိုင်း ထားမယ်" : "Drag to place — the model keeps this position and size"}
                </p>
                {sizeSlider}
              </div>
            </>
          ) : (
            /* the pair the model will get, numbered as the prompt numbers them */
            <div className="harm__pair">
              <figure className="harm__pairscene" style={{ "--ar": aspect } as React.CSSProperties}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sceneUrl ?? ""} alt="" />
                <figcaption className="t-micro">{my ? "ပုံ ၁ · နောက်ခံ" : "Image 1 · scene"}</figcaption>
                <figure className="harm__pairperson">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={subjectUrl ?? ""} alt="" />
                  <figcaption className="t-micro">{my ? "ပုံ ၂ · လူ" : "Image 2 · person"}</figcaption>
                </figure>
              </figure>
            </div>
          )
        ) : (
          <>
            <div className="grade__frame" style={{ "--ar": aspect } as React.CSSProperties}>
              {placing ? (
                placeStage
              ) : (
                <Reveal
                  key={sceneUrl}
                  src={sceneUrl ?? ""}
                  alt={my ? "ကပ်ထားတာနဲ့ ညှိပြီးတာ" : "Pasted, and harmonized"}
                  layers={layers}
                  my={my}
                  fit="contain"
                  aspect={aspect}
                  initial={0.75}
                  className="grade__reveal"
                />
              )}
            </div>
            <div className="harm__placebar">
              <button type="button" className="chip" aria-pressed={placing} onClick={() => setPlacing((v) => !v)}>
                <span className={my ? "my" : undefined}>{placing ? (my ? "နေရာချပြီး" : "Done placing") : my ? "နေရာ ရွှေ့မည်" : "Move & size"}</span>
              </button>
              {placing ? (
                sizeSlider
              ) : (
                <p className={`harm__side ${my ? "my" : "t-small"}`}>
                  {my ? `အလင်း — ${side > 0 ? "ညာဘက်" : "ဘယ်ဘက်"}ကနေ` : `Light from the ${side > 0 ? "right" : "left"}`}
                  {s.side === 0 ? (my ? " (နောက်ခံကနေ ဖတ်ထား)" : " (read off the scene)") : ""}
                </p>
              )}
            </div>
            {four ? (
              <div className="harm__four" role="radiogroup" aria-label={my ? "ရွေးစရာ ၄ ခု" : "Four readings"}>
                {four.urls.map((u, i) => (
                  <button
                    key={u}
                    type="button"
                    role="radio"
                    aria-checked={JSON.stringify(four.sets[i]) === JSON.stringify(s)}
                    className="gen__result"
                    onClick={() => setS(four.sets[i])}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt={`${i + 1}`} />
                  </button>
                ))}
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="grade__panel" aria-label={my ? "ထိန်းချုပ်မှု" : "Controls"}>
        {tab === "ai" ? (
          <>
            {phone ? <PromptBox out={out} my={my} /> : null}
            <Grp title="Where they stand" titleMy="ဘယ်နေရာ ထားမလဲ" my={my}>
              <div className="grp__opts">
                <button type="button" className="chip" aria-pressed={!hand} onClick={() => setHand(false)}>
                  <span className={my ? "my" : undefined}>{my ? "AI ရွေးပါစေ" : "Let the model choose"}</span>
                </button>
                <button type="button" className="chip" aria-pressed={hand} onClick={() => setHand(true)}>
                  <span className={my ? "my" : undefined}>{my ? "ကိုယ်တိုင် နေရာချမယ်" : "Where I put them"}</span>
                </button>
              </div>
              {hand && subject.keyed ? (
                <p className={`harm__note ${my ? "my" : "t-small"}`}>
                  {my
                    ? "နေရာပြဖို့ နောက်ခံကို အကြမ်း ဖြုတ်ထားတယ် — AI က ပုံ ၂ ကနေ လူကို အပြည့် ပြန်ယူမှာမို့ အနားမသပ်ရပ်လည်း ရတယ်။"
                    : "The backdrop is keyed out roughly, only to show the spot — the model takes the person whole from image 2."}
                </p>
              ) : null}
            </Grp>

            <Grp title="Keep from image 2" titleMy="ပုံ ၂ ကနေ မပြောင်းစေချင်တာ" my={my}>
              <div className="grp__opts">
                <button type="button" className="chip" aria-pressed={true} disabled title={my ? "အမြဲ ထိန်းထား" : "Always kept"}>
                  <span className={my ? "my" : undefined}>{my ? "မျက်နှာ 🔒" : "Face 🔒"}</span>
                </button>
                {PERSON_KEEPS.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    className="chip"
                    aria-pressed={keepP.includes(k.id)}
                    onClick={() => setKeepP((p) => (p.includes(k.id) ? p.filter((x) => x !== k.id) : [...p, k.id]))}
                  >
                    <span className={my ? "my" : undefined}>{my ? k.labelMy : k.label}</span>
                  </button>
                ))}
              </div>
            </Grp>

            <Grp title="Light & look" titleMy="အလင်းနဲ့ ပုံစံ" my={my}>
              <div className="grp__opts">
                {HMODES.map((m) => (
                  <button key={m.id} type="button" className={`chip ${my ? "my" : ""}`} aria-pressed={modeId === m.id} onClick={() => setMode(m.id)}>
                    {my ? m.labelMy : m.label}
                    {m.mm ? <span className="chip__mm">MM</span> : null}
                  </button>
                ))}
              </div>
            </Grp>

            <label className="batch__switch">
              <input type="checkbox" checked={reunion} onChange={(e) => setReunion(e.target.checked)} />
              <span className={my ? "my" : "t-small"}>
                {my ? "Family Reunion — မရှိတော့သူကို မိသားစုပုံထဲ ထည့်တာ" : "Family Reunion — someone added to a family photograph"}
              </span>
            </label>

            <textarea
              className={`field harm__extra ${my ? "my" : ""}`}
              rows={2}
              value={extra}
              placeholder={my ? "ထပ်ပြောချင်တာ (ဥပမာ — ဘယ်ဘက်က လူနဲ့ လက်ချင်းချိတ်ထားပါ)" : "Anything else (e.g. holding hands with the person on the left)"}
              onChange={(e) => setExtra(e.target.value)}
            />

            {phone ? null : (
              <div className="inset-dock">
                <PromptDock out={out} my={my} />
              </div>
            )}
            <MaybeBar phone={phone}>
            <Generate
              my={my}
              section="harmonize"
              out={out}
              aspect={ar}
              image={aiImage}
              refs={[subject.file]}
              label="Put them in"
              labelMy="ထည့်မည်"
              onResults={(blobs, seed) => {
                results?.urls.forEach((u) => URL.revokeObjectURL(u));
                setResults({ blobs, seed, urls: blobs.map((b) => URL.createObjectURL(b)) });
                setChosen(0);
                if (phone) window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
            </MaybeBar>
            {results ? (
              <div className="grade__row">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const b = results.blobs[chosen];
                    download(b, `${stem(sceneFile?.name ?? "harmonized")}-together-${results.seed}.jpg`);
                    void keep(b, "harmonize", `seed ${results.seed}`);
                  }}
                >
                  {my ? "ရွေးထားတာ သိမ်းမည်" : "Save the chosen one"}
                </button>
                <button type="button" className="btn btn--quiet" onClick={() => setResults(null)}>
                  {my ? "ပြန်ပြင်မည်" : "Back to setup"}
                </button>
              </div>
            ) : null}
            {changeButtons}
          </>
        ) : (
          <>
            <p className={`harm__note ${my ? "my" : "t-small"}`}>
              {my
                ? "ဒီစက်ပေါ်မှာပဲ ညှိတယ် — အခမဲ့၊ မူရင်း resolution အပြည့်၊ မျက်နှာ pixel ကို လုံးဝ မထိဘူး။ နောက်ခံဖြုတ်ထားတဲ့ PNG နဲ့ အကောင်းဆုံး။"
                : "Reconciled on this device — free, full resolution, and no pixel of the face is touched. Works best with a cut-out PNG."}
            </p>
            <div className="grade__looks" role="group" aria-label="Mode">
              {HMODES.map((m) => (
                <span key={m.id} className="look">
                  <button type="button" className={`chip ${my ? "my" : ""}`} aria-pressed={modeId === m.id} onClick={() => setMode(m.id)}>
                    {my ? m.labelMy : m.label}
                    {m.mm ? <span className="chip__mm">MM</span> : null}
                  </button>
                </span>
              ))}
            </div>

            <Grp title="Reconcile" titleMy="ညှိနှိုင်း" my={my}>
              {DIALS.map((d) => (
                <Amount
                  key={d.key}
                  label={d.en}
                  labelMy={d.my}
                  value={s[d.key]}
                  onChange={(v) => setS({ ...s, [d.key]: v })}
                  my={my}
                />
              ))}
            </Grp>

            <Grp title="Light comes from" titleMy="အလင်း လာရာဘက်" my={my}>
              <div className="grp__opts">
                {[
                  [0, "Read it off the scene", "နောက်ခံကနေ ဖတ်"],
                  [-1, "Left", "ဘယ်"],
                  [1, "Right", "ညာ"],
                ].map(([v, en, mm]) => (
                  <button key={String(v)} type="button" className="chip" aria-pressed={s.side === v} onClick={() => setS({ ...s, side: v as number })}>
                    <span className={my ? "my" : undefined}>{my ? mm : en}</span>
                  </button>
                ))}
              </div>
            </Grp>

            {subject.keyed ? (
              <Grp title="Backdrop removal" titleMy="နောက်ခံ ဖြုတ်ခြင်း" my={my}>
                <Amount label="Tolerance" labelMy="ခံနိုင်ရည်" value={tolerance} onChange={setTolerance} my={my} />
                <p className={`harm__note ${my ? "my" : "t-small"}`}>
                  {my
                    ? "ဒီပုံမှာ transparency မပါလို့ ဘေးအနားက အရောင်နဲ့တူတာတွေကို ဖြုတ်ထားတယ်။ ဆံပင်စတာ အသေးစိတ်အတွက် PNG cut-out က ပိုကောင်းတယ်။"
                    : "This subject had no transparency, so everything matching the border colour was keyed out. A proper cut-out PNG holds hair better."}
                </p>
              </Grp>
            ) : null}

            <div className="grade__acts restore__acts">
              {notice ? (
                <p className={`grade__notice ${my ? "my" : "t-small"}`} role="status">
                  {notice}
                </p>
              ) : null}
              <div className="grade__row">
                <button type="button" className="btn" onClick={exportFull} disabled={exporting}>
                  {exporting ? (my ? "ထုတ်နေသည်…" : "Exporting…") : my ? "JPG ထုတ်မည်" : "Export JPG"}
                </button>
                <button type="button" className="btn btn--quiet" onClick={() => void showFour()}>
                  {my ? "၄ မျိုး ကြည့်" : "Show 4"}
                </button>
              </div>
              {changeButtons}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
