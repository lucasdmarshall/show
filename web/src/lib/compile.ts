import { getMode, type ModeId, type Option } from "./catalogue";
import { hasImages, keepText, naturalImageText, type Images } from "./references";

/* ------------------------------------------------------------------
   The Prompt Compiler.

   Decisions are held once, in one shape, and written out as one prompt:
   plain, complete sentences for the image models SHOW runs (Gemini,
   GPT Image) — the same text that reads well pasted anywhere else.
   Nothing is ever cut for length: every decision the photographer made
   reaches the model.
   ------------------------------------------------------------------ */

const COMMON_NEGATIVE = ["watermark", "signature", "garbled text", "jpeg artifacts"];
const MODE_NEGATIVE: Record<ModeId, string[]> = {
  portrait: [
    "extra fingers",
    "deformed hands",
    "asymmetric eyes",
    "duplicated jewellery",
    "plastic skin",
  ],
  ceremony: [
    "extra fingers",
    "deformed hands",
    "merged faces",
    "duplicated people",
    "cropped heads",
    "plastic skin",
  ],
  product: ["fingerprints", "dust specks", "warped label text", "duplicated product"],
  food: ["fingerprints", "wilted garnish", "warped label text", "plastic-looking food"],
  creature: ["extra limbs", "malformed paws", "human features", "duplicated tail"],
  place: ["distorted architecture", "warped horizon", "floating debris"],
  /* Imagination is where a negative list does the most damage. */
  imagine: [],
};

export type Selection = Record<string, string[]>;

export type Compiled = {
  positive: string;
  /** what to avoid — sent alongside, and folded in as "Avoid: …" when copied */
  negative: string;
  /** a rough count, for the library — never a limit */
  tokens: number;
  notes: string[];
};

/* A word is roughly 1.35 tokens once punctuation is counted. */
export function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(words * 1.35);
}

/** The prompt and what to avoid, as one text to paste. */
export const asOneText = (positive: string, negative: string) =>
  negative.trim() ? `${positive}\n\nAvoid: ${negative.trim()}.` : positive;

function chosen(selection: Selection, mode: ModeId): Option[] {
  const groups = [...getMode(mode).groups].sort((a, b) => a.order - b.order);
  const out: Option[] = [];
  for (const group of groups) {
    for (const id of selection[group.id] ?? []) {
      const option = group.options.find((opt) => opt.id === id);
      if (option) out.push(option);
    }
  }
  return out;
}

/**
 * An edit works on a photograph the person already has, rather than
 * starting from nothing: the model is told what to change and what must
 * not move.
 */
export type Edit = {
  /** 0–1: how far the result may move from the source */
  strength: number;
  /** the changeable area comes from the source's alpha */
  inpaint?: boolean;
  /** what has to come back exactly as shot */
  keep?: string[];
  seed?: number;
};

/**
 * The low level: descriptor strings in, the prompt out.
 * Reverse builds its parts by measuring a photograph rather than by
 * reading the catalogue, so it comes in here directly.
 */
export function compileParts(
  parts: string[],
  negatives: string[],
  aspect: string,
  opts: { photographic?: boolean; edit?: Edit; images?: Images } = {},
): Compiled {
  const photographic = opts.photographic ?? true;
  /* attached photographs: a photo to edit makes this an edit, and every
     image is numbered and given a job the model can read */
  const im = hasImages(opts.images) ? opts.images : null;
  const edit = opts.edit ?? (im?.base ? { strength: 0.55, keep: keepText(im) } : undefined);
  const keep = edit?.keep?.length ? edit.keep : null;
  const medium = photographic ? "a photograph" : "an image";
  /* each choice is its own sentence */
  const body = parts.length ? `${parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(". ")}.` : "";

  const positive = im
    ? withImages(
        im,
        body,
        `${im.base ? "" : `Frame it ${aspect}.`} ${photographic ? "Keep it photographic." : ""}`,
        im.base ? "" : `Make ${medium}:`,
      )
    : edit
      ? tidy(`Edit the attached photograph: ${body} ${keep ? `Keep ${keep.join(", ")} exactly as in the original.` : ""} ${photographic ? "Keep it photographic." : ""}`)
      : tidy(`Make ${medium}: ${body} Frame it ${aspect}. ${photographic ? "Keep it photographic — no illustration, no rendering." : ""}`);

  const negative = [...new Set(negatives.map((n) => n.trim()).filter(Boolean))].join(", ");
  return { positive, negative, tokens: estimateTokens(positive), notes: [] };
}

const tidy = (s: string) => s.replace(/\s+/g, " ").replace(/\.\s*\./g, ".").trim();

/** The prompt, built around numbered images. */
function withImages(im: Images, body: string, close: string, open = ""): string {
  const t = naturalImageText(im);
  return tidy([t.lead, open, body, ...t.refs.map((r) => `${r}.`), t.keep, close].filter((x) => x && x.trim()).join(" "));
}

export function compile(
  selection: Selection,
  mode: ModeId,
  aspect: string,
  extra = "",
  images?: Images,
): Compiled {
  const picks = chosen(selection, mode);
  const trailing = extra.trim();

  const parts = picks.map((option) => option.descriptor);
  if (trailing) parts.push(trailing);

  const negatives = [
    ...MODE_NEGATIVE[mode],
    ...COMMON_NEGATIVE,
    ...picks.flatMap((option) => (option.negative ? [option.negative] : [])),
  ];

  const out = compileParts(parts, negatives, aspect, {
    photographic: mode !== "imagine",
    images,
  });
  const notes = [...out.notes];

  const mmPicks = picks.filter((option) => option.mm);
  if (mmPicks.length) {
    notes.push(
      `${mmPicks.length} Burmese ${mmPicks.length === 1 ? "concept" : "concepts"} translated — no model knows these by name.`,
    );
  }

  if (mode === "imagine") {
    notes.push("Negatives kept minimal here — a long exclusion list flattens an invented scene.");
  }

  /* Shape checks that only make sense where the group exists. */
  const [aw, ah] = aspect.split(":").map(Number);
  const frame = selection.frame ?? [];
  if (frame.includes("full") && aw === ah) {
    notes.push("A full-length figure fights a square frame. 2:3 or 4:5 holds it better.");
  }
  if ((selection.size ?? []).some((s) => s === "20+" || s === "crowd") && ah > aw) {
    notes.push("A large group in a portrait frame will crop the ends of the rows. 3:2 or 16:9 fits it.");
  }
  if ((selection.angle ?? []).includes("top") && aw !== ah) {
    notes.push("Overhead shots sit best square — 1:1 wastes the least.");
  }
  if (!picks.length && !trailing) notes.push("Nothing chosen yet.");

  return { ...out, notes };
}
