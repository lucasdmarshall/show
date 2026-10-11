/* ------------------------------------------------------------------
   The whole surface, in SHOW's own order.

   Everything the benchmark can do has a home here, but grouped by what
   the photographer is trying to finish — direct it, fix it, deliver it
   — rather than presented as a wall of rooms to choose between.
   ------------------------------------------------------------------ */

export type SectionId =
  | "studio"
  | "create"
  | "reverse"
  | "library"
  | "background"
  | "harmonize"
  | "restore"
  | "baby"
  | "grade"
  | "batch"
  | "album"
  | "event"
  | "work"
  | "portfolio";

export type GroupId = "direct" | "fix" | "deliver";

export type SectionDef = {
  id: SectionId;
  label: string;
  labelMy: string;
  group: GroupId;
  /** Thin-stroke path, 24×24 box. */
  icon: string;
  blurb: string;
  blurbMy: string;
  tier: "free" | "device" | "premium";
  built: boolean;
};

export const GROUP_LABEL: Record<GroupId, { label: string; labelMy: string }> = {
  direct: { label: "Direct", labelMy: "ညွှန်ကြား" },
  fix: { label: "Fix", labelMy: "ပြင်ဆင်" },
  deliver: { label: "Deliver", labelMy: "ပို့ဆောင်" },
};

export const SECTIONS: SectionDef[] = [
  {
    id: "studio",
    label: "Studio",
    labelMy: "စတူဒီယို",
    group: "direct",
    icon: "M4 5h16M4 12h10M4 19h7",
    blurb: "Decide subject, wardrobe, light and frame — from nearly a thousand choices, or from your own photographs — and get one complete prompt.",
    blurbMy: "လူပုံ၊ ဝတ်စုံ၊ အလင်း၊ ဘောင်ကို ရွေးစရာ ၁,၀၀၀ နီးပါးထဲက ဒါမှမဟုတ် ကိုယ့်ဓာတ်ပုံတွေကနေ ဆုံးဖြတ်ပြီး prompt အပြည့်အစုံ တစ်ခု ရယူပါ။",
    tier: "free",
    built: true,
  },
  {
    id: "create",
    label: "Create",
    labelMy: "ပုံထုတ်",
    group: "direct",
    icon: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z",
    blurb: "Make the photograph itself — Nano Banana Pro or GPT Image 2.5 Sunburst — then edit it with words and a reference, and see before against after.",
    blurbMy: "ပုံကို တကယ်ထုတ်မယ် — Nano Banana Pro (သို့) GPT Image 2.5 Sunburst — ပြီးရင် စကားနဲ့၊ reference ပုံနဲ့ ပြင်ပြီး မပြင်ခင်/ပြင်ပြီး ယှဉ်ကြည့်မယ်။",
    tier: "premium",
    built: true,
  },
  {
    id: "reverse",
    label: "Reverse",
    labelMy: "ပြန်ထုတ်",
    group: "direct",
    icon: "M20 11a8 8 0 1 0-2.3 5.7M20 6v5h-5",
    blurb: "Drop a photograph in and read back the prompt that would make it — subject, wardrobe, light and frame as separate, editable parts.",
    blurbMy: "ဓာတ်ပုံတစ်ပုံ ထည့်လိုက်ရုံနဲ့ အဲဒါကို ထုတ်နိုင်မယ့် prompt ပြန်ရမယ် — လူပုံ၊ ဝတ်စုံ၊ အလင်း၊ ဘောင် တစ်ခုချင်း ခွဲပြီး ပြင်လို့ရအောင်။",
    tier: "free",
    built: true,
  },
  {
    id: "library",
    label: "Library",
    labelMy: "စာကြည့်တိုက်",
    group: "direct",
    icon: "M5 4v16M10 4v16M15.5 4.6l4 15.4",
    blurb: "Saved prompts, versioned. Branch one, compare two, keep what worked.",
    blurbMy: "သိမ်းထားတဲ့ prompt တွေ၊ version နဲ့။ တစ်ခုကို ခွဲထုတ်၊ နှစ်ခု နှိုင်းယှဉ်၊ အလုပ်ဖြစ်တာ ထားပါ။",
    tier: "free",
    built: true,
  },

  {
    id: "background",
    label: "Background",
    labelMy: "နောက်ခံ",
    group: "fix",
    icon: "M4 6h16v12H4zM4 15l4-4 4 4 3-3 5 5",
    blurb: "Replace the background while the face, the pose and the original pixels of the subject stay exactly as shot. Contact shadow solved from the ground plane, so it lands the same way every time.",
    blurbMy: "မျက်နှာ၊ pose နဲ့ subject ရဲ့ မူရင်း pixel တွေ အတိအကျ ကျန်ပြီး နောက်ခံပဲ ပြောင်းမယ်။ အရိပ်ကို ground plane ကနေ တွက်လို့ ထပ်ထုတ်တိုင်း တူတူ ကျမယ်။",
    tier: "premium",
    built: true,
  },
  {
    id: "harmonize",
    label: "Harmonize",
    labelMy: "ညှိနှိုင်း",
    group: "fix",
    icon: "M12 3a9 9 0 0 0 0 18 9 9 0 0 1 0-18M3 12h18",
    blurb: "Put someone into another photograph. The model places them and matches light, colour and shadow, taking the face only from their own photo — or reconcile a cut-out free on this device.",
    blurbMy: "လူတစ်ယောက်ကို တခြားပုံထဲ ထည့်မယ်။ AI က နေရာချပြီး အလင်း၊ အရောင်၊ အရိပ် ကိုက်အောင် လုပ်မယ် — မျက်နှာကို သူ့ပုံကနေပဲ ယူတယ်။ ဖုန်းပေါ်မှာ အခမဲ့ ညှိတာလည်း ရှိတယ်။",
    tier: "premium",
    built: true,
  },
  {
    id: "restore",
    label: "Restore",
    labelMy: "ပြန်လည်ပြုပြင်",
    group: "fix",
    icon: "M4 20V6a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2zM14 4v6h6M8 15l3-3 3 3",
    blurb: "AI repairs scratches, tears and fading and brings faces back, keeping the likeness. Colourise it, or bring it to life — or repair it free on your own device.",
    blurbMy: "AI က ခြစ်ရာ၊ စုတ်ပြဲ၊ မှေးမှိန်မှုကို ပြင်ပြီး မျက်နှာ ပြန်ကြည်အောင် လုပ်မယ် — မူရင်းအတိုင်း။ အရောင်ထည့်တာ၊ ရွေ့လာစေတာ ရတယ်၊ ကိုယ့် device ပေါ်မှာ အခမဲ့ ပြင်တာလည်း ရ။",
    tier: "premium",
    built: true,
  },
  {
    id: "baby",
    label: "Baby",
    labelMy: "ကလေး",
    group: "fix",
    icon: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16M9 11h.01M15 11h.01M9.5 15a3.5 3.5 0 0 0 5 0",
    blurb: "Themed backdrops and lighting for a newborn session, with the face, the wrap and everyone holding the baby left alone.",
    blurbMy: "ကလေးပုံအတွက် theme နောက်ခံနဲ့ အလင်း — မျက်နှာ၊ အနှီး၊ ပိုက်ထားသူတွေကို မထိဘဲ။",
    tier: "premium",
    built: true,
  },
  {
    id: "grade",
    label: "Grade",
    labelMy: "အရောင်ညှိ",
    group: "fix",
    icon: "M4 20L20 4M4 14v6h6M14 4h6v6",
    blurb: "Pick a look and AI regrades the colour and tone, leaving every face and object as shot. Curves, a live histogram and .cube export on your own device too.",
    blurbMy: "Look တစ်ခု ရွေးရင် AI က အရောင်နဲ့ အလင်းအမှောင် ညှိပေးမယ် — မျက်နှာနဲ့ ပုံထဲက အရာအားလုံး မူရင်းအတိုင်း။ ကိုယ့် device ပေါ်မှာ curve၊ histogram၊ .cube ထုတ်တာလည်း ရ။",
    tier: "premium",
    built: true,
  },
  {
    id: "batch",
    label: "Batch",
    labelMy: "အစုလိုက်",
    group: "fix",
    icon: "M8 4h12v12M4 8h12v12H4z",
    blurb: "Tune one frame, save the look, apply it across the whole shoot — then check which frames drifted away from it.",
    blurbMy: "တစ်ပုံ ညှိ၊ look သိမ်း၊ shoot တစ်ခုလုံး သက်ရောက် — ပြီးရင် ဘယ်ပုံတွေ ကွဲနေလဲ ပြန်စစ်ပေးမယ်။",
    tier: "device",
    built: true,
  },

  {
    id: "album",
    label: "Album",
    labelMy: "အယ်လ်ဘမ်",
    group: "deliver",
    icon: "M4 5h7v14H4zM13 5h7v14h-7M6.5 9h2M15.5 9h2",
    blurb: "Spreads, covers, invitations and price lists — with Burmese type set properly, which no image model can do.",
    blurbMy: "Spread၊ မျက်နှာဖုံး၊ ဖိတ်စာ၊ ဈေးနှုန်းစာရင်း — မြန်မာစာကို မှန်မှန်ကန်ကန် စီပေးမယ်။ ဒါကို ဘယ် image model မှ မလုပ်နိုင်ဘူး။",
    tier: "premium",
    built: true,
  },
  {
    id: "event",
    label: "Event",
    labelMy: "ပွဲ",
    group: "deliver",
    icon: "M14.5 5h-5L7 8H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-3zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7",
    blurb: "Photographs in your guests' hands before they leave — a private gallery each, a live wall, prints on the spot.",
    blurbMy: "ဧည့်သည်တွေ မပြန်ခင် ပုံရအောင် — တစ်ယောက်စီ gallery၊ live wall၊ နေရာမှာတင် print။",
    tier: "premium",
    built: true,
  },
  {
    id: "work",
    label: "Work",
    labelMy: "အလုပ်",
    group: "deliver",
    icon: "M4 6h16v12H4zM4 14l4.5-4.5L14 15l2.5-2.5L20 16",
    blurb: "Everything you have made, held privately until you decide otherwise.",
    blurbMy: "လုပ်ထားသမျှ — ကိုယ်မဆုံးဖြတ်မချင်း သီးသန့် သိမ်းထားမယ်။",
    tier: "free",
    built: true,
  },
  {
    id: "portfolio",
    label: "Portfolio",
    labelMy: "ပြခန်း",
    group: "deliver",
    icon: "M3 7h18v13H3zM8 7V4h8v3M3 13h18",
    blurb: "A real public page at your own address, with a card that renders when it is shared.",
    blurbMy: "ကိုယ်ပိုင်လိပ်စာနဲ့ တကယ့် public စာမျက်နှာ — share လုပ်ရင် card ပေါ်လာမယ်။",
    tier: "free",
    built: true,
  },
];

/** What the phone's bottom bar holds; everything else lives behind More. */
export const PRIMARY: SectionId[] = ["studio", "create", "library", "work"];

export const getSection = (id: SectionId): SectionDef =>
  SECTIONS.find((s) => s.id === id) ?? SECTIONS[0];
