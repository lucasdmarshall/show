"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useModels, refinePrompt, RefineError, type ImageModel } from "@/lib/images";
import { askSignIn, useAccount } from "@/lib/account";
import { connected, generate, newSeed, NotConnected, preferredModel, setPreferredModel } from "@/lib/premium";
import { download, uid } from "@/lib/image";
import { keep } from "@/lib/vault";
import { Reveal } from "./Reveal";
import type { CreateSeed } from "./Studio";
import "./create.css";

/* ------------------------------------------------------------------
   Create — where the prompt becomes a photograph.

   Choose the model, read the prompt Studio crafted (refined or not),
   make one to four. Any result can be edited: the prompt gives way to
   a description of the change, a reference photograph can sit beside
   it, and the edit comes back on the Reveal — before against after.
   ------------------------------------------------------------------ */

type Shot = {
  id: string;
  blob: Blob;
  url: string;
  w: number;
  h: number;
  prompt: string;
  model: string;
  seed: number;
  /** what it was edited from */
  parent: string | null;
};

type Ref = { id: string; blob: Blob; url: string };

type Failure = "offline" | "login" | "membership" | "failed";

const ASPECTS = ["1:1", "4:5", "3:4", "2:3", "9:16", "3:2", "4:3", "16:9", "21:9"];

const ratioOf = (a: string) => {
  const [w, h] = a.split(":").map(Number);
  return w && h ? w / h : 1;
};

const nearest = (ratio: number, list: string[]) =>
  list.reduce((best, a) => (Math.abs(Math.log(ratioOf(a) / ratio)) < Math.abs(Math.log(ratioOf(best) / ratio)) ? a : best), list[0] ?? "1:1");

/* what the room says while it waits, in turn */
const WAIT: [string, string][] = [
  ["Reading the light", "အလင်းကို ဖတ်နေတယ်"],
  ["Setting the scene", "နေရာကို ပြင်ဆင်နေတယ်"],
  ["Laying down the grain", "Grain ကို ချနေတယ်"],
  ["Bringing up the shadows", "အရိပ်တွေကို ပေါ်လာစေတယ်"],
  ["Fixing the print", "ပုံကို အသေသတ်နေတယ်"],
];

/* -- the wait: a tray of developer and gold dust ------------------- */

function Developing({ count, aspect, my }: { count: number; aspect: string; my: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const still = useReducedMotion();
  const [t, setT] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setT((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c || still) return;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = () => {
      c.width = c.clientWidth * dpr;
      c.height = c.clientHeight * dpr;
    };
    size();
    window.addEventListener("resize", size);
    /* dust that orbits, falls inward, and is born again at the edge */
    const N = 140;
    const dust = Array.from({ length: N }, () => ({
      a: Math.random() * Math.PI * 2,
      r: 0.25 + Math.random() * 0.75,
      s: 0.0015 + Math.random() * 0.004,
      z: Math.random(),
    }));
    const start = performance.now();
    const draw = (now: number) => {
      const w = c.width;
      const h = c.height;
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.hypot(w, h) / 2;
      ctx.clearRect(0, 0, w, h);
      const pulse = 0.5 + 0.5 * Math.sin((now - start) / 900);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.55);
      g.addColorStop(0, `rgba(240,199,94,${0.1 + 0.08 * pulse})`);
      g.addColorStop(1, "rgba(240,199,94,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (const d of dust) {
        d.a += d.s;
        d.r -= 0.0009 * (0.4 + d.z);
        if (d.r < 0.04) {
          d.r = 0.8 + Math.random() * 0.3;
          d.a = Math.random() * Math.PI * 2;
        }
        const x = cx + Math.cos(d.a) * d.r * R * 0.9;
        const y = cy + Math.sin(d.a) * d.r * R * 0.6;
        const alpha = Math.min(1, (1 - d.r) * 1.6) * (0.35 + 0.65 * d.z);
        ctx.fillStyle = `rgba(240,199,94,${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, (0.6 + d.z * 1.6) * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
    };
  }, [still]);

  const line = WAIT[Math.floor(t / 3) % WAIT.length];
  const n = Math.max(1, count);
  return (
    <div className="dev">
      <canvas ref={canvas} className="dev__dust" aria-hidden="true" />
      <div className="dev__frames" data-n={n}>
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className="dev__frame" style={{ aspectRatio: aspect.replace(":", " / "), animationDelay: `${i * 0.35}s` }} />
        ))}
      </div>
      <div className="dev__status" role="status" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.span
            key={line[0]}
            className={my ? "my" : undefined}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.45 }}
          >
            {my ? line[1] : line[0]}
          </motion.span>
        </AnimatePresence>
        <span className="dev__time">{t}s</span>
      </div>
    </div>
  );
}

/* -- one model, as a card ------------------------------------------ */

function ModelCard({ m, on, my, onPick }: { m: ImageModel; on: boolean; my: boolean; onPick: () => void }) {
  return (
    <button type="button" className="mcard" aria-pressed={on} onClick={onPick}>
      <span className="mcard__glyph" data-vendor={m.vendor} aria-hidden="true">
        {m.vendor === "Google" ? "G" : m.vendor === "OpenAI" ? "◎" : "✦"}
      </span>
      <span className="mcard__text">
        <span className="mcard__vendor t-micro">{m.vendor}</span>
        <span className="mcard__name">{m.label}</span>
        <span className={`mcard__note ${my ? "my" : ""}`}>{my ? m.note_my : m.note}</span>
      </span>
      <span className="mcard__badges">
        <span>{m.refs} refs</span>
        <span>{m.aspects.length} frames</span>
      </span>
    </button>
  );
}

/* -- reference slot ------------------------------------------------ */

function RefSlot({ refs, max, onAdd, onRemove, my }: { refs: Ref[]; max: number; onAdd: (f: File[]) => void; onRemove: (id: string) => void; my: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className="refs"
      data-over={over || undefined}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onAdd([...e.dataTransfer.files]);
      }}
    >
      <AnimatePresence initial={false}>
        {refs.map((r) => (
          <motion.span
            key={r.id}
            className="refs__item"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.url} alt="" />
            <button type="button" onClick={() => onRemove(r.id)} aria-label={my ? "ဖယ်" : "Remove"}>
              ×
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      {refs.length < max ? (
        <button type="button" className="refs__add" onClick={() => input.current?.click()}>
          <span aria-hidden="true">+</span>
          <span className={my ? "my" : "t-micro"}>{my ? "Reference ပုံ" : "Reference"}</span>
        </button>
      ) : null}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          onAdd([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function Create({ my, seed }: { my: boolean; seed?: CreateSeed }) {
  const cat = useModels();
  const acct = useAccount();
  const still = useReducedMotion();

  const [modelId, setModelId] = useState<string>(() => preferredModel() ?? "nano-banana-pro");
  const model = cat.models.find((m) => m.id === modelId) ?? cat.models[0] ?? null;
  const aspects = model ? ASPECTS.filter((a) => model.aspects.includes(a)) : ASPECTS;

  /* a photograph from Studio means an edit, already described */
  const [mode, setMode] = useState<"create" | "edit">(seed?.image ? "edit" : "create");
  const [prompt, setPrompt] = useState(seed?.prompt ?? "");
  const [negative, setNegative] = useState(seed?.negative ?? "");
  const [aspect, setAspect] = useState(seed?.aspect ?? "4:5");
  /* one image a press: every one is paid for */
  const count = 1;
  const [editText, setEditText] = useState(seed?.image ? seed.prompt : "");
  const [refs, setRefs] = useState<Ref[]>(() =>
    (seed?.refs ?? []).map((b) => ({ id: uid(), blob: b, url: URL.createObjectURL(b) })),
  );
  const [source, setSource] = useState<Shot | null>(null);

  const [shots, setShots] = useState<Shot[]>([]);
  const [batch, setBatch] = useState<string[]>([]);
  const [focus, setFocus] = useState<string | null>(null);
  const [making, setMaking] = useState<{ count: number; aspect: string } | null>(null);
  const [failure, setFailure] = useState<{ kind: Failure; message: string } | null>(null);
  const [seedNum, setSeedNum] = useState(newSeed);
  const [refining, setRefining] = useState(false);
  const [refineNote, setRefineNote] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const ownUpload = useRef<HTMLInputElement>(null);

  /* Studio's photograph to edit becomes the source, ready for its edit */
  useEffect(() => {
    const b = seed?.image;
    if (!b) return;
    let live = true;
    createImageBitmap(b).then((bmp) => {
      if (!live) return;
      const url = URL.createObjectURL(b);
      urls.current.push(url);
      const shot: Shot = { id: uid(), blob: b, url, w: bmp.width, h: bmp.height, prompt: "", model: "", seed: 0, parent: null };
      bmp.close();
      setShots([shot]);
      setSource(shot);
      setFocus(shot.id);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, from the seed this page was opened with
  }, []);
  const urls = useRef<string[]>([]);
  useEffect(() => {
    const list = urls.current;
    return () => list.forEach((u) => URL.revokeObjectURL(u));
  }, []);
  const urlFor = (b: Blob) => {
    const u = URL.createObjectURL(b);
    urls.current.push(u);
    return u;
  };

  const byId = useCallback((id: string | null) => shots.find((s) => s.id === id) ?? null, [shots]);
  const focused = byId(focus);
  const parentOfFocused = focused ? byId(focused.parent) : null;
  const shownAspect = aspects.includes(aspect) ? aspect : nearest(ratioOf(aspect), aspects);

  const pickModel = (id: string) => {
    setModelId(id);
    setPreferredModel(id);
  };

  const addRefs = async (files: File[]) => {
    const max = Math.min(6, model?.refs ?? 6);
    const imgs = files.filter((f) => f.type.startsWith("image/")).slice(0, max - refs.length);
    setRefs((r) => [...r, ...imgs.map((f) => ({ id: uid(), blob: f as Blob, url: urlFor(f) }))]);
  };

  /* your own photograph, to edit */
  const editOwn = async (f: File | undefined) => {
    if (!f?.type.startsWith("image/")) return;
    const bmp = await createImageBitmap(f);
    const shot: Shot = { id: uid(), blob: f, url: urlFor(f), w: bmp.width, h: bmp.height, prompt: "", model: "", seed: 0, parent: null };
    bmp.close();
    setShots((s) => [...s, shot]);
    setSource(shot);
    setFocus(shot.id);
    setMode("edit");
  };

  const startEdit = (s: Shot) => {
    setSource(s);
    setEditText("");
    setRefs([]);
    setMode("edit");
    setFailure(null);
  };

  /* -- make ----------------------------------------------------------- */
  const make = async () => {
    if (!model || making) return;
    const edit = mode === "edit";
    if (edit && !source) return;
    const text = (edit ? editText : prompt).trim();
    if (!text) return;
    const frame = edit && source ? nearest(source.w / source.h, aspects) : shownAspect;
    const n = count;
    setFailure(null);
    setMaking({ count: n, aspect: frame });
    setFocus(null);
    try {
      const blobs = await generate({
        section: "create",
        model: model.id,
        prompt: text,
        negative: edit ? "" : negative,
        seed: seedNum,
        count: n,
        aspect: frame,
        image: edit ? source!.blob : null,
        refs: refs.map((r) => r.blob),
      });
      const made: Shot[] = [];
      for (const b of blobs) {
        const bmp = await createImageBitmap(b);
        made.push({ id: uid(), blob: b, url: urlFor(b), w: bmp.width, h: bmp.height, prompt: text, model: model.label, seed: seedNum, parent: edit ? source!.id : null });
        bmp.close();
        void keep(b, "create", `${model.label} · ${text.slice(0, 48)}`);
      }
      setShots((s) => [...s, ...made]);
      setBatch(made.map((m) => m.id));
      /* an edit opens straight onto before-and-after */
      setFocus(edit || made.length === 1 ? made[0].id : null);
      setSeedNum(newSeed());
    } catch (e) {
      const m = (e as Error).message;
      const kind: Failure = e instanceof NotConnected ? "offline" : m === "login" ? "login" : m === "membership" ? "membership" : "failed";
      if (kind === "login") askSignIn();
      setFailure({ kind, message: m });
    } finally {
      setMaking(null);
    }
  };

  const refine = async () => {
    setRefining(true);
    setRefineNote(null);
    try {
      const r = await refinePrompt(prompt, negative);
      setPrompt(r.prompt);
      if (r.negative) setNegative(r.negative);
      setRefineNote(r.notes[0] ?? (my ? "AI ပြင်ပြီး" : "Refined"));
    } catch (e) {
      if (e instanceof RefineError && e.kind === "login") askSignIn();
      setRefineNote((e as Error).message);
    } finally {
      setRefining(false);
    }
  };

  /* ⌘/Ctrl + Enter makes */
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void make();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const failureText = useMemo(() => {
    if (!failure) return null;
    switch (failure.kind) {
      case "offline":
        return my ? "ဒီ build က SHOW server နဲ့ မချိတ်ရသေးပါ။" : "This build is not connected to SHOW's server.";
      case "login":
        return my ? "ပုံထုတ်ဖို့ အရင် ဝင်ပါ။" : "Sign in to make photographs.";
      case "membership":
        return my ? "ပုံထုတ်ခြင်းက member တွေအတွက်ပါ။" : "Making photographs is for members.";
      default:
        if (failure.message.includes("out of credit"))
          return my ? "ပုံထုတ်တဲ့ service ဘက်မှာ credit ကုန်နေတယ် — ဘာမှ မဖြတ်ပါ။ ခဏနေ ထပ်စမ်းပါ။" : "The image service is out of credit on SHOW's side — nothing was charged. Try again later.";
        return my ? "မအောင်မြင်ပါ — ဘာမှ မဖြတ်ပါ။ ထပ်စမ်းပါ။" : "That did not work — nothing was charged. Try again.";
    }
  }, [failure, my]);

  const current = batch.map((id) => byId(id)).filter((s): s is Shot => !!s);
  const fade = still ? { duration: 0 } : { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const };

  /* -- stage ----------------------------------------------------------- */
  let stage: React.ReactNode;
  let stageKey: string;
  if (making) {
    stageKey = "making";
    stage = <Developing count={making.count} aspect={making.aspect} my={my} />;
  } else if (focused) {
    stageKey = `focus-${focused.id}`;
    stage = (
      <div className="cstage__focus">
        <div className="cstage__frame" style={{ "--ar": focused.w / focused.h } as React.CSSProperties}>
          {parentOfFocused ? (
            <Reveal
              key={focused.id}
              src={parentOfFocused.url}
              alt={my ? "မပြင်ခင်နဲ့ ပြင်ပြီး" : "Before and after the edit"}
              layers={[
                { id: "before", label: "Before", labelMy: "မပြင်ခင်", src: parentOfFocused.url },
                { id: "after", label: "After", labelMy: "ပြင်ပြီး", src: focused.url },
              ]}
              my={my}
              fit="contain"
              aspect={focused.w / focused.h}
              initial={0.5}
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img className="cstage__img develop" src={focused.url} alt={focused.prompt} />
          )}
        </div>
        <div className="cstage__acts">
          {current.length > 1 ? (
            <button type="button" className="lib__act" onClick={() => setFocus(null)}>
              ← {my ? "အားလုံး" : "All results"}
            </button>
          ) : null}
          <span className="cstage__meta t-micro">
            {focused.model ? `${focused.model} · seed ${focused.seed}` : my ? "ကိုယ့်ပုံ" : "Your photograph"}
          </span>
          <button
            type="button"
            className="btn btn--quiet"
            onClick={() => {
              download(focused.blob, `show-${focused.seed || "photo"}-${focused.id}.png`);
              setSaved(focused.id);
              window.setTimeout(() => setSaved(null), 1800);
            }}
          >
            {saved === focused.id ? (my ? "သိမ်းပြီး" : "Saved") : my ? "စက်ထဲ သိမ်းမည်" : "Save to device"}
          </button>
          <button type="button" className="btn" onClick={() => startEdit(focused)}>
            {my ? "ပြင်မည်" : "Edit"}
          </button>
        </div>
      </div>
    );
  } else if (current.length) {
    stageKey = `grid-${batch.join()}`;
    stage = (
      <div className="cstage__grid" data-n={current.length}>
        {current.map((s, i) => (
          <motion.button
            key={s.id}
            type="button"
            className="cshot"
            onClick={() => setFocus(s.id)}
            initial={still ? false : { opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...fade, delay: still ? 0 : i * 0.14 }}
            whileHover={still ? undefined : { y: -4 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="develop" src={s.url} alt={s.prompt} style={{ animationDelay: `${i * 0.14}s` }} />
          </motion.button>
        ))}
      </div>
    );
  } else {
    stageKey = "empty";
    stage = (
      <div className="cstage__empty">
        <span className="cstage__aura" aria-hidden="true" />
        <div className="cstage__mood" aria-hidden="true">
          {[
            "/landing/showcase/edit-after.jpg",
            "/landing/showcase/background-after.jpg",
            "/landing/showcase/grade-after.jpg",
          ].map((src, i) => (
            <span className="cstage__mood-frame" key={src} style={{ "--i": i } as React.CSSProperties}>
              <Image src={src} alt="" fill sizes="(max-width: 700px) 28vw, 180px" />
            </span>
          ))}
        </div>
        <p className="t-micro">{model ? model.label : "SHOW"}</p>
        <h2 className={my ? "my" : "t-h2"}>{my ? "ဘာပုံ ထုတ်မလဲ" : "What shall we make?"}</h2>
        <p className={`cstage__lede ${my ? "my" : "t-small"}`}>
          {seed
            ? my
              ? `${seed.from} က craft လုပ်ထားတဲ့ prompt အဆင်သင့် ဖြစ်နေပြီ`
              : `The prompt crafted in ${seed.from} is ready`
            : my
              ? "Prompt ရေးပါ — ဒါမှမဟုတ် ကိုယ့်ပုံကို ပြင်ဖို့ ထည့်ပါ"
              : "Write a prompt — or bring a photograph of your own to edit"}
        </p>
        <button type="button" className="lib__act" onClick={() => ownUpload.current?.click()}>
          {my ? "ကိုယ့်ပုံကို ပြင်မယ် →" : "Edit my own photograph →"}
        </button>
      </div>
    );
  }

  const canMake = !!model && !making && (mode === "edit" ? !!source && !!editText.trim() : !!prompt.trim());

  return (
    <div className="create">
      {/* ================= the stage ================= */}
      <section className="cstage" aria-label={my ? "ရလဒ်" : "Results"}>
        <AnimatePresence mode="wait">
          <motion.div
            key={stageKey}
            className="cstage__inner"
            initial={still ? false : { opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={still ? undefined : { opacity: 0, scale: 1.01 }}
            transition={fade}
          >
            {stage}
          </motion.div>
        </AnimatePresence>

        {shots.length ? (
          <div className="strip" aria-label={my ? "ဒီတစ်ခေါက် ထုတ်ထားတာ" : "This session"}>
            {shots.map((s) => (
              <button
                key={s.id}
                type="button"
                className="strip__item"
                aria-current={focus === s.id || undefined}
                data-edit={s.parent ? true : undefined}
                onClick={() => setFocus(s.id)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.url} alt="" />
              </button>
            ))}
          </div>
        ) : null}
        <input ref={ownUpload} type="file" accept="image/*" hidden onChange={(e) => void editOwn(e.target.files?.[0])} />
      </section>

      {/* ================= the controls ================= */}
      <section className="cpanel" aria-label={my ? "ထိန်းချုပ်မှု" : "Controls"}>
        <div className="cpanel__mode" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "create"} onClick={() => setMode("create")}>
            <span className={my ? "my" : undefined}>{my ? "ထုတ်မယ်" : "Create"}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "edit"}
            onClick={() => (source ? setMode("edit") : ownUpload.current?.click())}
          >
            <span className={my ? "my" : undefined}>{my ? "ပြင်မယ်" : "Edit"}</span>
          </button>
          <motion.span className="cpanel__pill" layout transition={fade} data-at={mode} aria-hidden="true" />
        </div>

        {cat.status === "off" ? (
          <p className={`gen__msg ${my ? "my" : "t-small"}`}>
            {my ? "ပုံထုတ်တာက SHOW server ချိတ်မှ ရမယ်။" : "Making images needs SHOW's server, which this build is not connected to."}
          </p>
        ) : null}

        <div className="cpanel__models">
          {cat.models.map((m) => (
            <ModelCard key={m.id} m={m} on={model?.id === m.id} my={my} onPick={() => pickModel(m.id)} />
          ))}
          {cat.status === "loading" ? <span className="mcard mcard--ghost" /> : null}
        </div>
        {cat.provider === "dev" ? (
          <p className={`room__hint ${my ? "my" : "t-small"}`}>
            {my
              ? "Server က dev mode နဲ့ run နေတယ် — တကယ့်ပုံအစား အစားထိုးပုံ ထွက်မယ်။ OpenRouter key ထည့်ရင် တကယ့် model ဖြစ်မယ်။"
              : "The server is in dev mode — stand-in images, not the real models. An OpenRouter key switches it over."}
          </p>
        ) : null}

        <AnimatePresence mode="wait" initial={false}>
          {mode === "create" ? (
            <motion.div key="create" className="cpanel__prompt" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={fade}>
              <div className="cpanel__label">
                <span className={my ? "my" : "t-micro"}>Prompt</span>
                <button type="button" className="refine__go" onClick={() => void refine()} disabled={refining || !prompt.trim()} data-busy={refining || undefined}>
                  <span aria-hidden="true" className="refine__spark">✦</span>
                  {refining ? (my ? "ပြင်နေသည်…" : "Refining…") : "Refine with AI"}
                </button>
              </div>
              <textarea
                className={`field cpanel__text ${my ? "my" : ""}`}
                value={prompt}
                rows={7}
                data-busy={refining || undefined}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={my ? "ဥပမာ — ရွှေတိဂုံ ရင်ပြင်ပေါ်က သတို့သမီး၊ ညနေရောင်…" : "e.g. a bride on the Shwedagon terrace at dusk…"}
              />
              {refineNote ? <p className={`cpanel__note ${my ? "my" : "t-small"}`}>✦ {refineNote}</p> : null}
              <RefSlot refs={refs} max={Math.min(6, model?.refs ?? 6)} onAdd={(f) => void addRefs(f)} onRemove={(id) => setRefs((r) => r.filter((x) => x.id !== id))} my={my} />
              <div className="cpanel__row">
                <div className="grp__opts cpanel__aspects">
                  {aspects.map((a) => (
                    <button key={a} type="button" className="chip chip--num" aria-pressed={shownAspect === a} onClick={() => setAspect(a)}>
                      <span className="aspect-glyph" style={{ aspectRatio: a.replace(":", " / ") }} aria-hidden="true" />
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="edit" className="cpanel__prompt" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={fade}>
              <div className="cpanel__edit">
                {source ? (
                  <button type="button" className="cpanel__source" onClick={() => setFocus(source.id)} title={my ? "ပြင်မယ့်ပုံ" : "Editing this"}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={source.url} alt="" />
                    <span className="t-micro">{my ? "ဒါကို ပြင်မယ်" : "Editing"}</span>
                  </button>
                ) : null}
                <textarea
                  className={`field cpanel__text ${my ? "my" : ""}`}
                  value={editText}
                  rows={5}
                  autoFocus
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder={
                    my
                      ? "ဘာပြောင်းချင်လဲ ရေးပါ — ဥပမာ “လုံချည်ကို မြစိမ်းရောင် ပိုးထည် ပြောင်းပါ”"
                      : "Describe the change — e.g. “make the longyi emerald silk”"
                  }
                />
              </div>
              <p className={`cpanel__note ${my ? "my" : "t-small"}`}>
                {my ? "Reference ပုံ ထည့်ရင် ဝတ်စုံ၊ မျက်နှာ၊ နေရာ စတာကို အဲဒီကနေ ယူမယ်။" : "Add a reference and the model takes the garment, face or place from it."}
              </p>
              <RefSlot refs={refs} max={Math.min(6, model?.refs ?? 6)} onAdd={(f) => void addRefs(f)} onRemove={(id) => setRefs((r) => r.filter((x) => x.id !== id))} my={my} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="cpanel__go">
          <button
            type="button"
            className="btn btn--image cpanel__make"
            onClick={() => (acct.status === "out" ? askSignIn() : void make())}
            disabled={!canMake && acct.status !== "out"}
          >
            <span aria-hidden="true">✦</span>
            <span className={my ? "my" : undefined}>
              {making
                ? my
                  ? "ထုတ်နေသည်…"
                  : "Making…"
                : acct.status === "out"
                  ? my
                    ? "ဝင်ပြီး ထုတ်မည်"
                    : "Sign in to make"
                  : mode === "edit"
                    ? my
                      ? "ပြင်မည်"
                      : "Make the edit"
                    : my
                      ? "Image ထုတ်မည်"
                      : "Make image"}
            </span>
          </button>
        </div>
        <label className="gen__seed cpanel__seed" title={my ? "Seed တူရင် ပုံတူ ပြန်ထွက်နိုင်" : "The same seed can give the same frame"}>
          <span className="t-micro">Seed</span>
          <input inputMode="numeric" value={seedNum} onChange={(e) => setSeedNum(Number(e.target.value.replace(/\D/g, "").slice(0, 9)) || 0)} />
          <button type="button" onClick={() => setSeedNum(newSeed())} aria-label={my ? "Seed အသစ်" : "New seed"}>
            ↻
          </button>
        </label>

        <AnimatePresence>
          {failureText ? (
            <motion.p
              className={`gen__msg ${failure?.kind === "failed" ? "gen__msg--err" : ""} ${my ? "my" : "t-small"}`}
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {failureText}
              {failure?.kind === "login" ? (
                <button type="button" className="rev__again" onClick={askSignIn}>
                  {" "}
                  {my ? "ဝင်မည် →" : "Sign in →"}
                </button>
              ) : null}
            </motion.p>
          ) : null}
        </AnimatePresence>
        {!connected() ? null : acct.status === "in" && acct.me && !acct.me.member ? (
          <p className={`room__hint ${my ? "my" : "t-small"}`}>
            {my ? "Prompt tool တွေ အကုန် အခမဲ့။ ပုံထုတ်တာက member အတွက်။" : "Every prompt tool is free. Making photographs is for members."}
          </p>
        ) : null}
      </section>
    </div>
  );
}
