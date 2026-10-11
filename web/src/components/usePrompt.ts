"use client";

import { useState } from "react";
import { asOneText, type Compiled } from "@/lib/compile";
import { refinePrompt, RefineError, type Refined } from "@/lib/images";
import { askSignIn } from "@/lib/account";

/* What every view of a prompt needs: the text to show (crafted, or the
   AI's refinement of it), copying it, and refining it. The desktop dock
   and the phone's prompt box are two faces of the same thing. */

export function usePrompt(out: Compiled, my: boolean) {
  const [copied, setCopied] = useState(false);
  /* a refinement belongs to the exact prompt it was made from */
  const [refined, setRefined] = useState<(Refined & { for: string }) | null>(null);
  const [showRefined, setShowRefined] = useState(true);
  const [refining, setRefining] = useState(false);
  const [refineMsg, setRefineMsg] = useState<string | null>(null);

  const key = asOneText(out.positive, out.negative);
  const live = refined && refined.for === key ? refined : null;
  const useRefined = !!live && showRefined;
  const text = useRefined ? live!.prompt : out.positive;
  const negative = useRefined ? live!.negative : out.negative;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asOneText(text, negative));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the text is on screen and selectable */
    }
  };

  const refine = async () => {
    setRefining(true);
    setRefineMsg(null);
    try {
      const r = await refinePrompt(out.positive, out.negative);
      setRefined({ ...r, for: key });
      setShowRefined(true);
    } catch (e) {
      const k = e instanceof RefineError ? e.kind : "failed";
      if (k === "login") askSignIn();
      setRefineMsg(
        k === "offline"
          ? my
            ? "AI refine က SHOW server ချိတ်မှ ရမယ်"
            : "Refining needs SHOW's server, which this build is not connected to"
          : k === "login"
            ? my
              ? "Refine လုပ်ဖို့ အရင် ဝင်ပါ — အခမဲ့ပါ"
              : "Sign in to refine — it is free"
            : (e as Error).message,
      );
    } finally {
      setRefining(false);
    }
  };

  return {
    text,
    negative,
    live,
    useRefined,
    showRefined,
    setShowRefined,
    refining,
    refineMsg,
    refine,
    copied,
    copy,
    /** what Make image should carry: the refinement, when one is showing */
    forImage: useRefined ? { prompt: live!.prompt, negative: live!.negative } : null,
  };
}
