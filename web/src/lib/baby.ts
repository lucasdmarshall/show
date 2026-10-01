/* ------------------------------------------------------------------
   Baby — themed sets for a newborn session.

   Every theme describes the set, not the baby: the baby, the wrap and
   the hands holding them come from the photograph and stay as they are.
   Each carries what the family should expect to see, in both languages,
   because a parent choosing a theme is not reading a prompt.
   ------------------------------------------------------------------ */

export type BabyCat = "studio" | "natural" | "myanmar";

export type Theme = {
  id: string;
  label: string;
  labelMy: string;
  cat: BabyCat;
  descriptor: string;
  detail: string;
  detailMy: string;
  palette: [string, string, string];
};

export const BABY_CATS: { id: BabyCat; label: string; labelMy: string }[] = [
  { id: "studio", label: "Studio", labelMy: "စတူဒီယို" },
  { id: "natural", label: "Natural", labelMy: "သဘာဝ" },
  { id: "myanmar", label: "Myanmar", labelMy: "မြန်မာ" },
];

const t = (
  id: string,
  label: string,
  labelMy: string,
  cat: BabyCat,
  descriptor: string,
  detail: string,
  detailMy: string,
  palette: [string, string, string],
): Theme => ({ id, label, labelMy, cat, descriptor, detail, detailMy, palette });

export const THEMES: Theme[] = [
  /* studio */
  t("cloud", "Cloud nest", "တိမ်အိပ်ရာ", "studio", "sleeping on a soft white cloud-like nest of wool, pale sky-blue backdrop, tiny paper stars", "The baby asleep on a white wool cloud, pale blue behind, a few paper stars.", "ကလေးက တိမ်လို ဖြူဖွေးတဲ့ သိုးမွှေးအိပ်ရာပေါ် အိပ်နေ၊ နောက်ခံ အပြာနု၊ စက္ကူကြယ်လေးတွေ။", ["#e3f2fd", "#ffffff", "#bbdefb"]),
  t("moon", "Crescent moon", "လခြမ်း", "studio", "curled on a crescent moon prop wrapped in knit fabric, deep navy backdrop with soft bokeh stars", "Curled on a knitted crescent moon against a night-blue sky of soft stars.", "ချည်ထိုး လခြမ်းပေါ် ကွေးကွေးလေး၊ ကြယ်ရောင် ဝိုးဝါး ညကောင်းကင် နောက်ခံ။", ["#1a2a4a", "#f1e3b5", "#2d4373"]),
  t("basket", "Woven basket", "ခြင်းတောင်း", "studio", "nestled in a small woven rattan basket lined with cream knit, warm neutral backdrop", "Tucked in a rattan basket on cream knit, all warm neutrals.", "ကြိမ်ခြင်းလေးထဲ ခရမ်ချဉ်ဖျော့ ချည်ထည်ပေါ်မှာ၊ နွေးနွေးလေး အရောင်တွေ။", ["#f3e5d0", "#c8a27a", "#e9dcc9"]),
  t("floral", "Flower bed", "ပန်းအိပ်ရာ", "studio", "lying on a bed of fresh pastel flowers, roses and baby's breath, top-down view", "Seen from above on a bed of pastel roses and baby's breath.", "အပေါ်စီးကနေ — ပန်းနုရောင် နှင်းဆီ၊ ပန်းဖြူလေးတွေ အိပ်ရာပေါ်မှာ။", ["#ffe5ec", "#ffc2d1", "#f8f9fa"]),
  t("teddy", "Teddy picnic", "ဝက်ဝံရုပ် picnic", "studio", "beside a small teddy bear on a gingham picnic blanket, soft daylight studio", "Next to a small teddy on a checked picnic blanket.", "ကွက်စိပ် picnic ဖျာပေါ်မှာ ဝက်ဝံရုပ်လေးနဲ့ အတူ။", ["#fdf0d5", "#c1121f", "#f5ebe0"]),
  t("bubble", "Bubble bath", "ဆပ်ပြာပူဖောင်း", "studio", "in a tiny vintage washtub with soft foam bubbles, pastel mint backdrop", "In a little vintage tub of foam, mint behind.", "ရေချိုးကန်ငယ်လေးထဲ ဆပ်ပြာပူဖောင်းတွေနဲ့၊ မင့်စိမ်းနု နောက်ခံ။", ["#d8f3dc", "#ffffff", "#b7e4c7"]),
  t("chef", "Little baker", "မုန့်ဖုတ်သူလေး", "studio", "a tiny chef's hat, wooden spoon and flour-dusted board, warm kitchen tones", "Chef's hat and a flour-dusted board, warm kitchen colours.", "စားဖိုမှူး ဦးထုပ်လေး၊ ဂျုံမှုန့်ဖြူးထားတဲ့ ပျဉ်ပြားနဲ့။", ["#fefae0", "#dda15e", "#bc6c25"]),
  t("balloon", "Balloon float", "ပူဖောင်းပျံ", "studio", "appearing to float beneath a cluster of pastel balloons, clean white backdrop", "Seeming to float under a bunch of pastel balloons.", "ပူဖောင်းပန်းနုရောင်တွေ အောက်မှာ ပျံနေသလိုလို။", ["#ffffff", "#ffc8dd", "#bde0fe"]),
  t("book", "Storybook", "ပုံပြင်စာအုပ်", "studio", "sleeping on an open giant storybook, pages curling, soft library light", "Asleep across the pages of an open giant storybook.", "ကြီးမားတဲ့ ပုံပြင်စာအုပ် စာမျက်နှာပေါ် အိပ်ပျော်နေ။", ["#f5ebe0", "#8d6e63", "#d7ccc8"]),
  t("gold-studio", "Gold & cream", "ရွှေနဲ့ ခရမ်ချဉ်ဖျော့", "studio", "cream silk wrap on a gold-toned textured backdrop, elegant fine-art newborn lighting", "Fine-art: cream silk against a gold-toned backdrop.", "Fine-art ပုံစံ — ရွှေရောင် နောက်ခံပေါ် ခရမ်ချဉ်ဖျော့ ပိုးထည်။", ["#f0c75e", "#fbf3e0", "#b8862b"]),
  t("black-art", "Black fine-art", "အနက် fine-art", "studio", "on a black velvet backdrop with one soft window light, dramatic chiaroscuro newborn portrait", "One soft light on black velvet — dramatic, painterly.", "အနက်ရောင် ကတ္တီပါပေါ် အလင်းတစ်ခုတည်း — ပန်းချီကားလို။", ["#0a0a0a", "#f2efe9", "#1c1c1c"]),
  t("rainbow", "Rainbow wrap", "သက်တံ့", "studio", "on layered rainbow-coloured knit wraps arranged in arcs, bright cheerful studio", "On knit wraps in rainbow arcs — bright and cheerful.", "သက်တံ့ရောင် ချည်ထည်တွေ အဆင့်လိုက် စီထားတဲ့ပေါ်မှာ။", ["#ff595e", "#ffca3a", "#1982c4"]),
  /* natural */
  t("garden", "Morning garden", "မနက်ခင်း ဥယျာဉ်", "natural", "in a garden at soft morning light, dew on leaves, blurred flowers behind", "Soft morning garden light, dew and blurred flowers.", "မနက်ခင်း ဥယျာဉ်ထဲ၊ နှင်းစက်တွေ၊ နောက်မှာ ပန်းတွေ ဝိုးဝါး။", ["#d8f3dc", "#95d5b2", "#fefae0"]),
  t("window", "Window light", "ပြတင်းပေါက် အလင်း", "natural", "on a white bed by a large window, gentle natural side light, airy home interior", "White bed by a big window — simple, airy, real home light.", "ပြတင်းပေါက်ကြီးဘေး ကုတင်ဖြူပေါ်၊ အိမ်တွင်း သဘာဝအလင်း။", ["#ffffff", "#f1f1f1", "#e0e0e0"]),
  t("field", "Flower field", "ပန်းခင်း", "natural", "in a field of small wildflowers at golden hour, warm backlight", "Wildflowers at golden hour, warm light from behind.", "ရွှေရောင် ညနေခင်း တောပန်းခင်းထဲ၊ နောက်ကနေ အလင်းနွေး။", ["#ffd6a5", "#f4a261", "#90a955"]),
  t("beach", "Beach morning", "ကမ်းခြေ မနက်", "natural", "on a soft blanket on pale sand, calm sea behind, early morning light", "A blanket on pale sand with a calm sea behind.", "သဲဖြူပေါ် စောင်လေးနဲ့၊ နောက်မှာ ပင်လယ် ငြိမ်ငြိမ်လေး။", ["#caf0f8", "#f1e3c6", "#90e0ef"]),
  t("forest", "Forest moss", "တောအုပ်", "natural", "on a bed of green moss in a quiet forest, dappled sunlight", "Green moss and dappled forest light.", "တောအုပ်ထဲ ရေညှိစိမ်းပေါ်မှာ၊ သစ်ရွက်ကြားက အလင်းစက်တွေ။", ["#52796f", "#84a98c", "#cad2c5"]),
  t("rain", "Monsoon window", "မိုးရာသီ ပြတင်း", "natural", "sleeping by a rain-streaked window during the monsoon, cosy blankets, cool soft light", "Asleep by a rainy window in the monsoon, cosy and soft.", "မိုးရွာနေတဲ့ ပြတင်းဘေး စောင်နွေးနွေးနဲ့ အိပ်ပျော်နေ။", ["#8ecae6", "#e9ecef", "#adb5bd"]),
  t("paddy", "Paddy edge", "လယ်ကန်သင်း", "natural", "in a woven basket at the edge of green rice paddies, soft overcast light", "A basket at the edge of green paddies, soft overcast.", "လယ်ကွင်းစိမ်းအနား ခြင်းတောင်းလေးထဲ၊ တိမ်ဖုံး အလင်းနူးနူး။", ["#d8f3dc", "#74c69d", "#f5ebe0"]),
  t("lotus", "Lotus pond", "ကြာကန်", "natural", "beside a lotus pond with pink blooms and wide leaves, gentle reflections", "Beside a lotus pond, pink blooms and wide leaves.", "ကြာပန်းပန်းရောင်တွေ၊ ကြာရွက်ကြီးတွေရှိတဲ့ ကြာကန်ဘေး။", ["#ffd6e0", "#80b192", "#b8e0d2"]),
  t("sunset", "Sunset glow", "နေဝင်ချိန်", "natural", "in a parent's arms silhouetted against a warm sunset, rim light on the hair", "In arms against a warm sunset, a glow along the hair.", "မိဘလက်ထဲမှာ နေဝင်ချိန် နောက်ခံနဲ့၊ ဆံပင်ပေါ် အလင်းရောင်။", ["#f4845f", "#f7b267", "#6d597a"]),
  t("snow", "Winter white", "ဆောင်းတွင်း", "natural", "wrapped warm in a snowy pine landscape, soft falling snow, cool white light", "Wrapped warm in soft falling snow among pines.", "ထင်းရှူးပင်တွေကြား နှင်းကျနေတဲ့ နေရာမှာ နွေးနွေးထွေးထွေး။", ["#f8f9fa", "#dee2e6", "#6c757d"]),
  /* myanmar */
  t("naming", "Naming day", "ကင်ပွန်းတပ်", "myanmar", "a traditional Burmese naming ceremony, gold offering trays, jasmine and eugenia leaves, a silk cushion", "A naming-day set: gold trays, jasmine and eugenia on silk.", "ကင်ပွန်းတပ် မင်္ဂလာ — ရွှေဖလား၊ စံပယ်နဲ့ သပြေခက်၊ ပိုးဖျာပေါ်မှာ။", ["#fcbf49", "#ffffff", "#2a9d8f"]),
  t("first-bday", "First birthday", "နှစ်ပတ်လည် မွေးနေ့", "myanmar", "a first-birthday set with a small Burmese-style cake, gold paper decorations and a longyi-print backdrop", "First birthday: a small cake, gold paper, longyi-print behind.", "တစ်နှစ်ပြည့် — ကိတ်မုန့်လေး၊ ရွှေစက္ကူ အလှဆင်၊ လုံချည်ကွက် နောက်ခံ။", ["#ffe8d6", "#d4a22f", "#9d0208"]),
  t("tiny-longyi", "Tiny longyi", "လုံချည်လေး", "myanmar", "dressed in a tiny silk longyi and eingyi, on a woven bamboo mat", "In a tiny silk longyi and eingyi on a bamboo mat.", "ပိုးလုံချည်လေး၊ အင်္ကျီလေးနဲ့ ဝါးဖျာပေါ်မှာ။", ["#e9c46a", "#9b2226", "#f4f1de"]),
  t("thingyan-baby", "Thingyan baby", "သင်္ကြန် ကလေး", "myanmar", "a Thingyan set with padauk flowers, a silver water bowl and soft water sparkle", "Thingyan: padauk flowers, a silver bowl, sparkling water.", "သင်္ကြန် — ပိတောက်ပန်း၊ ငွေဖလား၊ ရေစက်လေးတွေ တောက်ပ။", ["#fff3b0", "#e09f3e", "#caf0f8"]),
  t("lamps", "Thadingyut lamps", "သီတင်းကျွတ် မီးအိမ်", "myanmar", "surrounded by small clay oil lamps glowing warmly, dark background, Thadingyut night", "Among small glowing clay lamps on a Thadingyut night.", "သီတင်းကျွတ်ည — မြေမီးခွက်လေးတွေ ဝင်းဝင်းလက်နေကြားမှာ။", ["#1b263b", "#fca311", "#e76f51"]),
  t("lacquer-cradle", "Lacquer cradle", "ယွန်းပုခက်", "myanmar", "in a red-and-black Bagan lacquerware cradle with fine gold patterns", "In a red-and-black Bagan lacquer cradle, gold patterned.", "ပုဂံ ယွန်းထည် ပုခက်နီနက်လေးထဲ၊ ရွှေဒီဇိုင်းတွေနဲ့။", ["#7f1d1d", "#1c1917", "#d4a22f"]),
  t("jasmine", "Jasmine garland", "စံပယ်ပန်းကုံး", "myanmar", "on white muslin with strings of fresh jasmine arranged around, soft morning light", "White muslin, strands of fresh jasmine all around.", "ပိတ်ဖြူပေါ်မှာ စံပယ်ပန်းကုံးလေးတွေ ပတ်လည်။", ["#ffffff", "#f1faee", "#a8dadc"]),
  t("pagoda-dawn", "Pagoda dawn", "ဘုရား မနက်", "myanmar", "in a parent's arms at dawn with a golden stupa softly out of focus behind", "In arms at dawn, a golden stupa soft behind.", "အရုဏ်တက်ချိန် မိဘလက်ထဲ၊ နောက်မှာ ရွှေစေတီ ဝိုးဝါး။", ["#f6a36b", "#d4a22f", "#fbd5a5"]),
  t("thanaka", "Thanaka cheeks", "သနပ်ခါး", "myanmar", "with delicate thanaka circles on the cheeks, cream wrap, warm neutral backdrop", "Soft thanaka circles on the cheeks, cream and warm.", "ပါးပေါ် သနပ်ခါး ဝိုင်းလေးတွေ၊ ခရမ်ချဉ်ဖျော့ အနှီးနဲ့။", ["#f3e5d0", "#e0c097", "#fff8e7"]),
  t("hsaing", "Little musician", "ပတ္တလား", "myanmar", "beside a miniature Burmese harp and pattala, warm teak tones", "Next to a miniature Burmese harp and pattala, warm teak.", "စောင်းကောက်လေး၊ ပတ္တလားလေးဘေးမှာ၊ ကျွန်းရောင် နွေးနွေး။", ["#6f4518", "#d4a22f", "#a47148"]),
];
