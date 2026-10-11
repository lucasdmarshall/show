"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { repair, RESTORE_DEFAULT, type RestoreSettings, type Tone } from "@/lib/restore";
import { canvasOf, download, imageBlob, readImage, stem, toBlob } from "@/lib/image";
import { compileRoom, opt, toggle } from "@/lib/rooms";
import type { Group } from "@/lib/catalogue";
import type { Selection } from "@/lib/compile";
import { keep } from "@/lib/vault";
import { Reveal, type RevealLayer } from "./Reveal";
import { DropZone } from "./DropZone";
import { Amount, Choices, Grp } from "./Choices";
import { PromptDock } from "./PromptDock";
import { Generate, Results } from "./Generate";
import { AiTabs, type Way } from "./AiTabs";
import "./grade.css";
import "./restore.css";

const PREVIEW = 1400;

/* What the model does — the main way to restore. */
const BEYOND: Group[] = [
  {
    id: "beyond",
    label: "What to restore",
    labelMy: "ဘာတွေ ပြန်ကောင်းအောင် လုပ်မလဲ",
    order: 0,
    multi: true,
    options: [
      opt("repair", "Repair damage", "ပျက်စီးတာ ပြင်", "every scratch, crease, stain, dust speck and patch of fading removed, the original tones recovered"),
      opt("colour", "Colourise", "အရောင်ထည့်", "naturally colourised, true-to-era colour, realistic skin tones, subtle film-dye palette, no oversaturation"),
      opt("faces", "Bring back faces", "မျက်နှာ ပြန်ကြည်", "restored facial detail, clear eyes, natural skin texture, no beautification, identical likeness"),
      opt("rebuild", "Rebuild tears", "စုတ်ပြဲတာ ပြန်ဖြည့်", "torn, creased and missing areas rebuilt to match the surrounding print seamlessly"),
      opt("move", "Living Memory", "ရွေ့လာစေ", "the photograph gently comes to life, subtle natural motion, camera perfectly still, 5-second seamless loop", { mm: true }),
    ],
  },
  {
    id: "era",
    label: "When it was taken",
    labelMy: "ရိုက်ခဲ့တဲ့ ခေတ်",
    order: 1,
    options: [
      opt("1930", "1930s–40s", "၁၉၃၀–၄၀", "1930s–40s Burmese studio portrait, hand-tinted colour sensibility, colonial-era wardrobe", { mm: true }),
      opt("1950", "1950s–60s", "၁၉၅၀–၆၀", "1950s–60s Rangoon, early colour film palette, post-independence fashion", { mm: true }),
      opt("1970", "1970s–80s", "၁၉၇၀–၈၀", "1970s–80s Burma, faded Orwo and Fuji colour print palette", { mm: true }),
      opt("1990", "1990s", "၁၉၉၀ ပြည့်", "1990s Myanmar, consumer colour negative film, warm lab print", { mm: true }),
    ],
  },
  {
    id: "wear",
    label: "Wardrobe colour",
    labelMy: "ဝတ်စုံအရောင်",
    order: 2,
    multi: true,
    options: [
      opt("maroon", "Maroon longyi", "နီညိုရောင် လုံချည်", "maroon silk longyi", { mm: true }),
      opt("emerald", "Emerald htamein", "မြစိမ်း ထဘီ", "deep emerald green htamein wrap skirt", { mm: true }),
      opt("indigo", "Indigo check", "အပြာကွက်", "indigo and white checked cotton longyi", { mm: true }),
      opt("white-ein", "White eingyi", "အဖြူ အင်္ကျီ", "crisp white cotton eingyi blouse", { mm: true }),
      opt("cream", "Cream jacket", "ခရမ်ချဉ်ဖျော့ တိုက်ပုံ", "cream taikpon jacket", { mm: true }),
      opt("pink", "Pale pink", "ပန်းနုရောင်", "pale rose-pink blouse"),
      opt("gold", "Gold thread", "ရွှေချည်", "fine gold-thread embroidery catching the light"),
    ],
  },
  {
    id: "motion",
    label: "How it moves",
    labelMy: "ဘယ်လို ရွေ့မလဲ",
    order: 3,
    multi: true,
    options: [
      opt("blink", "A blink", "မျက်တောင်ခတ်", "a single slow natural blink"),
      opt("smile", "A small smile", "ပြုံးလာ", "the faintest smile forming"),
      opt("turn", "A head turn", "ခေါင်းလှည့်", "the head turning a few degrees towards camera"),
      opt("breeze", "Hair in a breeze", "လေတိုက်", "a light breeze moving loose hair and fabric"),
      opt("breath", "Breathing", "အသက်ရှူ", "slow visible breathing in the shoulders"),
    ],
  },
];

const TONES: { id: Tone; en: string; my: string }[] = [
  { id: "as-is", en: "As printed", my: "မူရင်းအတိုင်း" },
  { id: "mono", en: "Black & white", my: "အဖြူအမည်း" },
  { id: "sepia", en: "Sepia", my: "Sepia" },
];

type Stages = { marks: string; clean: string; final: string };

export function Restore({ my }: { my: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [origUrl, setOrigUrl] = useState<string | null>(null);
  const [src, setSrc] = useState<ImageData | null>(null);
  const [aspect, setAspect] = useState(1.3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [s, setS] = useState<RestoreSettings>(RESTORE_DEFAULT);
  const [stages, setStages] = useState<Stages | null>(null);
  const [info, setInfo] = useState<{ touched: number; mono: boolean; ms: number } | null>(null);
  const [working, setWorking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  /* the model restores by default; this device is the free second way */
  const [way, setWay] = useState<Way>("ai");
  const [sel, setSel] = useState<Selection>({ beyond: ["repair", "faces"], era: [], wear: [], motion: [] });
  const [results, setResults] = useState<{ urls: string[]; blobs: Blob[]; seed: number } | null>(null);
  const [chosen, setChosen] = useState(0);

  const gen = useRef(0);
  const prev = useRef<Stages | null>(null);
  const replace = useRef<HTMLInputElement>(null);

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
        const { data, fullW, fullH } = await readImage(f, PREVIEW);
        setAspect(fullW / fullH);
        setOrigUrl((p) => {
          if (p) URL.revokeObjectURL(p);
          return URL.createObjectURL(f);
        });
        setFile(f);
        setSrc(data);
        setResults(null);
      } catch {
        setError(my ? "ဒီပုံကို ဖတ်လို့ မရပါ။" : "That image could not be read.");
      } finally {
        setBusy(false);
      }
    },
    [my],
  );

  /* -- repair on this device, debounced; newest wins; only when it is the way in use */
  useEffect(() => {
    if (!src || way !== "device") return;
    const g = ++gen.current;
    const timer = window.setTimeout(async () => {
      setWorking(true);
      await new Promise((r) => setTimeout(r, 16));
      const t0 = performance.now();
      const r = repair(src.data, src.width, src.height, s);
      const ms = performance.now() - t0;
      if (g !== gen.current) return;

      /* the repairs, drawn in gold over the scan — the proof */
      const marks = src.data.slice();
      for (let p = 0; p < r.mask.length; p++) {
        if (!r.mask[p]) continue;
        const o = p * 4;
        marks[o] = 240;
        marks[o + 1] = 190;
        marks[o + 2] = 60;
      }
      const w = src.width;
      const h = src.height;
      const [a, b, c] = await Promise.all([
        imageBlob(new ImageData(marks, w, h), "image/jpeg", 0.9),
        imageBlob(new ImageData(r.clean as Uint8ClampedArray<ArrayBuffer>, w, h), "image/jpeg", 0.9),
        imageBlob(new ImageData(r.final as Uint8ClampedArray<ArrayBuffer>, w, h), "image/jpeg", 0.92),
      ]);
      if (g !== gen.current) return;
      const next = { marks: URL.createObjectURL(a), clean: URL.createObjectURL(b), final: URL.createObjectURL(c) };
      const old = prev.current;
      prev.current = next;
      setStages(next);
      setInfo({ touched: r.touched, mono: r.mono, ms });
      setWorking(false);
      if (old) window.setTimeout(() => Object.values(old).forEach((u) => URL.revokeObjectURL(u)), 400);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [src, s, way]);

  useEffect(
    () => () => {
      if (prev.current) Object.values(prev.current).forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  const layers: RevealLayer[] = useMemo(() => {
    const o = origUrl ?? "";
    return [
      { id: "orig", label: "As scanned", labelMy: "မူရင်း", src: o },
      { id: "marks", label: "What was repaired", labelMy: "ပြင်လိုက်တဲ့နေရာ", src: stages?.marks ?? o },
      { id: "clean", label: "Cleaned", labelMy: "သန့်ပြီး", src: stages?.clean ?? o },
      { id: "final", label: "Restored", labelMy: "ပြန်ကောင်းပြီ", src: stages?.final ?? o },
    ];
  }, [origUrl, stages]);

  /* -- premium: the prompt ---------------------------------------- */
  const beyond = sel.beyond ?? [];
  const groups = BEYOND.filter(
    (g) =>
      g.id === "beyond" ||
      (g.id === "era" && beyond.length > 0) ||
      (g.id === "wear" && beyond.includes("colour")) ||
      (g.id === "motion" && beyond.includes("move")),
  );
  const moving = beyond.includes("move");
  const strength = beyond.includes("rebuild") ? 0.55 : beyond.includes("colour") ? 0.38 : 0.3;
  const ar = aspect >= 1 ? (aspect > 1.6 ? "16:9" : "3:2") : aspect < 0.7 ? "2:3" : "4:5";
  const out = useMemo(
    () =>
      compileRoom(groups, sel, ar, {
        lead: [info?.mono && !beyond.includes("colour") ? "restored vintage black and white photograph" : "restored vintage photograph"],
        negatives: ["modern clothing", "plastic skin", "beautified face", "changed identity"],
        edit: { strength, keep: ["the face", "the expression", "the pose", "the composition"] },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sel, ar, info?.mono, strength],
  );

  /* -- export ----------------------------------------------------- */
  const exportFull = async () => {
    if (!file || !src) return;
    setExporting(true);
    setNotice(null);
    await new Promise((r) => setTimeout(r, 30));
    try {
      const { data } = await readImage(file, 0);
      const scale = data.width / src.width;
      const r = repair(data.data, data.width, data.height, s, scale);
      const c = canvasOf(new ImageData(r.final as Uint8ClampedArray<ArrayBuffer>, data.width, data.height));
      const blob = await toBlob(c, "image/jpeg", 0.95);
      download(blob, `${stem(file.name)}-restored.jpg`);
      void keep(blob, "restore", stem(file.name));
      setNotice(
        my
          ? `${data.width}×${data.height} နဲ့ ထုတ်ပြီး — Work ထဲမှာ သိမ်းထား`
          : `Exported at ${data.width}×${data.height} — kept in Work`,
      );
    } catch {
      setNotice(my ? "ထုတ်လို့ မရပါ" : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const takeResults = (blobs: Blob[], seed: number) => {
    results?.urls.forEach((u) => URL.revokeObjectURL(u));
    setResults({ blobs, seed, urls: blobs.map((b) => URL.createObjectURL(b)) });
    setChosen(0);
  };

  if (!src) {
    return (
      <div className="grade grade--empty">
        <DropZone
          my={my}
          title="Bring an old photograph back"
          titleMy="ဓာတ်ပုံဟောင်း ပြန်ကောင်းအောင်"
          sub="AI repairs the scratches, tears and fading, brings the faces back and can add colour or motion — keeping the likeness. A free repair on this device is there too."
          subMy="AI က ခြစ်ရာ၊ စုတ်ပြဲ၊ မှေးမှိန်မှုကို ပြင်ပြီး မျက်နှာတွေ ပြန်ကြည်လာအောင် လုပ်မယ် — အရောင်ထည့်တာ၊ ရွေ့လာအောင် လုပ်တာလည်း ရတယ်၊ မျက်နှာက မူရင်းအတိုင်း။ ဒီစက်ပေါ်မှာ အခမဲ့ ပြင်တာလည်း ရှိတယ်။"
          busy={busy}
          error={error}
          onFile={(f) => void take(f)}
        />
      </div>
    );
  }

  const pct = info ? (info.touched / (src.width * src.height)) * 100 : 0;

  const another = (
    <>
      <button type="button" className="btn btn--quiet" onClick={() => replace.current?.click()}>
        {my ? "တခြားပုံ" : "Another"}
      </button>
      <input
        ref={replace}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void take(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );

  return (
    <div className="grade restore">
      <section className="grade__stage" aria-label={my ? "ဓာတ်ပုံ" : "Photograph"}>
        <AiTabs way={way} onWay={setWay} my={my} />

        {way === "ai" ? (
          results ? (
            /* the restoration, against the scan it came from */
            <Results urls={results.urls} chosen={chosen} onChoose={setChosen} my={my} video={moving} before={origUrl} aspect={aspect} />
          ) : (
            <div className="grade__frame" style={{ "--ar": aspect } as React.CSSProperties}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="restore__scan" src={origUrl ?? ""} alt={my ? "မူရင်း ဓာတ်ပုံ" : "The photograph as scanned"} />
            </div>
          )
        ) : (
          <>
            <div className="grade__frame" style={{ "--ar": aspect } as React.CSSProperties}>
              <Reveal
                key={origUrl}
                src={origUrl ?? ""}
                alt={my ? "ပြုပြင်မှု အဆင့်လိုက်" : "The repair, stage by stage"}
                layers={layers}
                my={my}
                fit="contain"
                aspect={aspect}
                initial={0.9}
                className="grade__reveal"
              />
            </div>
            <p className={`restore__proof ${my ? "my" : "t-small"}`} data-working={working || undefined}>
              {working
                ? my
                  ? "ပြင်နေသည်…"
                  : "Repairing…"
                : info
                  ? my
                    ? `ပျက်စီးတဲ့ pixel ${info.touched.toLocaleString()} ခု (${pct.toFixed(2)}%) ကိုပဲ ပြန်ဖြည့်ထား — ကျန်တာ မူရင်းအတိုင်း`
                    : `${info.touched.toLocaleString()} damaged pixels repainted (${pct.toFixed(2)}%) — every other pixel is as scanned`
                  : ""}
            </p>
          </>
        )}
      </section>

      <section className="grade__panel" aria-label={my ? "ထိန်းချုပ်မှု" : "Controls"}>
        {way === "ai" ? (
          <>
            <Choices groups={groups} selection={sel} onToggle={(g, o) => setSel(toggle(BEYOND, sel, g, o))} my={my} />
            <div className="inset-dock">
              <PromptDock out={out} my={my} />
            </div>
            <Generate
              my={my}
              section="restore"
              out={out}
              aspect={ar}
              image={file}
              strength={strength}
              label={moving ? "Make it move" : "Restore with AI"}
              labelMy={moving ? "ရွေ့လာအောင် လုပ်မည်" : "AI နဲ့ ပြန်ကောင်းအောင် လုပ်မည်"}
              onResults={takeResults}
            />
            <div className="grade__row">
              {results ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const b = results.blobs[chosen];
                    const ext = b.type.includes("video") ? "mp4" : "jpg";
                    download(b, `${stem(file?.name)}-${moving ? "living" : "restored"}-${results.seed}.${ext}`);
                    if (!b.type.includes("video")) void keep(b, "restore", stem(file?.name));
                  }}
                >
                  {my ? "သိမ်းမည်" : "Save"}
                </button>
              ) : null}
              {another}
            </div>
          </>
        ) : (
          <>
            <Grp title="Repair · on this device" titleMy="ပြင်ဆင် · ဒီစက်ပေါ်မှာ" my={my} aside={info ? `${Math.round(info.ms)} ms` : undefined}>
              <Amount label="Dust & specks" labelMy="ဖုန်မှုန့်" value={s.dust} onChange={(v) => setS({ ...s, dust: v })} my={my} />
              <Amount label="Scratches" labelMy="ခြစ်ရာ" value={s.scratches} onChange={(v) => setS({ ...s, scratches: v })} my={my} />
              <Amount label="Fading & cast" labelMy="မှေးမှိန်မှု" value={s.fade} onChange={(v) => setS({ ...s, fade: v })} my={my} />
              <Amount label="Sharpen" labelMy="ပြတ်သား" value={s.sharpen} onChange={(v) => setS({ ...s, sharpen: v })} my={my} />
            </Grp>

            <Grp title="Tone" titleMy="အရောင်အသွေး" my={my} aside={info ? (info.mono ? (my ? "အဖြူအမည်း ပုံ" : "monochrome print") : my ? "ရောင်စုံ ပုံ" : "colour print") : undefined}>
              <div className="grp__opts">
                {TONES.map((t) => (
                  <button key={t.id} type="button" className="chip" aria-pressed={s.tone === t.id} onClick={() => setS({ ...s, tone: t.id })}>
                    <span className={my ? "my" : undefined}>{my ? t.my : t.en}</span>
                  </button>
                ))}
              </div>
            </Grp>

            <div className="grade__acts restore__acts">
              {notice ? (
                <p className={`grade__notice ${my ? "my" : "t-small"}`} role="status">
                  {notice}
                </p>
              ) : null}
              <div className="grade__row">
                <button type="button" className="btn" onClick={exportFull} disabled={exporting || working}>
                  {exporting ? (my ? "ထုတ်နေသည်…" : "Restoring at full size…") : my ? "JPG ထုတ်မည်" : "Export JPG"}
                </button>
                {another}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
