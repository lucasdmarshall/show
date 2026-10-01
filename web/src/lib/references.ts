/* ------------------------------------------------------------------
   Reference photographs, written into the prompt.

   A photographer rarely starts from nothing: there is the photograph to
   edit, and there are photographs to take from — this face, that
   outfit, the light in this one. A model only uses a reference it is
   told about, and told exactly what to take. So every image gets a
   number, a role, and a sentence that names both:

     "Edit image 1 … From image 2, take the outfit — … From image 1,
      keep the face and identity exactly as photographed."

   No imports: runs under the engine checks in plain Node.
   ------------------------------------------------------------------ */

export type RefRole =
  | "face"
  | "outfit"
  | "pose"
  | "place"
  | "light"
  | "style"
  | "product"
  | "hair"
  | "jewel"
  | "composition";

export const ROLES: { id: RefRole; label: string; labelMy: string; take: string }[] = [
  { id: "face", label: "Face & identity", labelMy: "မျက်နှာ", take: "the face and identity of the person — keep the likeness exact, same features, same age, same skin" },
  { id: "outfit", label: "Outfit", labelMy: "ဝတ်စုံ", take: "the outfit — the same garment, fabric, colour, pattern and drape" },
  { id: "pose", label: "Pose", labelMy: "ဟန်", take: "the pose and body position" },
  { id: "place", label: "Background", labelMy: "နောက်ခံ", take: "the setting and background" },
  { id: "light", label: "Lighting", labelMy: "အလင်း", take: "the lighting — its direction, softness and colour" },
  { id: "style", label: "Colour & style", labelMy: "အရောင်/စတိုင်", take: "the colour grade and overall photographic style" },
  { id: "product", label: "Product", labelMy: "ပစ္စည်း", take: "the exact product — shape, label, material and colour unchanged" },
  { id: "hair", label: "Hair & make-up", labelMy: "ဆံပင်/မိတ်ကပ်", take: "the hairstyle and make-up" },
  { id: "jewel", label: "Jewellery", labelMy: "လက်ဝတ်ရတနာ", take: "the jewellery — the exact design and metal" },
  { id: "composition", label: "Composition", labelMy: "ပုံဖွဲ့စည်းမှု", take: "the framing and composition" },
];

/** What must come back from the photograph being edited, unchanged. */
export const KEEPS: { id: string; label: string; labelMy: string; text: string }[] = [
  { id: "face", label: "Face & identity", labelMy: "မျက်နှာ", text: "the face and identity" },
  { id: "body", label: "Body & pose", labelMy: "ကိုယ်ဟန်", text: "the body shape and pose" },
  { id: "wardrobe", label: "Wardrobe", labelMy: "ဝတ်စုံ", text: "the clothing" },
  { id: "background", label: "Background", labelMy: "နောက်ခံ", text: "the background" },
  { id: "light", label: "Lighting", labelMy: "အလင်း", text: "the lighting" },
  { id: "composition", label: "Framing", labelMy: "ဘောင်", text: "the framing and composition" },
];

export type Ref = { role: RefRole; note?: string };

export type Images = {
  /** a photograph to edit — it becomes image 1 */
  base: boolean;
  /** KEEPS ids: what of the base must not change */
  keep: string[];
  /** in order; numbered after the base */
  refs: Ref[];
};

export const hasImages = (im?: Images | null): im is Images => !!im && (im.base || im.refs.length > 0);

const take = (r: Ref) => {
  const role = ROLES.find((x) => x.id === r.role) ?? ROLES[0];
  const note = r.note?.trim();
  return note ? `${role.take} (${note})` : role.take;
};

/** image numbers: the base is 1, references follow */
export const numberOf = (im: Images, i: number) => (im.base ? i + 2 : i + 1);

export const keepText = (im: Images) =>
  im.keep.map((k) => KEEPS.find((x) => x.id === k)?.text).filter((x): x is string => !!x);

/**
 * Sentences that say what each image is for.
 * `lead` opens the prompt, `refs` follow the description, `keep` closes it.
 */
export function naturalImageText(im: Images): { lead: string; refs: string[]; keep: string } {
  const lead = im.base
    ? "Edit image 1, the photograph provided — change only what is described."
    : im.refs.length
      ? im.refs.length === 1
        ? "Use the attached image as a reference, for what is named below."
        : `Use the ${im.refs.length} attached images as references, each for what is named below.`
      : "";
  const refs = im.refs.map((r, i) => `From image ${numberOf(im, i)}, take ${take(r)}`);
  const kept = keepText(im);
  const keep = im.base && kept.length ? `From image 1, keep ${kept.join(", ")} exactly as photographed.` : "";
  return { lead, refs, keep };
}
