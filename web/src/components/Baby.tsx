"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { analyze, type Analysis } from "@/lib/analyze";
import { BABY_CATS, THEMES } from "@/lib/baby";
import { compileRoom, opt, toggle } from "@/lib/rooms";
import type { Group } from "@/lib/catalogue";
import type { Selection } from "@/lib/compile";
import { keep } from "@/lib/vault";
import { Choices, Grp } from "./Choices";
import { Wall } from "./Wall";
import { PromptDock } from "./PromptDock";
import { Generate, Results } from "./Generate";
import "./reverse.css";
import "./room.css";

const GROUPS: Group[] = [
  {
    id: "who",
    label: "In the frame",
    labelMy: "ပုံထဲမှာ",
    order: 1,
    options: [
      opt("alone", "Baby alone", "ကလေးတစ်ယောက်တည်း", "the newborn alone in the frame"),
      opt("mother", "With mother", "အမေနဲ့", "held gently in the mother's arms, her hands and face kept exactly as photographed"),
      opt("father", "With father", "အဖေနဲ့", "cradled in the father's hands, his hands kept exactly as photographed"),
      opt("family", "Whole family", "မိသားစု", "the whole family close around the baby, every face kept exactly as photographed"),
    ],
  },
  {
    id: "mood",
    label: "Mood",
    labelMy: "ခံစားချက်",
    order: 2,
    options: [
      opt("serene", "Serene", "ငြိမ်သက်", "serene and quiet, the baby peacefully asleep"),
      opt("playful", "Playful", "ပျော်ရွှင်", "playful and bright, a cheerful set"),
      opt("dreamy", "Dreamy", "အိပ်မက်လို", "dreamy and soft, gentle haze and glow"),
      opt("fine-art", "Fine art", "Fine art", "fine-art newborn portrait, painterly restraint"),
    ],
  },
  {
    id: "light",
    label: "Light",
    labelMy: "အလင်း",
    order: 3,
    options: [
      opt("left", "Window left", "ဘယ်ဘက် ပြတင်း", "soft window light from camera left, gentle shadow on the right cheek"),
      opt("right", "Window right", "ညာဘက် ပြတင်း", "soft window light from camera right"),
      opt("top", "Soft top", "အပေါ်စီး", "large soft overhead light, even and shadowless"),
      opt("back", "Back glow", "နောက်ကနေ", "warm back light giving a glow around the hair and wrap"),
    ],
  },
  {
    id: "wrap",
    label: "Wrap",
    labelMy: "အနှီး",
    order: 4,
    options: [
      opt("keep", "Keep as shot", "မူရင်းအတိုင်း", "the baby's wrap kept exactly as photographed"),
      opt("theme", "Match the theme", "Theme နဲ့ ကိုက်", "a wrap in colours that belong to the set"),
    ],
  },
];

export function Baby({ my }: { my: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [reading, setReading] = useState<Analysis | null>(null);
  const [theme, setTheme] = useState("cloud");
  const [sel, setSel] = useState<Selection>({ who: ["alone"], mood: ["serene"], light: ["left"], wrap: ["keep"] });
  const [consent, setConsent] = useState(false);
  const [results, setResults] = useState<{ urls: string[]; blobs: Blob[]; seed: number } | null>(null);
  const [chosen, setChosen] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => results?.urls.forEach((u) => URL.revokeObjectURL(u)), [results]);

  const take = async (f: File | undefined) => {
    if (!f || !f.type.startsWith("image/")) return;
    setFile(f);
    setUrl((p) => {
      if (p) URL.revokeObjectURL(p);
      return URL.createObjectURL(f);
    });
    const a = await analyze(f);
    setReading(a);
    /* the measured light direction is the honest default */
    const dir = a.readings.find((r) => r.id === "direction")?.value ?? "";
    if (/left/.test(dir)) setSel((s) => ({ ...s, light: ["left"] }));
    else if (/right/.test(dir)) setSel((s) => ({ ...s, light: ["right"] }));
  };

  const th = THEMES.find((x) => x.id === theme)!;
  const ar = reading?.aspect ?? "4:5";
  const who = sel.who?.[0] ?? "alone";
  const keepList = [
    "the baby's face",
    ...(sel.wrap?.[0] === "keep" ? ["the wrap"] : []),
    ...(who !== "alone" ? ["everyone holding the baby", "their faces and hands"] : []),
  ];

  const out = useMemo(
    () =>
      compileRoom(GROUPS, sel, ar, {
        lead: [file ? "the same newborn, placed in a themed set" : "newborn photography session", th.descriptor],
        tail: ["safe natural pose, the baby comfortable and supported", "soft skin with natural texture"],
        negatives: ["unsafe pose", "extra fingers", "adult features", "plastic skin", "changed face"],
        edit: file ? { strength: 0.55, keep: keepList } : undefined,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sel, ar, file, th],
  );

  return (
    <div className="rev rev--read room">
      <section className="rev__panel">
        <div className="room__in">
          <button type="button" className="room__photo" onClick={() => input.current?.click()}>
            {url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={url} alt="" />
            ) : (
              <span className={my ? "my" : "t-small"}>{my ? "ကလေးပုံ ထည့်ပါ" : "Add the photograph"}</span>
            )}
          </button>
          <div className="room__read">
            <span className="t-micro">{my ? "မထိဘဲ ထားမယ့်အရာ" : "Left exactly as shot"}</span>
            {keepList.map((k) => (
              <span key={k} className="t-small">
                {k}
              </span>
            ))}
            {!file ? (
              <span className={`room__hint ${my ? "my" : "t-small"}`}>
                {my ? "ပုံမထည့်ဘဲလည်း theme ကြည့်ပြီး prompt ယူလို့ရတယ်။" : "Without a photograph, the prompt makes the whole scene."}
              </span>
            ) : null}
          </div>
          <input
            ref={input}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              void take(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        <Grp title="Themes" titleMy="Theme များ" my={my} aside={`${THEMES.length}`}>
          <Wall items={THEMES} cats={BABY_CATS} value={theme} onPick={setTheme} my={my} />
        </Grp>

        <Choices groups={GROUPS} selection={sel} onToggle={(g, o) => setSel(toggle(GROUPS, sel, g, o))} my={my} />

        {results ? <Results urls={results.urls} chosen={chosen} onChoose={setChosen} my={my} before={url} /> : null}
      </section>

      <PromptDock out={out} my={my}>
        <label className="consent" data-on={consent || undefined}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span className={my ? "my" : "t-small"}>
            {my ? "ကလေးရဲ့ မိဘ/အုပ်ထိန်းသူ ဖြစ်တယ်၊ ဒါမှမဟုတ် သူတို့ ခွင့်ပြုချက် ရထားတယ်" : "I am the baby's parent or guardian, or have their permission"}
          </span>
        </label>
        {consent ? (
          <Generate
            my={my}
            section="baby"
            out={out}
            aspect={ar}
            image={file}
            strength={0.55}
            onResults={(blobs, seed) => {
              setResults({ blobs, seed, urls: blobs.map((b) => URL.createObjectURL(b)) });
              setChosen(0);
              blobs.forEach((b) => void keep(b, "baby", `${th.label} · seed ${seed}`));
            }}
          />
        ) : null}
      </PromptDock>
    </div>
  );
}
