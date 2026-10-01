"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyze, type Analysis } from "@/lib/analyze";
import { BACKDROPS, CATS, timeOfDay } from "@/lib/backdrops";
import { keyBackdrop, transparency } from "@/lib/composite";
import { canvas, ctx2d, readImage, toBlob } from "@/lib/image";
import { compileRoom, opt, toggle } from "@/lib/rooms";
import type { Group } from "@/lib/catalogue";
import type { Selection } from "@/lib/compile";
import type { SectionId } from "@/lib/sections";
import { keep } from "@/lib/vault";
import { Choices, Grp, Amount } from "./Choices";
import { Wall } from "./Wall";
import { PromptDock } from "./PromptDock";
import { Generate, Results } from "./Generate";
import "./reverse.css";
import "./room.css";

const GROUPS: Group[] = [
  {
    id: "shot",
    label: "Shot",
    labelMy: "ရိုက်ချက်",
    order: 3,
    options: [
      opt("full", "Full length", "ခြေဆုံးခေါင်းဆုံး", "full-length figure, feet on the ground plane, the whole setting visible around them"),
      opt("medium", "Medium", "ခါးအထက်", "medium shot from the waist up, the setting soft behind"),
      opt("close", "Close", "အနီးကပ်", "close portrait, head and shoulders, the setting reduced to shape and colour"),
    ],
  },
  {
    id: "fg",
    label: "Foreground",
    labelMy: "ရှေ့ပိုင်း",
    order: 4,
    options: [
      opt("keep", "Keep", "ထားမယ်", "anything in front of the subject kept exactly as shot"),
      opt("replace", "Replace", "အစားထိုး", "a new foreground layer belonging to the new setting, slightly out of focus"),
      opt("remove", "Remove", "ဖယ်မယ်", "nothing between the camera and the subject"),
    ],
  },
  {
    id: "weather",
    label: "Air",
    labelMy: "ရာသီဥတု",
    order: 5,
    options: [
      opt("clear", "Clear", "ကြည်လင်", "clear air, crisp distance"),
      opt("haze", "Haze", "မြူ", "soft atmospheric haze in the distance"),
      opt("mist", "Mist", "နှင်း", "low mist lying close to the ground"),
      opt("rain", "Rain", "မိုး", "light monsoon rain, wet reflective ground", { mm: true }),
    ],
  },
  {
    id: "lens",
    label: "Lens",
    labelMy: "မှန်ဘီလူး",
    order: 6,
    options: [
      opt("35", "35mm", "35mm", "35mm lens, the setting generous around the subject"),
      opt("85", "85mm", "85mm", "85mm lens, compressed background, creamy falloff", { weight: 1.1 }),
      opt("135", "135mm", "135mm", "135mm lens, background stacked and dissolved"),
    ],
  },
];

type Shot = "full" | "medium" | "close";

/* On a plain backdrop the silhouette gives the framing away. */
function estimateShot(px: Uint8ClampedArray, w: number, h: number): Shot | null {
  const cut = transparency(px) > 0.05;
  const a = cut ? Uint8ClampedArray.from({ length: w * h }, (_, p) => px[p * 4 + 3]) : keyBackdrop(px, w, h, 0.3);
  let clear = 0;
  let y0 = h;
  let y1 = 0;
  let x0 = w;
  let x1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (a[y * w + x] < 40) {
        clear++;
        continue;
      }
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
    }
  }
  /* not a plain backdrop — nothing honest to say */
  if (clear / (w * h) < 0.2 || y1 <= y0) return null;
  const touchesBottom = y1 >= h - 2;
  if (!touchesBottom) return "full";
  return (x1 - x0) / w > 0.62 ? "close" : "medium";
}

export function Background({ my, onGo }: { my: boolean; onGo?: (id: SectionId) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [reading, setReading] = useState<Analysis | null>(null);
  const [shotGuess, setShotGuess] = useState<Shot | null>(null);
  const [cutout, setCutout] = useState<Blob | null>(null);
  const [plateOnly, setPlateOnly] = useState(false);

  const [place, setPlace] = useState<string>("bagan");
  const [time, setTime] = useState(0.8);
  const [matchLight, setMatchLight] = useState(true);
  const [sel, setSel] = useState<Selection>({ shot: ["medium"], fg: ["keep"], weather: ["haze"], lens: ["85"] });
  const [extra, setExtra] = useState("");
  const [results, setResults] = useState<{ urls: string[]; blobs: Blob[]; seed: number } | null>(null);
  const [chosen, setChosen] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const take = useCallback(async (f: File | undefined) => {
    if (!f || !f.type.startsWith("image/")) return;
    setFile(f);
    setUrl((p) => {
      if (p) URL.revokeObjectURL(p);
      return URL.createObjectURL(f);
    });
    const [a, small] = await Promise.all([analyze(f), readImage(f, 256)]);
    setReading(a);
    const shot = estimateShot(small.data.data, small.data.width, small.data.height);
    setShotGuess(shot);
    if (shot) setSel((s) => ({ ...s, shot: [shot] }));

    /* a subject on a plain backdrop can go to the model with its own
       alpha as the mask: the person is kept, the backdrop is repainted */
    const big = await readImage(f, 1600);
    const { width: w, height: h } = big.data;
    if (transparency(big.data.data) < 0.02) {
      const alpha = keyBackdrop(big.data.data, w, h, 0.3);
      let clear = 0;
      for (let p = 0; p < alpha.length; p++) if (alpha[p] < 40) clear++;
      if (clear / alpha.length > 0.2) {
        for (let p = 0; p < alpha.length; p++) big.data.data[p * 4 + 3] = alpha[p];
        const c = canvas(w, h);
        ctx2d(c).putImageData(big.data, 0, 0);
        setCutout(await toBlob(c, "image/png"));
        return;
      }
      setCutout(null);
    } else {
      setCutout(f);
    }
  }, []);

  useEffect(() => () => results?.urls.forEach((u) => URL.revokeObjectURL(u)), [results]);

  const bd = BACKDROPS.find((b) => b.id === place)!;
  const tod = timeOfDay(time);
  const light = reading?.readings.find((r) => r.id === "direction");
  const temp = reading?.readings.find((r) => r.id === "temperature");
  const ar = plateOnly ? "3:2" : (reading?.aspect ?? "4:5");
  const editing = !!file && !plateOnly;

  const out = useMemo(
    () =>
      compileRoom(plateOnly ? GROUPS.filter((g) => g.id !== "shot" && g.id !== "fg") : GROUPS, sel, ar, {
        lead: [
          plateOnly ? "an empty background plate with no people, ready for compositing" : "the same person, placed in a new setting",
          bd.descriptor,
          bd.outdoor ? tod.descriptor : "",
        ].filter(Boolean),
        tail: [
          ...(editing && matchLight && light && temp
            ? [`the new setting's light ${light.descriptor.replace("the key light", "").trim()}, ${temp.descriptor}, so the subject's existing light is motivated`]
            : []),
          ...(editing ? ["a soft contact shadow under the subject, cast away from the light"] : []),
          extra.trim(),
        ],
        negatives: plateOnly ? ["people", "person", "figure"] : ["pasted look", "halo around the subject", "floating subject", "changed face"],
        edit: editing
          ? {
              strength: cutout ? 1 : 0.62,
              inpaint: !!cutout,
              keep: ["the face", "the pose", "the subject's own pixels"],
            }
          : undefined,
      }),
    [plateOnly, sel, ar, bd, tod.descriptor, editing, matchLight, light, temp, extra, cutout],
  );

  const shotNote =
    shotGuess && !plateOnly
      ? my
        ? `ပုံပုံစံကနေ ခန့်မှန်းထား — ${shotGuess === "full" ? "ခြေဆုံးခေါင်းဆုံး" : shotGuess === "medium" ? "ခါးအထက်" : "အနီးကပ်"}`
        : `Estimated from the silhouette — ${shotGuess}`
      : null;

  return (
    <div className="rev rev--read room">
      <section className="rev__panel">
        {/* the photograph, or not */}
        <div className="room__in">
          <button type="button" className="room__photo" onClick={() => input.current?.click()} disabled={plateOnly}>
            {url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={url} alt="" />
            ) : (
              <span className={my ? "my" : "t-small"}>{my ? "လူပုံ ထည့်ပါ" : "Add the photograph"}</span>
            )}
          </button>
          <div className="room__read">
            {reading && !plateOnly ? (
              <>
                <span className="t-micro">{my ? "ဖတ်ထားတာ" : "Read off the photograph"}</span>
                <span className={my ? "my" : "t-small"}>{my ? light?.valueMy : light?.value}</span>
                <span className={my ? "my" : "t-small"}>{my ? temp?.valueMy : temp?.value}</span>
                {cutout ? (
                  <span className={`room__ok ${my ? "my" : "t-small"}`}>
                    {my ? "နောက်ခံ သန့်လို့ လူကို mask နဲ့ ထိန်းထားမယ်" : "Plain backdrop — the person is held by a mask"}
                  </span>
                ) : null}
              </>
            ) : (
              <span className={`room__hint ${my ? "my" : "t-small"}`}>
                {my
                  ? "ပုံထည့်ရင် အလင်းလာရာဘက်နဲ့ အပူချိန်ကို ဖတ်ပြီး နောက်ခံအသစ်ကို အဲဒါနဲ့ ကိုက်အောင် လုပ်ပေးမယ်။"
                  : "Add a photograph and its light direction and temperature are read, so the new setting is lit to match."}
              </span>
            )}
            <label className="batch__switch">
              <input type="checkbox" checked={plateOnly} onChange={(e) => setPlateOnly(e.target.checked)} />
              <span className={my ? "my" : "t-small"}>{my ? "နောက်ခံ plate သက်သက် (လူမပါ)" : "Plate only — no subject"}</span>
            </label>
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

        <Grp title="Backdrop wall" titleMy="နောက်ခံ နံရံ" my={my} aside={`${BACKDROPS.length}`}>
          <Wall
            items={BACKDROPS.map((b) => ({ ...b, detail: b.descriptor }))}
            cats={CATS}
            value={place}
            onPick={setPlace}
            my={my}
          />
        </Grp>

        {bd.outdoor ? (
          <Grp title="Time of day" titleMy="အချိန်" my={my} aside={my ? tod.labelMy : tod.label}>
            <div className="tod" style={{ "--sky1": tod.sky[0], "--sky2": tod.sky[1] } as React.CSSProperties}>
              <span className="tod__sky" aria-hidden="true" />
              <Amount label="Morning → night" labelMy="မနက် → ည" value={time} onChange={setTime} my={my} format={() => (my ? tod.labelMy : tod.label)} />
            </div>
          </Grp>
        ) : null}

        <Choices
          groups={plateOnly ? GROUPS.filter((g) => g.id !== "shot" && g.id !== "fg") : GROUPS}
          selection={sel}
          onToggle={(g, o) => setSel(toggle(GROUPS, sel, g, o))}
          my={my}
        />
        {shotNote ? <p className={`room__hint ${my ? "my" : "t-small"}`}>{shotNote}</p> : null}

        {editing ? (
          <label className="batch__switch">
            <input type="checkbox" checked={matchLight} onChange={(e) => setMatchLight(e.target.checked)} />
            <span className={my ? "my" : "t-small"}>
              {my ? "Light match — နောက်ခံရဲ့ အလင်းကို ပုံနဲ့ ကိုက်အောင်" : "Light match — light the setting the way the photograph is lit"}
            </span>
          </label>
        ) : null}

        <Grp title="Anything else" titleMy="ကိုယ်တိုင် ထပ်ဖြည့်ရန်" my={my}>
          <textarea
            className={`field ${my ? "my" : ""}`}
            rows={2}
            value={extra}
            placeholder={my ? "ဥပမာ — ဘေးမှာ ချိုင်းပန်းအိုး" : "e.g. a pot of jasmine at the left"}
            onChange={(e) => setExtra(e.target.value)}
          />
        </Grp>

        {results ? <Results urls={results.urls} chosen={chosen} onChoose={setChosen} my={my} before={plateOnly ? null : url} /> : null}

        {onGo ? (
          <p className={`room__hint ${my ? "my" : "t-small"}`}>
            {my ? "ကိုယ်ပိုင် နောက်ခံပုံ ရှိပြီးသားလား? " : "Already have the plate? "}
            <button type="button" className="rev__again" onClick={() => onGo("harmonize")}>
              {my ? "Harmonize မှာ ပေါင်းမယ် →" : "Composite it in Harmonize →"}
            </button>
          </p>
        ) : null}
      </section>

      <PromptDock out={out} my={my}>
        <Generate
          my={my}
          section="background"
          out={out}
          aspect={ar}
          image={editing ? (cutout ?? file) : null}
          strength={cutout ? 1 : 0.62}
          onResults={(blobs, seed) => {
            setResults({ blobs, seed, urls: blobs.map((b) => URL.createObjectURL(b)) });
            setChosen(0);
            blobs.forEach((b) => void keep(b, "background", `${bd.label} · seed ${seed}`));
          }}
        />
      </PromptDock>
    </div>
  );
}
