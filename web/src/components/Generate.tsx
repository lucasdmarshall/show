"use client";

import { useEffect, useRef, useState } from "react";
import { connected, generate, newSeed, NotConnected } from "@/lib/premium";
import { askSignIn } from "@/lib/account";
import type { Compiled } from "@/lib/compile";
import { Reveal } from "./Reveal";
import "./generate.css";

/* ------------------------------------------------------------------
   The premium half of a room. The prompt above it is always free and
   always copyable; this is the button that makes the photograph on
   SHOW's own servers instead. Four results come back, not one — the
   person picks, and the seed is shown so the pick can be made again.
   ------------------------------------------------------------------ */

type Props = {
  my: boolean;
  section: string;
  out: Compiled;
  aspect: string;
  image?: Blob | null;
  /** photographs to take from, numbered after `image` in the prompt */
  refs?: Blob[];
  mask?: Blob | null;
  strength?: number;
  /** the results, and the seed that made them */
  onResults: (blobs: Blob[], seed: number) => void;
  label?: string;
  labelMy?: string;
};

export function Generate({
  my,
  section,
  out,
  aspect,
  image,
  refs,
  mask,
  strength,
  onResults,
  label,
  labelMy,
}: Props) {
  const [seed, setSeed] = useState(newSeed);
  const [state, setState] = useState<
    "idle" | "running" | "offline" | "error" | "member" | "login"
  >("idle");
  const [progress, setProgress] = useState(0);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  /* The Wait — a developing bar that slows as it nears the end, because
     the server gives no percentage and a stalled bar reads as broken. */
  useEffect(() => {
    if (state !== "running") return;
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const s = (performance.now() - t0) / 1000;
      setProgress(1 - Math.exp(-s / 9));
    }, 120);
    return () => window.clearInterval(id);
  }, [state]);

  const run = async () => {
    if (!connected()) {
      setState("offline");
      return;
    }
    abort.current?.abort();
    abort.current = new AbortController();
    setProgress(0);
    setState("running");
    try {
      const blobs = await generate(
        {
          section,
          prompt: out.positive,
          negative: out.negative,
          image,
          refs,
          mask,
          seed,
          count: 4,
          aspect,
          strength,
        },
        abort.current.signal,
      );
      setState("idle");
      onResults(blobs, seed);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      const m = (e as Error).message;
      setState(
        e instanceof NotConnected
          ? "offline"
          : m === "membership"
            ? "member"
            : m === "login"
              ? "login"
              : "error",
      );
    }
  };

  return (
    <div className="gen" data-state={state}>
      <div className="gen__row">
        <button
          type="button"
          className="btn gen__go"
          onClick={run}
          disabled={state === "running"}
        >
          <span className={my ? "my" : undefined}>
            {state === "running"
              ? my
                ? "ထုတ်နေသည်…"
                : "Making…"
              : my
                ? (labelMy ?? "ပုံ ၄ ပုံ ထုတ်မည်")
                : (label ?? "Make 4")}
          </span>
          <span className="gen__tier">Premium</span>
        </button>
        <label
          className="gen__seed"
          title={my ? "Seed တူရင် ပုံတူ ပြန်ထွက်" : "Same seed, same frame"}
        >
          <span className="t-micro">Seed</span>
          <input
            inputMode="numeric"
            value={seed}
            onChange={(e) =>
              setSeed(
                Number(e.target.value.replace(/\D/g, "").slice(0, 9)) || 0,
              )
            }
          />
          <button
            type="button"
            onClick={() => setSeed(newSeed())}
            aria-label={my ? "Seed အသစ်" : "New seed"}
          >
            ↻
          </button>
        </label>
      </div>

      {state === "running" ? (
        <div
          className="gen__wait"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
        >
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
      ) : null}

      {state === "offline" ? (
        <p className={`gen__msg ${my ? "my" : "t-small"}`} role="status">
          {my
            ? "SHOW server နဲ့ ဒီ build မချိတ်ရသေးပါ။ အပေါ်က prompt ကို copy ကူးပြီး ကိုယ့် engine မှာ ထုတ်လို့ ရပါတယ်။"
            : "This build is not connected to SHOW's generation server yet. The prompt above copies straight into your own engine meanwhile."}
        </p>
      ) : state === "login" ? (
        <p className={`gen__msg ${my ? "my" : "t-small"}`} role="status">
          {my ? "ပုံထုတ်ဖို့ အရင် ဝင်ပါ။ " : "Sign in to make photographs. "}
          <button type="button" className="rev__again" onClick={askSignIn}>
            {my ? "ဝင်မည် →" : "Sign in →"}
          </button>
        </p>
      ) : state === "member" ? (
        <p className={`gen__msg ${my ? "my" : "t-small"}`} role="status">
          {my
            ? "ပုံထုတ်ခြင်းက member တွေအတွက်ပါ။"
            : "Making photographs is for members."}
        </p>
      ) : state === "error" ? (
        <p
          className={`gen__msg gen__msg--err ${my ? "my" : "t-small"}`}
          role="alert"
        >
          {my
            ? "မအောင်မြင်ပါ — balance မဖြတ်ပါ။ ထပ်စမ်းကြည့်ပါ။"
            : "That did not work — nothing was charged. Try again."}
        </p>
      ) : null}
    </div>
  );
}

/** Four results, one chosen. */
export function Results({
  urls,
  chosen,
  onChoose,
  my,
  video,
  before,
  aspect,
}: {
  urls: string[];
  chosen: number;
  onChoose: (i: number) => void;
  my: boolean;
  /** Living Memory comes back as motion */
  video?: boolean;
  /** the photograph that was edited — the chosen result is compared against it */
  before?: string | null;
  /** width / height of the photograph — the compare takes its shape */
  aspect?: number;
}) {
  if (!urls.length) return null;
  const pick = urls[chosen] ?? urls[0];
  return (
    <div className="gen__out">
      {before && !video ? (
        /* an edit is judged against what it was made from, at the seam */
        <div
          className="gen__comparebox"
          style={
            aspect ? { width: `min(100%, calc(60dvh * ${aspect}))` } : undefined
          }
        >
          <Reveal
            key={pick}
            src={before}
            alt={my ? "မူရင်းနဲ့ ရလဒ်" : "Original against the result"}
            layers={[
              { id: "before", label: "Before", labelMy: "မူရင်း", src: before },
              {
                id: "after",
                label: `Result ${chosen + 1}`,
                labelMy: `ရလဒ် ${chosen + 1}`,
                src: pick,
              },
            ]}
            my={my}
            fit="contain"
            initial={0.5}
            aspect={aspect}
            className="gen__compare"
          />
        </div>
      ) : null}
      <div
        className="gen__results"
        role="radiogroup"
        aria-label={my ? "ရလဒ်များ" : "Results"}
      >
        {urls.map((u, i) => (
          <button
            key={u}
            type="button"
            role="radio"
            aria-checked={chosen === i}
            onClick={() => onChoose(i)}
            className="gen__result"
          >
            {video ? (
              <video
                src={u}
                muted
                loop
                autoPlay
                playsInline
                aria-label={`${my ? "ရလဒ်" : "Result"} ${i + 1}`}
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={u} alt={`${my ? "ရလဒ်" : "Result"} ${i + 1}`} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
