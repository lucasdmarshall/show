"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyze, NOT_MEASURED, type Analysis, type ReadingId } from "@/lib/analyze";
import { compileParts } from "@/lib/compile";
import { PromptDock } from "./PromptDock";
import type { CreateSeed } from "./Studio";
import { DropZone } from "./DropZone";
import type { Snapshot } from "@/lib/library";
import "./reverse.css";

const BASE_NEGATIVE = ["watermark", "signature", "garbled text", "jpeg artifacts"];

type Props = {
  my: boolean;
  onSendToStudio: (seed: { aspect: string; extra: string }) => void;
  onSave?: (title: string, snap: Snapshot) => void;
  onImage?: (seed: CreateSeed) => void;
};

export function Reverse({ my, onSendToStudio, onSave, onImage }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [off, setOff] = useState<Set<ReadingId>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<string | null>(null);

  const take = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setError(my ? "ဓာတ်ပုံဖိုင် မဟုတ်ပါ။" : "That is not an image file.");
        return;
      }
      setError(null);
      setBusy(true);
      try {
        const result = await analyze(file);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = URL.createObjectURL(file);
        setPreview(urlRef.current);
        setAnalysis(result);
        setOff(new Set());
      } catch {
        setError(
          my
            ? "ဒီပုံကို ဖတ်လို့ မရပါ။ တခြားဖိုင် စမ်းကြည့်ပါ။"
            : "That image could not be read. Try another file.",
        );
      } finally {
        setBusy(false);
      }
    },
    [my],
  );

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const active = useMemo(
    () => analysis?.readings.filter((r) => r.descriptor && !off.has(r.id)) ?? [],
    [analysis, off],
  );

  const out = useMemo(
    () =>
      compileParts(
        active.map((r) => r.descriptor),
        BASE_NEGATIVE,
        analysis?.aspect ?? "4:5",
      ),
    [active, analysis],
  );

  const toggle = (id: ReadingId) =>
    setOff((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* ---------------- empty state ---------------- */
  if (!analysis) {
    return (
      <div className="rev">
        <DropZone
          my={my}
          title="Drop a photograph in"
          titleMy="ဓာတ်ပုံတစ်ပုံ ချထည့်ပါ"
          sub="The light, the contrast, the colour and the focus get measured, and read back as a prompt."
          subMy="အလင်း၊ ကွာဟမှု၊ အရောင်၊ ဖိုကပ်ကို တိုင်းပြီး prompt ပြန်ထုတ်ပေးမယ်။"
          busy={busy}
          error={error}
          onFile={(f) => void take(f)}
        />
      </div>
    );
  }

  /* ---------------- read state ---------------- */
  return (
    <div className="rev rev--read">
      <section className="rev__panel">
        <div className="rev__frame">
          {/* the file is local and its dimensions are unknown until read */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview ?? ""} alt={my ? "ဖတ်ထားသော ဓာတ်ပုံ" : "The photograph being read"} />
        </div>

        <div className="rev__palette" aria-label={my ? "အရောင်စဉ်" : "Palette"}>
          {analysis.palette.map((c) => (
            <span key={c} style={{ background: c }} title={c} />
          ))}
        </div>

        <div className="rev__head">
          <h2 className={my ? "my" : "t-micro"}>{my ? "တိုင်းတာချက်" : "Measured"}</h2>
          <button
            type="button"
            className="rev__again"
            onClick={() => inputRef.current?.click()}
          >
            {my ? "တခြားပုံ" : "Another"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void take(e.target.files?.[0])}
          />
        </div>

        <ul className="reads">
          {analysis.readings.map((r) => {
            const usable = Boolean(r.descriptor);
            const on = usable && !off.has(r.id);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className="read"
                  aria-pressed={usable ? on : undefined}
                  disabled={!usable}
                  onClick={() => usable && toggle(r.id)}
                  title={r.descriptor || undefined}
                >
                  <span className={`read__grp ${my ? "my" : "t-micro"}`}>
                    {my ? r.groupMy : r.group}
                  </span>
                  <span className={`read__val ${my ? "my" : ""}`}>
                    {my ? r.valueMy : r.value}
                  </span>
                  <span className="read__measure">{r.measure}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="rev__missing">
          <p className={my ? "my" : "t-micro"}>
            {my ? "ဒီစက်က မတိုင်းနိုင်တာ" : "Not readable on the device"}
          </p>
          <div className="rev__missing-list">
            {NOT_MEASURED.map((m) => (
              <span key={m.label}>{my ? m.labelMy : m.label}</span>
            ))}
          </div>
          <p className={`rev__missing-note ${my ? "my" : "t-small"}`}>
            {my
              ? "ဒါတွေက model pass လိုတယ် — မချိတ်ရသေးပါ။ လောလောဆယ် Studio မှာ ကိုယ်တိုင် ရွေးပါ။"
              : "Those need a model pass, which is not wired up yet. Choose them by hand in Studio for now."}
          </p>
          <button
            type="button"
            className="btn btn--quiet"
            onClick={() =>
              onSendToStudio({
                aspect: analysis.aspect,
                extra: active.map((r) => r.descriptor).join(", "),
              })
            }
          >
            {my ? "Studio ထဲ ပို့မည်" : "Send to Studio"}
          </button>
        </div>
      </section>

      <PromptDock
        out={out}
        my={my}
        onImage={
          onImage
            ? (refined) =>
                onImage({
                  prompt: refined ? refined.prompt : out.positive,
                  negative: refined ? refined.negative : out.negative,
                  aspect: analysis.aspect,
                  from: my ? "ပြန်ထုတ်" : "Reverse",
                })
            : undefined
        }
        onSave={
          onSave
            ? (title) =>
                onSave(title, {
                  source: "reverse",
                  parts: active.map((r) => r.descriptor),
                  aspect: analysis.aspect,
                  positive: out.positive,
                  negative: out.negative,
                  tokens: out.tokens,
                })
            : undefined
        }
      />
    </div>
  );
}
