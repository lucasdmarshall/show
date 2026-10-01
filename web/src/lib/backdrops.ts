/* ------------------------------------------------------------------
   The Backdrop Wall — Myanmar's places, as a model can read them.

   No image model has been told what Shwedagon looks like at dusk from
   the eastern stairway, or what U Bein's teak posts do to low water.
   Each place carries that description; each also carries three colours,
   so the wall can be browsed by eye before anything is generated.
   ------------------------------------------------------------------ */

export type BackdropCat = "heritage" | "nature" | "city" | "ceremony" | "season" | "studio";

export type Backdrop = {
  id: string;
  label: string;
  labelMy: string;
  cat: BackdropCat;
  descriptor: string;
  /** sky / middle / ground, for the card */
  palette: [string, string, string];
  /** outdoors, so the time of day applies */
  outdoor: boolean;
};

export const CATS: { id: BackdropCat; label: string; labelMy: string }[] = [
  { id: "heritage", label: "Heritage", labelMy: "ယဉ်ကျေးမှု အမွေ" },
  { id: "nature", label: "Nature", labelMy: "သဘာဝ" },
  { id: "city", label: "City", labelMy: "မြို့" },
  { id: "ceremony", label: "Ceremony", labelMy: "ပွဲလမ်း" },
  { id: "season", label: "Seasons", labelMy: "ရာသီ" },
  { id: "studio", label: "Studio", labelMy: "စတူဒီယို" },
];

const b = (
  id: string,
  label: string,
  labelMy: string,
  cat: BackdropCat,
  descriptor: string,
  palette: [string, string, string],
  outdoor = true,
): Backdrop => ({ id, label, labelMy, cat, descriptor, palette, outdoor });

export const BACKDROPS: Backdrop[] = [
  /* heritage */
  b("shwedagon", "Shwedagon terrace", "ရွှေတိဂုံ ရင်ပြင်", "heritage", "the marble terrace of Shwedagon Pagoda, the gilded main stupa rising behind, smaller gold spires and hanging bells, polished floor reflecting", ["#e9c46a", "#b8862b", "#d9d2c5"]),
  b("bagan", "Bagan plains", "ပုဂံ", "heritage", "the Bagan plain dotted with hundreds of ancient brick temples, dusty red earth, palms, distant stupas fading into haze", ["#f2b880", "#a0522d", "#c8a27a"]),
  b("bagan-balloon", "Bagan with balloons", "ပုဂံ မိုးပျံပူဖောင်း", "heritage", "Bagan temple spires at sunrise with hot-air balloons drifting low over the plain", ["#f7c59f", "#c1440e", "#7a5c3e"]),
  b("mandalay-moat", "Mandalay palace moat", "မန္တလေး နန်းကျုံး", "heritage", "the long red-brick wall and moat of Mandalay Palace, a carved wooden pyatthat tower reflected in still water", ["#a8c5da", "#9b3d2e", "#5f7f6a"]),
  b("kuthodaw", "Kuthodaw stupas", "ကုသိုလ်တော် ဘုရား", "heritage", "rows of small white stupas of Kuthodaw Pagoda receding in perfect lines, gold finials, shaded walkways", ["#f5f1e6", "#e0d6bf", "#c9a45c"]),
  b("mrauk-u", "Mrauk U", "မြောက်ဦး", "heritage", "the dark stone temples of Mrauk U on green hills, low morning mist between them", ["#b7c4b0", "#4c5a4a", "#6d6a5c"]),
  b("golden-rock", "Golden Rock", "ကျိုက်ထီးရိုး", "heritage", "Kyaiktiyo, the gilded boulder balanced on the cliff edge, mountains falling away behind in blue layers", ["#8fb3d9", "#d4a22f", "#5d6b7a"]),
  b("teak-monastery", "Teak monastery", "ကျွန်းကျောင်း", "heritage", "the carved dark-teak halls of Shwenandaw Monastery, intricate wooden panels, warm shafts of light", ["#4a3222", "#7a5230", "#2c1d13"], false),
  b("sule", "Sule Pagoda", "ဆူးလေ ဘုရား", "heritage", "Sule Pagoda glowing gold at the centre of a Yangon roundabout, colonial buildings around it", ["#e5b567", "#c98a2b", "#8a7a66"]),
  /* nature */
  b("inle", "Inle Lake", "အင်းလေးကန်", "nature", "Inle Lake, a leg-rowing Intha fisherman with a conical net on glassy water, blue mountains beyond", ["#b9d3e0", "#6e8fa3", "#3d5a6c"]),
  b("ubein", "U Bein Bridge", "ဦးပိန် တံတား", "nature", "U Bein teak bridge stretching across Taungthaman Lake, silhouetted posts, still water", ["#f4a261", "#6d4c3d", "#2f3e46"]),
  b("ngapali", "Ngapali beach", "ငပလီ", "nature", "Ngapali beach, pale sand, turquoise water, fishing boats pulled up under coconut palms", ["#9ad1d4", "#f2e2c4", "#e9d8a6"]),
  b("ngwe-saung", "Ngwe Saung shore", "ငွေဆောင်", "nature", "a long empty silver-sand beach at Ngwe Saung, soft surf, pale sky", ["#cfe3ea", "#e8e3d3", "#d8cfb6"]),
  b("hpa-an", "Hpa-An karsts", "ဘားအံ", "nature", "limestone karst peaks rising from green rice paddies near Hpa-An, a small monastery at the foot", ["#c7d9b7", "#5b7553", "#8faa6c"]),
  b("kalaw", "Kalaw pine forest", "ကလော ထင်းရှူး", "nature", "a cool pine forest in the Kalaw hills, filtered light, needles on the ground", ["#a3b18a", "#3a5a40", "#6b705c"]),
  b("popa", "Mount Popa", "ပုပ္ပါး", "nature", "Taung Kalat monastery perched on its volcanic plug above Mount Popa, a lone gold stupa", ["#dfe7ea", "#7d8f69", "#c9a45c"]),
  b("putao", "Putao snow peaks", "ပူတာအို", "nature", "snow-capped Himalayan peaks above Putao, clear alpine light, rough grass", ["#dbe9f4", "#ffffff", "#6c8b74"]),
  b("mergui", "Mergui islands", "မြိတ်ကျွန်းစု", "nature", "a tiny island in the Mergui Archipelago, emerald jungle, clear shallows, a Moken boat", ["#48cae4", "#2d6a4f", "#f1e3c6"]),
  b("paddy", "Rice fields", "လယ်ကွင်း", "nature", "endless green rice paddies, water buffalo, a single toddy palm, farm huts", ["#d8f3dc", "#74c69d", "#52796f"]),
  /* city */
  b("yangon-street", "Colonial Yangon", "ရန်ကုန် ကိုလိုနီ လမ်း", "city", "a downtown Yangon street of peeling colonial facades, green shutters, hanging wires, street vendors", ["#e9d8a6", "#bc8a5f", "#6c584c"]),
  b("strand", "Strand lobby", "စထရင်း ဟိုတယ်", "city", "the high-ceilinged colonial lobby of the Strand Hotel, teak and marble, slow ceiling fans", ["#f5ebe0", "#c8b6a6", "#7f5539"], false),
  b("bogyoke", "Bogyoke market", "ဗိုလ်ချုပ်ဈေး", "city", "the vaulted corridors of Bogyoke Aung San Market, stalls of silk and jade", ["#f4d35e", "#b56576", "#6d597a"], false),
  b("yangon-river", "Yangon river", "ရန်ကုန်မြစ်", "city", "the Yangon River waterfront with ferries and cargo ships, city lights coming on", ["#ffb4a2", "#6d6875", "#264653"]),
  b("chinatown", "Chinatown night", "တရုတ်တန်း ည", "city", "Yangon Chinatown at night, 19th Street, red lanterns, grill smoke, neon", ["#370617", "#d00000", "#ffba08"]),
  b("tea-shop", "Tea shop", "လက်ဖက်ရည်ဆိုင်", "city", "a busy Burmese tea shop, low plastic stools, steel teapots, morning steam", ["#f6bd60", "#84a59d", "#6b4f3a"], false),
  b("rooftop", "Rooftop at dusk", "ခေါင်မိုးပေါ် ညနေ", "city", "a modern rooftop terrace over the Yangon skyline, Shwedagon lit gold on the horizon", ["#ffcdb2", "#6d597a", "#355070"]),
  /* ceremony */
  b("wedding-gold", "Golden wedding stage", "ရွှေရောင် မင်္ဂလာ စင်", "ceremony", "a Burmese wedding stage of gold-carved panels, jasmine and white orchid garlands, a velvet throne seat", ["#fbe7c6", "#d4a22f", "#8a1c1c"], false),
  b("wedding-white", "Modern white wedding", "ခေတ်မီ အဖြူ မင်္ဂလာ", "ceremony", "a modern white wedding hall, cascading white flowers, warm fairy lights, glossy floor", ["#ffffff", "#f1e9da", "#e4d4b8"], false),
  b("ballroom", "Hotel ballroom", "Ballroom", "ceremony", "a grand hotel ballroom, crystal chandeliers, gold chairs, soft uplighting", ["#f8edeb", "#c9ada7", "#9a8c98"], false),
  b("shinbyu", "Shinbyu pavilion", "ရှင်ပြု မဏ္ဍပ်", "ceremony", "a decorated shinbyu novitiation pavilion, tiered gold umbrellas, embroidered drapes", ["#fcbf49", "#d62828", "#003049"]),
  b("nat-thit", "Ear-boring ceremony", "နားသ မင်္ဂလာ", "ceremony", "a traditional ear-boring ceremony set, gold platform, silk canopy, offering trays", ["#ffe8d6", "#cb997e", "#6b705c"], false),
  b("graduation", "Graduation hall", "ဘွဲ့နှင်းသဘင်", "ceremony", "a university convocation hall with stage and flags, formal and bright", ["#edf2f4", "#8d99ae", "#2b2d42"], false),
  b("donation", "Monastery offering", "ဆွမ်းကျွေး", "ceremony", "a monastery hall prepared for a soon-kyway alms offering, rows of lacquer bowls, saffron robes", ["#f77f00", "#fcbf49", "#6a4c93"], false),
  /* seasons */
  b("thingyan", "Thingyan pandal", "သင်္ကြန် မဏ္ဍပ်", "season", "a Thingyan water festival pandal, water hoses spraying arcs of glittering droplets, padauk flowers", ["#caf0f8", "#f9c74f", "#43aa8b"]),
  b("thadingyut", "Thadingyut lights", "သီတင်းကျွတ် မီးထွန်း", "season", "Thadingyut festival of lights, thousands of small oil lamps along a stupa terrace, paper lanterns", ["#1b263b", "#fca311", "#e76f51"]),
  b("tazaungdaing", "Taunggyi balloons", "တောင်ကြီး မီးပုံးပျံ", "season", "the Taunggyi Tazaungdaing festival, fire balloons rising into a night sky, sparks trailing", ["#0b132b", "#ff7b00", "#ffb700"]),
  b("waso", "Waso rain", "ဝါဆို မိုး", "season", "a monsoon Waso afternoon, rain curtains on a teak monastery veranda, wet stone, green everywhere", ["#8ecae6", "#219ebc", "#606c38"]),
  b("padauk", "Padauk in bloom", "ပိတောက်ပွင့်", "season", "a padauk tree in full golden bloom at the start of the new year, petals falling", ["#fff3b0", "#e09f3e", "#9e2a2b"]),
  b("new-year", "New Year's Eve", "နှစ်သစ်ကူး", "season", "a New Year's Eve fireworks sky over the city, bokeh of lights", ["#03045e", "#7209b7", "#f72585"]),
  /* studio */
  b("seamless-grey", "Grey seamless", "မီးခိုးရောင် နောက်ခံ", "studio", "a mottled grey hand-painted canvas backdrop, classic portrait studio", ["#8d8d8d", "#6b6b6b", "#4a4a4a"], false),
  b("seamless-black", "Black velvet", "အနက် ကတ္တီပါ", "studio", "deep black velvet backdrop, no visible texture", ["#111111", "#0a0a0a", "#000000"], false),
  b("seamless-warm", "Warm paper", "နွေးသော စက္ကူ", "studio", "warm cream seamless paper backdrop, soft gradient falloff", ["#f7e8d0", "#e9d5b6", "#d4bc94"], false),
  b("gold-drape", "Gold silk drape", "ရွှေ ပိုးကန့်လန့်ကာ", "studio", "heavy gold silk drapery in folds, subtle sheen", ["#f0c75e", "#b8862b", "#7a5a17"], false),
  b("lacquer", "Lacquer panel", "ယွန်းထည် နံရံ", "studio", "a wall of Bagan red-and-black lacquerware panels with fine incised patterns", ["#7f1d1d", "#1c1917", "#b45309"], false),
  b("garden-arch", "Flower arch", "ပန်းမုခ်", "studio", "a studio flower arch of roses and jasmine against a soft pastel wall", ["#ffe5ec", "#ffb3c6", "#fb6f92"], false),
  b("library", "Old library", "စာကြည့်တိုက် ဟောင်း", "studio", "shelves of old leather-bound books, green reading lamp, dark wood", ["#3c2f2f", "#7f5539", "#b08968"], false),
];

/* -- time of day: one slider instead of a list -------------------- */

type Key = { t: number; en: string; my: string; d: string; sky: [string, string] };

const KEYS: Key[] = [
  { t: 0, en: "Before dawn", my: "အရုဏ်မတက်မီ", d: "blue hour before dawn, deep cobalt sky, the first pale light on the horizon", sky: ["#0b1d3a", "#39527a"] },
  { t: 0.16, en: "Sunrise", my: "နေထွက်", d: "sunrise, low warm sun at the horizon, long soft shadows, mist in the low ground", sky: ["#f6a36b", "#fbd5a5"] },
  { t: 0.32, en: "Morning", my: "မနက်ခင်း", d: "clear morning light, fresh and slightly cool, sun at forty degrees", sky: ["#8ec5ff", "#e2f0ff"] },
  { t: 0.5, en: "Noon", my: "မွန်းတည့်", d: "high noon sun, short hard shadows, bright saturated colour", sky: ["#4f9ee8", "#bfe0ff"] },
  { t: 0.66, en: "Afternoon", my: "နေ့လယ်ခင်း", d: "warm afternoon light, sun lowering, shadows lengthening", sky: ["#79b4e6", "#f5e6c8"] },
  { t: 0.8, en: "Golden hour", my: "ရွှေရောင်အချိန်", d: "golden hour, low amber sun behind the subject, glowing rim light, long shadows", sky: ["#f7b267", "#f4845f"] },
  { t: 0.9, en: "Dusk", my: "နေဝင်ဆည်းဆာ", d: "dusk after sunset, magenta and violet sky, lights beginning to glow", sky: ["#7b4b94", "#e07a5f"] },
  { t: 1, en: "Night", my: "ည", d: "night, lit by warm practical lamps and the city, deep blue sky", sky: ["#050a1c", "#1d2d50"] },
];

const mix = (a: string, c: string, t: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a);
  const C = p(c);
  return `#${A.map((v, i) => Math.round(v + (C[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
};

export function timeOfDay(t: number) {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].t < t) i++;
  const a = KEYS[i];
  const c = KEYS[i + 1];
  const f = Math.max(0, Math.min(1, (t - a.t) / (c.t - a.t)));
  const near = f < 0.5 ? a : c;
  return {
    label: near.en,
    labelMy: near.my,
    descriptor: near.d,
    sky: [mix(a.sky[0], c.sky[0], f), mix(a.sky[1], c.sky[1], f)] as [string, string],
  };
}
