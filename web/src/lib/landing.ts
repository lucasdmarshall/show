import type { SectionId } from "./sections";

/* ------------------------------------------------------------------
   The landing page's content, kept apart from its layout.

   Real photographs replace the placeholders by setting a path:
     HERO_IMAGE                → public/landing/hero.jpg
     SHOWCASE[n].before/after  → public/landing/showcase/…
   Until then every slot draws a placeholder in its own colours.
   ------------------------------------------------------------------ */

/** The photograph under the water. null draws SHOW's gold silk instead. */
export const HERO_IMAGE: string | null = "/landing/hero.jpg";

export type Showcase = {
  id: string;
  /** which room made it — links the card to the feature list */
  section: SectionId;
  title: string;
  titleMy: string;
  note: string;
  noteMy: string;
  /** width / height */
  aspect: number;
  before: string | null;
  after: string | null;
  /** placeholder colours: before (faded), after (finished) */
  tone: { before: [string, string]; after: [string, string, string] };
};

export const SHOWCASE: Showcase[] = [
  {
    id: "restore",
    section: "restore",
    title: "A 1962 wedding portrait",
    titleMy: "၁၉၆၂ ခုနှစ်က မင်္ဂလာပုံ",
    note: "Tears, dust and fading repaired. The faces are the faces.",
    noteMy: "စုတ်ပြဲ၊ ဖုန်၊ အရောင်လွင့်တာ ပြင်ပြီး — မျက်နှာက မူရင်းအတိုင်း",
    aspect: 3 / 4,
    before: "/landing/showcase/restore-before.jpg",
    after: "/landing/showcase/restore-after.jpg",
    tone: { before: ["#6b6157", "#2b2723"], after: ["#d9a441", "#7b2d3b", "#120c0a"] },
  },
  {
    id: "edit",
    section: "create",
    title: "Same bride, acheik silk",
    titleMy: "သတို့သမီးတူတူ၊ အချိတ်ပိုး",
    note: "Wardrobe changed from one reference photograph.",
    noteMy: "Reference ပုံတစ်ပုံနဲ့ ဝတ်စုံ ပြောင်းထားတာ",
    aspect: 3 / 4,
    before: "/landing/showcase/edit-before.jpg",
    after: "/landing/showcase/edit-after.jpg",
    tone: { before: ["#c9c3b8", "#5f5a52"], after: ["#f0c75e", "#9c2f45", "#1b0f12"] },
  },
  {
    id: "background",
    section: "background",
    title: "Studio grey to Bagan sunrise",
    titleMy: "စတူဒီယို မီးခိုးရောင်ကနေ ပုဂံ နေထွက်",
    note: "The light matched, the contact shadow solved.",
    noteMy: "အလင်း ကိုက်၊ ခြေအောက်အရိပ် မှန်",
    aspect: 4 / 3,
    before: "/landing/showcase/background-before.jpg",
    after: "/landing/showcase/background-after.jpg",
    tone: { before: ["#8d8d8f", "#3c3c40"], after: ["#f6b26b", "#c0573a", "#24130d"] },
  },
  {
    id: "reunion",
    section: "harmonize",
    title: "Family Reunion",
    titleMy: "မိသားစု ပြန်ဆုံ",
    note: "Grandfather back in the family photograph, as if he never left.",
    noteMy: "အဖိုးကို မိသားစုပုံထဲ ပြန်ထည့် — တစ်ခါမှ မခွဲခဲ့သလို",
    aspect: 4 / 3,
    before: "/landing/showcase/reunion-before.jpg",
    after: "/landing/showcase/reunion-after.jpg",
    tone: { before: ["#7e7468", "#34302b"], after: ["#e9b866", "#4f6b5a", "#0f1210"] },
  },
  {
    id: "grade",
    section: "grade",
    title: "A monsoon film look",
    titleMy: "မိုးရာသီ film ပုံစံ",
    note: "Graded once, applied across the whole set.",
    noteMy: "တစ်ခါ ညှိပြီး တစ်စုလုံးကို သုံး",
    aspect: 3 / 4,
    before: "/landing/showcase/grade-before.jpg",
    after: "/landing/showcase/grade-after.jpg",
    tone: { before: ["#9a9488", "#57524a"], after: ["#7fa3a0", "#2f4b52", "#0b1416"] },
  },
  {
    id: "baby",
    section: "baby",
    title: "Newborn, golden hour",
    titleMy: "မွေးကင်းစ၊ ရွှေရောင် ညနေ",
    note: "A themed set — the baby and the wrap untouched.",
    noteMy: "Theme နောက်ခံ — ကလေးနဲ့ ပတ်ထားတဲ့အထည် မထိ",
    aspect: 3 / 4,
    before: "/landing/showcase/baby-before.jpg",
    after: "/landing/showcase/baby-after.jpg",
    tone: { before: ["#bdb6ab", "#6d675e"], after: ["#f3cf8a", "#c98a5a", "#2a1a12"] },
  },
];

/** What each room actually does, beyond its one-line blurb. */
export const DETAILS: Record<SectionId, { en: string[]; my: string[] }> = {
  studio: {
    en: ["7 modes, ~960 choices", "Your photo + up to 6 references, numbered", "Refine with AI — never shortened"],
    my: ["Mode ၇ ခု · ရွေးစရာ ~၉၆၀", "ကိုယ့်ပုံ + reference ၆ ပုံ နံပါတ်တပ်", "AI refine — မတိုစေ"],
  },
  create: {
    en: ["Nano Banana Pro · GPT Image 2.5", "Edit with words and a reference", "Before / after, zoom to 800%"],
    my: ["Nano Banana Pro · GPT Image 2.5", "စကားနဲ့ + reference နဲ့ ပြင်", "Before / after · ၈၀၀% ချဲ့"],
  },
  reverse: {
    en: ["Measured on your device", "Every reading switchable", "Straight to Studio or Create"],
    my: ["ကိုယ့်စက်ပေါ်မှာ တိုင်း", "တစ်ခုချင်း ဖွင့်/ပိတ်", "Studio / Create ကို တန်းပို့"],
  },
  library: {
    en: ["Save, branch, version", "Word-level diff", "Open any version again"],
    my: ["သိမ်း · ခွဲ · version", "စကားလုံးချင်း ယှဉ်", "ဘယ် version မဆို ပြန်ဖွင့်"],
  },
  background: {
    en: ["Backdrop wall of 46", "Time-of-day slider", "Seed pinned — same frame again"],
    my: ["နောက်ခံ ၄၆ မျိုး", "နေ့အချိန် slider", "Seed တူ — ပုံတူ ပြန်ထွက်"],
  },
  harmonize: {
    en: ["Scene + person, no cut-out", "Face locked to their own photo", "Family Reunion"],
    my: ["နောက်ခံ + လူ · cut-out မလို", "မျက်နှာ မူရင်းပုံကနေပဲ", "မိသားစု ပြန်ဆုံ"],
  },
  restore: {
    en: ["AI repair — damage, faces, tears", "Colourise with chosen garment colours", "Living Memory: bring it to life"],
    my: ["AI ပြင် — ပျက်စီးတာ၊ မျက်နှာ၊ စုတ်ပြဲ", "ဝတ်စုံအရောင် ရွေးပြီး အရောင်သွင်း", "Living Memory — လှုပ်ရှားလာအောင်"],
  },
  baby: {
    en: ["32 themes", "Mood and light", "Parental consent first"],
    my: ["Theme ၃၂ မျိုး", "Mood နဲ့ အလင်း", "မိဘ ခွင့်ပြုချက် အရင်"],
  },
  grade: {
    en: ["AI regrade in one press", "Curves and live histogram on device", "Export a .cube LUT"],
    my: ["AI နဲ့ တစ်ချက်တည်း အရောင်ညှိ", "Device ပေါ်မှာ curve + histogram", ".cube LUT ထုတ်"],
  },
  batch: {
    en: ["One look across a shoot", "Series coherence check", "Auto-cull soft, clipped and burst frames"],
    my: ["Look တစ်ခု တစ်စုလုံး", "တစ်စုလုံး ညီမညီ စစ်", "ဝါးတာ၊ အလင်းလွန်တာ၊ ဆက်တိုက်ရိုက်တာ ဖယ်"],
  },
  album: {
    en: ["Invitations, covers, price lists", "Zawgyi → Unicode, Burmese digits", "Proper Burmese line breaks"],
    my: ["ဖိတ်စာ · cover · ဈေးနှုန်းစာရင်း", "Zawgyi → Unicode · မြန်မာဂဏန်း", "မြန်မာစာ စာကြောင်းခွဲ မှန်"],
  },
  event: {
    en: ["A QR gallery for every guest", "Live wall", "Print queue on the spot"],
    my: ["ဧည့်သည်တိုင်း QR gallery", "Live wall", "ပွဲမှာတင် print"],
  },
  work: {
    en: ["Everything auto-saved", "Private vault", "Nothing public by accident"],
    my: ["အကုန် အလိုအလျောက် သိမ်း", "ကိုယ်ပိုင် vault", "မတော်တဆ public မဖြစ်"],
  },
  portfolio: {
    en: ["A real public page", "Share card that renders", "Your own address"],
    my: ["တကယ့် public page", "Share လုပ်ရင် card ပေါ်", "ကိုယ်ပိုင် လိပ်စာ"],
  },
};

/** Things that run underneath every room. */
export const UNDERNEATH: { en: [string, string]; my: [string, string] }[] = [
  {
    en: ["The face stays the face", "Every edit is told what must not move — and the face is never the model's to invent."],
    my: ["မျက်နှာက မျက်နှာပဲ", "ပြင်တိုင်း ဘာမပြောင်းရဘူးဆိုတာ ပြောထားတယ် — မျက်နှာကို model က မဖန်တီးရ။"],
  },
  {
    en: ["References, numbered", "Image 1 is the photo to edit; every reference says exactly what to take from it."],
    my: ["Reference ကို နံပါတ်နဲ့", "ပုံ ၁ က ပြင်မယ့်ပုံ — reference တိုင်းက ဘာယူရမလဲ တိတိကျကျ ပြောထားတယ်။"],
  },
  {
    en: ["Burmese, understood", "Longyi, acheik, Thadingyut lamps — translated into what a model can actually see."],
    my: ["မြန်မာ အဓိပ္ပာယ်ကို နားလည်", "လုံချည်၊ အချိတ်၊ သီတင်းကျွတ် မီးထွန်း — model မြင်နိုင်တဲ့ စကားနဲ့ ပြန်ရေးထားတယ်။"],
  },
  {
    en: ["A free second way", "AI leads every fix; restore, grade, batch and measure also run free on your own phone or laptop — private, offline."],
    my: ["အခမဲ့ ဒုတိယ နည်းလမ်း", "ပြင်တိုင်း AI က ဦးဆောင်တယ် — restore၊ grade၊ batch၊ တိုင်းတာကို ကိုယ့်ဖုန်း/laptop ပေါ်မှာ အခမဲ့၊ ပုဂ္ဂလိက၊ offline နဲ့လည်း လုပ်လို့ရ။"],
  },
  {
    en: ["Before against after", "Every result opens at 50%, drags anywhere, zooms to 800% at the seam."],
    my: ["Before နဲ့ After ယှဉ်", "ရလဒ်တိုင်း 50% ကစ၊ ကြိုက်တဲ့နေရာ ဆွဲ၊ ၈၀၀% အထိ ချဲ့ကြည့်။"],
  },
  {
    en: ["Seeds you can read aloud", "Pin the seed and the same request makes the same frame next month."],
    my: ["ဖတ်လို့ရတဲ့ seed", "Seed တူရင် နောက်လမှာလည်း ပုံတူ ပြန်ထွက်။"],
  },
];
