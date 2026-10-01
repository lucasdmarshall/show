/* ------------------------------------------------------------------
   Harmonize, with a model: one person put into another photograph.

   Two images go to the model, in this order:
     image 1  the scene — or, placed by hand, the scene with the person
              roughly pasted where they should stand
     image 2  the person's own photograph, untouched: the only source
              of their face

   The face is the one thing a photographer cannot let a model invent,
   so the prompt says where it comes from and that it must not move.

   No imports: runs under the engine checks in plain Node.
   ------------------------------------------------------------------ */

export const PERSON_KEEPS: { id: string; label: string; labelMy: string; text: string }[] = [
  { id: "outfit", label: "Outfit", labelMy: "ဝတ်စုံ", text: "their clothing" },
  { id: "pose", label: "Pose", labelMy: "ဟန်", text: "their pose" },
  { id: "hair", label: "Hair & make-up", labelMy: "ဆံပင်/မိတ်ကပ်", text: "their hair and make-up" },
  { id: "expression", label: "Expression", labelMy: "အမူအရာ", text: "their expression" },
];

export const TOGETHER_NEGATIVE = [
  "changed face",
  "a different person",
  "duplicated person",
  "cut-out edges",
  "halo",
  "floating subject",
  "mismatched lighting",
  "watermark",
];

export type Together = {
  /** the person was placed by hand: image 1 is the rough paste */
  placed: boolean;
  /** PERSON_KEEPS ids — what else of image 2 must not change */
  keep: string[];
  /** the light and look, in words */
  look: string;
  /** where the scene's light comes from: -1 left, 1 right, 0 unknown */
  side: number;
  /** someone added to a family photograph */
  reunion: boolean;
  extra: string;
};

export function togetherPrompt(t: Together): string {
  const kept = PERSON_KEEPS.filter((k) => t.keep.includes(k.id)).map((k) => k.text);
  const list = kept.length > 1 ? `${kept.slice(0, -1).join(", ")} and ${kept.at(-1)}` : kept[0];
  const said = t.extra.trim();
  const extra = `${said.charAt(0).toUpperCase()}${said.slice(1)}`.replace(/\.?$/, ".");
  return [
    t.placed
      ? "Image 1 is the scene with the person from image 2 roughly pasted in where they should stand. Turn that rough paste into one seamless photograph, keeping their position and size exactly."
      : "Place the person from image 2 into the scene in image 1, so the result reads as one photograph taken there.",
    "Take their face and identity only from image 2 and keep them exact — the same features, age and skin; do not beautify, slim or redraw the face.",
    list ? `From image 2, also keep ${list} unchanged.` : "",
    !t.placed ? "Stand them where a photographer would place them, at the true scale of the scene." : "",
    !t.placed && !t.keep.includes("pose") ? "Pose them naturally for the place." : "",
    `Light and look: ${t.look}.`,
    t.side ? `The scene's main light comes from the ${t.side > 0 ? "right" : "left"}; light them from that side.` : "",
    "Match colour temperature, contrast, focus, grain and haze, and give them a correct contact shadow where they meet the ground.",
    "Keep everything else in image 1 — the place and anyone already in it — exactly as photographed.",
    t.reunion ? "They must look as if they were photographed with the others on the same day, with the same camera and lens." : "",
    t.extra.trim() ? extra : "",
    "Keep it photographic.",
  ]
    .filter(Boolean)
    .join(" ");
}
