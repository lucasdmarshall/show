/* ------------------------------------------------------------------
   The decision catalogue.

   A photograph is not always one person against a wall. What you are
   making decides what there is to decide — so the groups belong to a
   mode, not to the app. Adding a discipline means adding a mode, and
   nothing else has to change.

   Every option carries the descriptor a model actually understands.
   That is the whole point of the Burmese entries: "လုံချည်" means
   nothing to any image model, so the catalogue holds the translation
   of the concept, never of the word.
   ------------------------------------------------------------------ */

export type Option = {
  id: string;
  label: string;
  labelMy: string;
  /** What the model is actually told. */
  descriptor: string;
  /** What this choice implies should be kept out. */
  negative?: string;
  /** Relative emphasis. 1 is neutral. */
  weight?: number;
  /** A concept no model knows by name. */
  mm?: boolean;
};

export type Group = {
  id: string;
  label: string;
  labelMy: string;
  /** Position in the compiled prompt. */
  order: number;
  multi?: boolean;
  options: Option[];
};

export type ModeId =
  | "portrait"
  | "ceremony"
  | "product"
  | "food"
  | "creature"
  | "place"
  | "imagine";

export type Mode = {
  id: ModeId;
  label: string;
  labelMy: string;
  hint: string;
  hintMy: string;
  /** Sensible opening state, so the room is never blank. */
  preset: Record<string, string[]>;
  groups: Group[];
};

const o = (
  id: string,
  label: string,
  labelMy: string,
  descriptor: string,
  extra: Partial<Option> = {},
): Option => ({ id, label, labelMy, descriptor, ...extra });

import { GRADE_MORE, LIGHT_MORE, MORE } from "./catalogue-more";

/* ================================================================
   Shared groups — same intent, mode-specific options
   ================================================================ */

const LIGHT_NATURAL: Option[] = [
  o(
    "window",
    "North window",
    "ပြတင်းပေါက်",
    "single large north-facing window as the only source, soft directional light from camera left, deep unlit shadow side, no fill",
    { weight: 1.15 },
  ),
  o(
    "golden",
    "Late afternoon",
    "ညနေခင်း",
    "low late-afternoon sun raking across the frame, warm amber key, long soft shadows, gentle atmospheric haze",
  ),
  o(
    "overcast",
    "Monsoon overcast",
    "မိုးရာသီ",
    "heavy monsoon overcast, flat cool diffuse daylight, wet surfaces, muted saturation, no visible sun",
    { mm: true },
  ),
  o(
    "hard-sun",
    "Hard noon sun",
    "မွန်းတည့်နေ",
    "high hard tropical sun, crisp black-edged shadows, high contrast, bleached highlights",
  ),
  o(
    "studio",
    "Studio softbox",
    "စတူဒီယို",
    "large softbox slightly above and to the right, white bounce opposite, clean falloff, controlled studio lighting",
  ),
  o(
    "practical",
    "Practical lamps",
    "မီးအိမ်",
    "lit only by practical lamps in the scene, warm pooled light, dark surrounding falloff, visible bulb glow",
  ),
];

const GRADE: Option[] = [
  o(
    "portra",
    "Film stock",
    "ဖလင်",
    "shot on Kodak Portra 400, fine grain, gentle highlight rolloff, muted warm palette",
  ),
  o(
    "clean",
    "Clean digital",
    "ကြည်လင်",
    "clean modern digital colour, neutral white balance, accurate skin and material tone, no filter",
  ),
  o(
    "moody",
    "Moody",
    "မှောင်မှိုင်း",
    "low-key grade, crushed shadows, restrained saturation, single dominant hue",
  ),
  o(
    "warm-mm",
    "Golden Burmese",
    "ရွှေရောင်",
    "warm golden-amber grade recalling Burmese afternoon light on teak and gilded surfaces, rich but not oversaturated",
    { mm: true },
  ),
];

/* ================================================================
   Modes
   ================================================================ */

const BASE: Mode[] = [
  /* ---------------------------------------------------------- */
  {
    id: "portrait",
    label: "Portrait",
    labelMy: "လူပုံ",
    hint: "One person, or a couple.",
    hintMy: "လူတစ်ယောက် သို့ စုံတွဲ။",
    preset: {
      subject: ["woman-30"],
      wardrobe: ["longyi", "acheik"],
      light: ["window"],
      frame: ["half"],
      grade: ["portra"],
    },
    groups: [
      {
        id: "subject",
        label: "Subject",
        labelMy: "လူပုံ",
        order: 1,
        options: [
          o(
            "woman-30",
            "Woman, 30s",
            "အမျိုးသမီး ၃၀ ကျော်",
            "a Burmese woman in her early thirties, warm medium-brown skin, dark almond eyes",
          ),
          o(
            "man-40",
            "Man, 40s",
            "အမျိုးသား ၄၀ ကျော်",
            "a Burmese man in his forties, warm medium-brown skin, close-cropped dark hair",
          ),
          o(
            "couple",
            "Couple",
            "စုံတွဲ",
            "a Burmese couple standing close, both facing the camera, equal prominence, hands touching",
          ),
          o(
            "child",
            "Child",
            "ကလေး",
            "a Burmese child around six years old, round face, unguarded expression",
          ),
          o(
            "elder",
            "Elder",
            "အဖိုးအဖွား",
            "a Burmese elder, deeply lined face, silver hair, calm direct gaze",
          ),
          o(
            "monk",
            "Monk",
            "ဘုန်းတော်ကြီး",
            "a Buddhist monk in dark saffron robes draped over the left shoulder, shaven head, composed and unposed",
            { mm: true },
          ),
        ],
      },
      {
        id: "wardrobe",
        label: "Wardrobe",
        labelMy: "ဝတ်စုံ",
        order: 2,
        multi: true,
        options: [
          o(
            "longyi",
            "Longyi",
            "လုံချည်",
            "a longyi — an ankle-length tubular sarong wrapped at the waist with a single front knot, woven cotton with a fine woven check, falling in soft vertical folds",
            { mm: true },
          ),
          o(
            "acheik",
            "Acheik silk",
            "အချိတ်ပိုး",
            "acheik silk — hand-woven Burmese ceremonial cloth patterned with interlocking horizontal wave bands in contrasting thread, lustrous and closely woven",
            { mm: true, weight: 1.2 },
          ),
          o(
            "eingyi",
            "Eingyi",
            "အင်္ကျီ",
            "an eingyi — a fitted collarless jacket-blouse fastening at the side with small cloth buttons, sheer fine cotton over a plain underlayer",
            { mm: true },
          ),
          o(
            "gaung-baung",
            "Gaung baung",
            "ခေါင်းပေါင်း",
            "a gaung baung — a formal Burmese headdress of cloth wound over a stiff frame with a projecting flared tail at one side",
            { mm: true },
          ),
          o(
            "taung-shay",
            "Taungshay paso",
            "တောင်ရှည်ပုဆိုး",
            "a taungshay paso — a long men's silk wrap with the surplus gathered and tucked to fall in a decorative front panel",
            { mm: true },
          ),
          o(
            "ethnic",
            "Ethnic dress",
            "တိုင်းရင်းသားဝတ်စုံ",
            "traditional dress of a Myanmar highland people, hand-woven bands of geometric pattern, beaded and coined ornament, wound headcloth",
            { mm: true },
          ),
          o(
            "modern",
            "Modern tailoring",
            "ခေတ်မီ",
            "sharply tailored contemporary clothing, matte fabric, minimal jewellery",
          ),
        ],
      },
      { id: "light", label: "Light", labelMy: "အလင်း", order: 3, options: LIGHT_NATURAL },
      {
        id: "frame",
        label: "Frame",
        labelMy: "ဘောင်",
        order: 4,
        options: [
          o(
            "close",
            "Close portrait",
            "အနီးကပ်",
            "tight head-and-shoulders portrait, 85mm lens, shallow depth of field, eyes on the upper third",
            { negative: "full body, wide shot" },
          ),
          o(
            "half",
            "Half length",
            "ခါးအထက်",
            "half-length portrait from the waist up, 50mm lens, natural perspective",
          ),
          o(
            "full",
            "Full length",
            "တစ်ကိုယ်လုံး",
            "full-length standing figure, feet visible and planted, 35mm lens, floor and contact shadow in frame",
            { negative: "cropped feet, close-up" },
          ),
          o(
            "environmental",
            "Environmental",
            "ပတ်ဝန်းကျင်နှင့်",
            "environmental portrait, the figure small within a described place, 28mm lens, the setting carrying equal weight",
          ),
        ],
      },
      {
        id: "grade",
        label: "Mood & grade",
        labelMy: "ခံစားချက်",
        order: 6,
        multi: true,
        options: [
          o(
            "khan-nya",
            "Composed",
            "ခန့်ညား",
            "composed and dignified bearing, upright posture, restrained expression, still hands, formal Southeast Asian portrait presence",
            { mm: true },
          ),
          o(
            "quiet",
            "Quiet",
            "အေးဆေး",
            "unhurried and inward, a settled quiet, nothing performed for the camera",
            { mm: true },
          ),
          ...GRADE,
        ],
      },
    ],
  },

  /* ---------------------------------------------------------- */
  {
    id: "ceremony",
    label: "Ceremony & Group",
    labelMy: "ပွဲနှင့် အုပ်စု",
    hint: "Weddings, novitiations, families, festivals.",
    hintMy: "မင်္ဂလာဆောင်၊ ရှင်ပြု၊ မိသားစု၊ ပွဲတော်။",
    preset: {
      occasion: ["wedding-trad"],
      size: ["6-12"],
      arrangement: ["tiered"],
      setting: ["hall"],
      moment: ["formal"],
      light: ["window"],
      grade: ["warm-mm"],
    },
    groups: [
      {
        id: "occasion",
        label: "Occasion",
        labelMy: "ပွဲ",
        order: 1,
        options: [
          o(
            "wedding-trad",
            "Traditional wedding",
            "ရိုးရာ မင်္ဂလာဆောင်",
            "a traditional Burmese wedding, bride and groom in ceremonial silk and gilded headpieces, gilded offering vessels and flower arrangements framing them",
            { mm: true, weight: 1.15 },
          ),
          o(
            "wedding-modern",
            "Modern wedding",
            "ခေတ်မီ မင်္ဂလာဆောင",
            "a contemporary wedding, white gown and dark suit, restrained floral styling, hotel ballroom formality",
          ),
          o(
            "shinbyu",
            "Novitiation",
            "ရှင်ပြု",
            "a shinbyu novitiation ceremony, a boy dressed as a young prince in gold brocade and jewelled headdress before ordination, family in ceremonial dress around him",
            { mm: true, weight: 1.15 },
          ),
          o(
            "nar-tha",
            "Ear-piercing",
            "နားသ",
            "a natwin ear-piercing ceremony, a girl in ceremonial silk and floral hair ornament, seated with family attending",
            { mm: true },
          ),
          o(
            "alms",
            "Alms offering",
            "ဆွမ်းကျွေး",
            "a merit-making alms offering, monks seated in a row receiving food from kneeling lay people, lacquer bowls and low tables",
            { mm: true },
          ),
          o(
            "graduation",
            "Graduation",
            "ဘွဲ့ယူ",
            "a university graduation, academic gown over formal longyi, certificate held, campus behind",
            { mm: true },
          ),
          o(
            "thingyan",
            "Thingyan",
            "သင်္ကြန်",
            "Thingyan new-year water festival, drenched crowds, water arcing through sunlight, padauk blossom, open-air pandal stages",
            { mm: true },
          ),
          o(
            "family",
            "Family portrait",
            "မိသားစု",
            "a multi-generation family portrait, elders seated at centre, younger family standing behind, everyone facing camera",
          ),
          o(
            "birthday",
            "Birthday",
            "မွေးနေ့",
            "a birthday gathering, decorated cake as the centre of attention, candles lit, friends leaning in",
          ),
        ],
      },
      {
        id: "size",
        label: "How many",
        labelMy: "ဘယ်နှစ်ယောက်",
        order: 2,
        options: [
          o("couple", "Two", "နှစ်ယောက်", "exactly two people, equal prominence, shoulders overlapping"),
          o("3-5", "Three to five", "၃–၅ ယောက်", "a small group of three to five people, all faces clearly visible and unobstructed"),
          o("6-12", "Six to twelve", "၆–၁၂ ယောက်", "a group of roughly ten people arranged so every face is visible and none is cropped"),
          o("20+", "Twenty or more", "၂၀+", "a large group of twenty or more people in ordered rows, every face visible, consistent scale across the rows"),
          o("crowd", "Crowd", "လူအုပ်", "a dense crowd receding into the background, individual faces sharp only in the near rank"),
        ],
      },
      {
        id: "arrangement",
        label: "Arrangement",
        labelMy: "စီစဉ်ပုံ",
        order: 3,
        options: [
          o("row", "Straight row", "တန်းစီ", "arranged in a single straight row at equal distance from the camera, symmetrical spacing"),
          o("tiered", "Tiered", "အလွှာလိုက်", "tiered arrangement, front row seated, second row standing, third row raised, heads staggered so none is hidden"),
          o("centred", "Centred pair", "ဗဟိုချက်", "the principal pair centred and slightly forward, everyone else falling back symmetrically around them"),
          o("candid", "Candid", "သဘာဝ", "unposed candid arrangement, people turned toward each other mid-interaction rather than toward the camera"),
          o("circle", "Gathered round", "ဝိုင်း", "gathered in a loose circle around a central object, shot slightly from above"),
        ],
      },
      {
        id: "setting",
        label: "Setting",
        labelMy: "နေရာ",
        order: 4,
        options: [
          o("pagoda", "Pagoda grounds", "ဘုရားဝင်း", "in the terraced grounds of a gilded pagoda, polished stone underfoot, whitewashed stupas and gold spires behind", { mm: true }),
          o("hall", "Ceremony hall", "မင်္ဂလာခန်းမ", "a decorated ceremony hall, draped fabric backdrop, floral columns, patterned carpet"),
          o("home", "Family home", "အိမ်", "a Burmese family home interior, teak floor and shutters, everyday objects left in place", { mm: true }),
          o("monastery", "Monastery", "ကျောင်း", "a wooden monastery hall, tall teak posts, worn plank floor, shafts of daylight from high openings", { mm: true }),
          o("garden", "Garden", "ဥယျာဉ်", "an open garden, mature trees and clipped lawn, dappled shade"),
          o("street", "Street", "လမ်းမ", "a Yangon street, colonial shopfronts, hanging signage, motorbikes and pedestrians blurred behind", { mm: true }),
        ],
      },
      {
        id: "moment",
        label: "Moment",
        labelMy: "အခိုက်အတန့်",
        order: 5,
        options: [
          o("formal", "Formal group", "အုပ်စုပုံ", "the formal set-piece group photograph, everyone still and looking at the lens"),
          o("ritual", "Mid-ritual", "ဝတ်ပြုနေချိန်", "caught mid-ritual, hands in the act of pouring or offering, attention on the act and not the camera"),
          o("laugh", "Between takes", "ရယ်မောနေချိန်", "the moment after the formal shot, posture loosening, someone laughing, eyes off-camera"),
          o("entrance", "Entrance", "ဝင်လာချိန်", "the entrance, the principals walking forward, guests turned toward them, motion in the surrounding figures"),
          o("detail", "Detail", "အသေးစိတ်", "a close detail of hands, jewellery or offering vessels, people present only as soft context"),
        ],
      },
      { id: "light", label: "Light", labelMy: "အလင်း", order: 6, options: LIGHT_NATURAL },
      {
        id: "grade",
        label: "Grade",
        labelMy: "အရောင်",
        order: 7,
        multi: true,
        options: GRADE,
      },
    ],
  },

  /* ---------------------------------------------------------- */
  {
    id: "product",
    label: "Product",
    labelMy: "ကုန်ပစ္စည်း",
    hint: "Commercial stills for a shop or a page.",
    hintMy: "ဆိုင်/page အတွက် ကြော်ငြာပုံ။",
    preset: {
      category: ["cosmetic"],
      surface: ["stone"],
      setup: ["single-soft"],
      angle: ["45"],
      finish: ["clean"],
    },
    groups: [
      {
        id: "category",
        label: "Product",
        labelMy: "ပစ္စည်း",
        order: 1,
        options: [
          o("cosmetic", "Cosmetic", "အလှကုန်", "a cosmetic bottle with a matte label and a metal cap, its typography crisp and legible"),
          o("jewellery", "Jewellery", "လက်ဝတ်ရတနာ", "a piece of gold jewellery, faceted stones catching a controlled specular highlight, every setting sharp"),
          o("thanaka", "Thanaka goods", "သနပ်ခါး", "thanaka cosmetic goods — pale bark logs and a round stone grinding slab, the ground cream in a small lacquer dish", { mm: true }),
          o("textile", "Textile", "အထည်", "folded woven textile, the weave structure and selvedge visible, fabric weight readable in the fold"),
          o("lacquer", "Lacquerware", "ယွန်း", "Burmese lacquerware — a shallow bowl in cinnabar and black with incised linework, low sheen, slight irregularity of the hand", { mm: true }),
          o("bottle", "Drink bottle", "ဖျော်ရည်", "a chilled glass drink bottle, condensation beaded on the shoulder, liquid colour reading through"),
          o("electronics", "Electronics", "အီလက်ထရွန်နစ်", "a small consumer electronic device, brushed metal and glass, edges catching a long soft highlight"),
        ],
      },
      {
        id: "surface",
        label: "Surface",
        labelMy: "မျက်နှာပြင်",
        order: 2,
        options: [
          o("stone", "Stone slab", "ကျောက်ပြား", "resting on a honed stone slab, fine mineral grain, cool neutral tone"),
          o("teak", "Teak", "ကျွန်းသား", "on aged teak, open grain and darkened patina, warm brown", { mm: true }),
          o("seamless", "Seamless white", "အဖြူချော", "on a seamless white sweep with no visible horizon line, clean catalogue separation"),
          o("linen", "Linen", "ဖျင်", "on rumpled natural linen, soft folds radiating from the object"),
          o("water", "Water", "ရေမျက်နှာပြင်", "standing in a shallow film of still water, a clean mirrored reflection beneath"),
          o("void", "Floating", "လေထဲ", "floating against a dark gradientless void, no surface and no contact shadow", { negative: "table, surface, ground" }),
        ],
      },
      {
        id: "setup",
        label: "Light setup",
        labelMy: "အလင်းစီစဉ်မှု",
        order: 3,
        options: [
          o("single-soft", "One softbox", "softbox တစ်လုံး", "a single large softbox from the upper left, white card fill opposite, one soft graduated shadow", { weight: 1.1 }),
          o("rim", "Rim and fill", "ဘေးမှ", "two rim lights raking from behind at both sides, minimal frontal fill, edges defined by light rather than outline"),
          o("hard", "Hard light", "မာသောအလင်း", "one small hard source, crisp black-edged shadow thrown across the surface, high specular contrast"),
          o("gradient", "Gradient sweep", "အလွှာအလင်း", "a graduated light sweep behind, bright directly behind the object falling to dark at the frame edge"),
          o("sun", "Direct sun", "နေရောင်", "direct window sun, hard shadow with a warm bounce, dust visible in the beam"),
        ],
      },
      {
        id: "angle",
        label: "Angle",
        labelMy: "ရိုက်ကွက်",
        order: 4,
        options: [
          o("front", "Straight on", "ရှေ့တည့်တည့်", "straight-on eye-level product view, no perspective distortion, label fully square to the lens"),
          o("45", "Three-quarter", "45°", "three-quarter view at forty-five degrees, front face and one side both readable"),
          o("top", "Overhead", "အပေါ်စီး", "directly overhead flat-lay, everything parallel to the sensor plane"),
          o("macro", "Macro", "မကျော", "extreme macro on a single detail, 100mm macro lens, razor-thin plane of focus"),
          o("hero", "Low hero", "အောက်စီး", "low hero angle looking slightly up, the object made monumental against the background"),
        ],
      },
      {
        id: "finish",
        label: "Finish",
        labelMy: "အပြီးသတ်",
        order: 5,
        multi: true,
        options: [
          o("clean", "Catalogue clean", "ရိုးရှင်း", "clean commercial finish, colour-accurate, no styling props, generous negative space for copy"),
          o("editorial", "Editorial", "ဖက်ရှင်", "editorial styling, considered props in soft focus, a colour story running through the frame"),
          o("rustic", "Handmade", "လက်မှု", "handmade context, workshop marks and raw materials in frame, imperfection welcomed"),
          o("luxury", "Luxury", "ဇိမ်ခံ", "luxury advertising finish, deep blacks, one long controlled specular, restraint everywhere else"),
        ],
      },
    ],
  },

  /* ---------------------------------------------------------- */
  {
    id: "food",
    label: "Food",
    labelMy: "အစားအစာ",
    hint: "Menus, shopfronts, delivery pages.",
    hintMy: "မီနူး၊ ဆိုင်၊ delivery page။",
    preset: {
      dish: ["mohinga"],
      vessel: ["lacquer"],
      angle: ["45"],
      light: ["window"],
      state: ["steam"],
    },
    groups: [
      {
        id: "dish",
        label: "Dish",
        labelMy: "ဟင်း",
        order: 1,
        options: [
          o("mohinga", "Mohinga", "မုန့်ဟင်းခါး", "mohinga — rice noodles in a thick catfish and banana-stem broth, topped with sliced egg, crisp fritters, coriander and a wedge of lime", { mm: true, weight: 1.15 }),
          o("laphet", "Laphet thoke", "လက်ဖက်သုပ်", "laphet thoke — fermented tea leaf salad, distinct piles of fried garlic, peanuts, sesame, shredded cabbage and tomato arranged around dark tea leaf", { mm: true, weight: 1.15 }),
          o("curry", "Curry spread", "ထမင်းဟင်း", "a Burmese curry spread — a bowl of oil-glossed meat curry with rice, clear soup, raw vegetable platter and pounded chilli relish set around it", { mm: true }),
          o("skewer", "Grilled skewers", "အကင်", "charcoal-grilled skewers just off the fire, char marks and rendering fat, a small dipping bowl beside"),
          o("noodle", "Fried noodles", "ခေါက်ဆွဲကြော်", "wok-fried noodles lifted mid-toss, glossed with sauce, spring onion scattered"),
          o("tea", "Tea and snack", "လက်ဖက်ရည်", "sweet milk tea in a small thick glass beside fried snacks on an enamel plate, a teashop table beneath", { mm: true }),
          o("dessert", "Dessert", "အချိုပွဲ", "a Burmese sweet — steamed semolina or coconut cake cut into diamonds, sesame scattered on top", { mm: true }),
        ],
      },
      {
        id: "vessel",
        label: "Served in",
        labelMy: "ထည့်ထားပုံ",
        order: 2,
        options: [
          o("lacquer", "Lacquer tray", "ယွန်းဗန်း", "presented on a Burmese lacquer tray in cinnabar and black, low sheen", { mm: true }),
          o("enamel", "Enamel plate", "အိုးမင်း", "on a chipped enamel plate, blue rim, everyday and unstyled", { mm: true }),
          o("ceramic", "Ceramic bowl", "မြေအိုး", "in a heavy unglazed ceramic bowl, matte and slightly uneven"),
          o("modern", "Modern plating", "ခေတ်မီ", "plated on matte modern ceramic, deliberate negative space, restrained portion"),
          o("banana", "Banana leaf", "ငှက်ပျောရွက်", "served on a fresh banana leaf, the leaf's veining and glossy surface visible beneath", { mm: true }),
        ],
      },
      {
        id: "angle",
        label: "Angle",
        labelMy: "ရိုက်ကွက်",
        order: 3,
        options: [
          o("top", "Overhead", "အပေါ်စီး", "directly overhead flat-lay, the whole spread laid out parallel to the sensor"),
          o("45", "Three-quarter", "45°", "three-quarter angle at forty-five degrees, depth in the bowl readable, background falling soft"),
          o("eye", "Eye level", "မျက်စိအဆင့်", "table-level view, the height and layering of the dish shown in profile"),
          o("macro", "Close texture", "အနီးကပ်", "very close on texture, 100mm macro, a single garnish sharp and everything else dissolving"),
          o("hands", "In hand", "လက်ထဲ", "held in a pair of hands entering frame, the vessel warm and the food in motion"),
        ],
      },
      { id: "light", label: "Light", labelMy: "အလင်း", order: 4, options: LIGHT_NATURAL },
      {
        id: "state",
        label: "State",
        labelMy: "အခြေအနေ",
        order: 5,
        multi: true,
        options: [
          o("steam", "Steaming", "အငွေ့ထ", "visible steam rising and catching the light, the dish freshly served", { weight: 1.1 }),
          o("gloss", "Glossy", "အဆီပြောင်", "oil and sauce catching a wet specular highlight, surfaces glossy and freshly turned"),
          o("mid", "Mid-eaten", "စားနေဆဲ", "partly eaten, chopsticks resting, a natural rather than untouched arrangement"),
          o("mess", "Working mess", "ရှုပ်ပွနေ", "crumbs, spills and stacked used plates in frame, an honest teashop table"),
          ...GRADE.slice(0, 3),
        ],
      },
    ],
  },

  /* ---------------------------------------------------------- */
  {
    id: "creature",
    label: "Animal",
    labelMy: "တိရစ္ဆာန်",
    hint: "Pets, working animals, wildlife.",
    hintMy: "အိမ်မွေး၊ လုပ်ငန်းခွင်၊ တောရိုင်း။",
    preset: {
      animal: ["cat"],
      action: ["still"],
      habitat: ["home"],
      light: ["window"],
      framing: ["portrait"],
    },
    groups: [
      {
        id: "animal",
        label: "Animal",
        labelMy: "တိရစ္ဆာန်",
        order: 1,
        options: [
          o("cat", "Cat", "ကြောင်", "a short-haired cat, individual guard hairs and whiskers resolved, pupils reacting to the light"),
          o("dog", "Dog", "ခွေး", "a medium street dog, coarse coat, alert ears, wet nose catching a highlight"),
          o("elephant", "Elephant", "ဆင်", "an Asian elephant, deeply creased grey skin, sparse bristle, one eye catching light beneath a heavy lid", { weight: 1.1 }),
          o("buffalo", "Water buffalo", "ကျွဲ", "a water buffalo in a paddy field, mud-slicked hide, curved swept-back horns", { mm: true }),
          o("bird", "Bird", "ငှက်", "a small tropical bird mid-perch, feather barbs individually resolved, claw gripping the branch"),
          o("fish", "Fish", "ငါး", "a fish underwater, scales refracting, fins translucent against the light"),
          o("horse", "Horse", "မြင်း", "a horse in profile, muscle definition under a short coat, mane lifting"),
        ],
      },
      {
        id: "action",
        label: "Doing what",
        labelMy: "ဘာလုပ်နေလဲ",
        order: 2,
        options: [
          o("still", "Still, watching", "ငြိမ်ငြိမ်", "completely still and watching something outside the frame, weight settled"),
          o("run", "Running", "ပြေးနေ", "at full run, legs extended, a fast shutter freezing the stride cleanly", { negative: "motion blur on the subject" }),
          o("jump", "Mid-air", "ခုန်နေ", "caught airborne at the top of a leap, all limbs off the ground"),
          o("sleep", "Sleeping", "အိပ်နေ", "asleep and curled, breathing slow, body slack"),
          o("eat", "Feeding", "စားနေ", "head lowered and feeding, attention entirely on the food"),
          o("with-person", "With a person", "လူနှင့်", "beside a person, the human present but cropped or out of focus, the animal holding the frame"),
        ],
      },
      {
        id: "habitat",
        label: "Where",
        labelMy: "နေရာ",
        order: 3,
        options: [
          o("home", "At home", "အိမ်", "on a worn interior floor, domestic objects softly out of focus behind"),
          o("street", "Street", "လမ်းပေါ်", "on a hot city street, kerbstone and shopfront shutter behind, traffic light and blurred"),
          o("paddy", "Paddy field", "လယ်ကွင်း", "in a flooded paddy field, water mirroring the sky, distant palms on the bund", { mm: true }),
          o("forest", "Forest", "တောအုပ်", "in dense monsoon forest, layered green, light broken into patches by the canopy"),
          o("river", "Riverbank", "မြစ်ကမ်း", "on a silted riverbank, wet sand holding tracks, wide brown water behind"),
        ],
      },
      { id: "light", label: "Light", labelMy: "အလင်း", order: 4, options: LIGHT_NATURAL },
      {
        id: "framing",
        label: "Framing",
        labelMy: "ဘောင်",
        order: 5,
        options: [
          o("portrait", "Animal portrait", "မျက်နှာ", "a close portrait at the animal's own eye level, 200mm, background compressed to a soft wash"),
          o("full", "Full body", "တစ်ကိုယ်လုံး", "the whole animal in frame with room to move into, feet and ground included"),
          o("wide", "In its place", "ပတ်ဝန်းကျင်", "wide, the animal small within its habitat, the place given equal weight"),
          o("detail", "Detail", "အသေးစိတ်", "macro on a single detail — eye, paw, feather, hide — filling the frame"),
        ],
      },
    ],
  },

  /* ---------------------------------------------------------- */
  {
    id: "place",
    label: "Place",
    labelMy: "နေရာ",
    hint: "Landscape, architecture, interiors.",
    hintMy: "ရှုခင်း၊ အဆောက်အအုံ၊ အတွင်းခန်း။",
    preset: {
      place: ["pagoda"],
      hour: ["dawn"],
      weather: ["mist"],
      lens: ["wide"],
      grade: ["warm-mm"],
    },
    groups: [
      {
        id: "place",
        label: "Place",
        labelMy: "နေရာ",
        order: 1,
        options: [
          o("pagoda", "Pagoda plain", "ဘုရားကွင်း", "a plain of brick temples receding to the horizon, spires at many distances, dry scrub between them", { mm: true, weight: 1.15 }),
          o("shwedagon", "Great pagoda", "ရွှေတိဂုံ", "an immense gilded stupa rising from a marble terrace ringed by smaller shrines, gold against open sky", { mm: true }),
          o("lake", "Stilt village", "ရေပေါ်ရွာ", "a lake village on stilts, narrow leg-rowed boats, floating garden beds, mountains ringing the water", { mm: true }),
          o("street", "City street", "မြို့လမ်း", "a dense downtown street, colonial facades stained by monsoon, hanging signage, tangled overhead cable", { mm: true }),
          o("mountain", "Highland", "တောင်တန်း", "terraced highland ridges falling away in layers, cloud pooled in the valleys"),
          o("beach", "Coast", "ကမ်းခြေ", "a wide flat tropical beach, palms leaning inland, shallow surf and a long empty horizon"),
          o("interior", "Teak interior", "ကျွန်းသားအခန်း", "a teak-floored interior with tall shutters, dust in the light, worn furniture left in place", { mm: true }),
        ],
      },
      {
        id: "hour",
        label: "Hour",
        labelMy: "အချိန်",
        order: 2,
        options: [
          o("dawn", "Dawn", "အရုဏ်တက်", "first light before sunrise, cool blue ambient with a warm rim on the horizon, no hard shadows yet"),
          o("morning", "Morning", "မနက်", "mid-morning, clear directional sun, shadows still long, air not yet hazy"),
          o("noon", "Noon", "မွန်းတည့်", "high noon, shadows directly beneath objects, hard contrast, bleached sky"),
          o("golden", "Golden hour", "ညနေ", "the last hour of sun, everything warm and raking, long shadows across the ground"),
          o("blue", "Blue hour", "ဂိုဓုံ", "after sunset, deep even blue ambient, artificial lights beginning to read"),
          o("night", "Night", "ည", "full night, lit only by moonlight and practical sources, deep clean shadow"),
        ],
      },
      {
        id: "weather",
        label: "Weather",
        labelMy: "ရာသီဥတု",
        order: 3,
        options: [
          o("clear", "Clear", "ကြည်လင်", "clear dry-season air, long visibility, saturated distance"),
          o("mist", "Mist", "မြူ", "low mist filling the middle distance, layers of the scene separating by tone as they recede", { weight: 1.1 }),
          o("rain", "Rain", "မိုးရွာ", "rain falling and visible against dark tone, wet reflective surfaces, spray at ground level"),
          o("storm", "Storm light", "မိုးအုံ့", "a dark storm ceiling with a bright break at the horizon lighting the foreground alone"),
          o("dust", "Dust haze", "ဖုန်မှုန်", "hot dust haze, low contrast, the sun a defined disc, distance washing to pale"),
        ],
      },
      {
        id: "lens",
        label: "Lens",
        labelMy: "မှန်ဘီလူး",
        order: 4,
        options: [
          o("wide", "Wide", "ကျယ်", "16mm ultra-wide, strong foreground presence, converging verticals, deep focus front to back"),
          o("normal", "Normal", "ပုံမှန်", "35mm, close to how the eye reads the space, no exaggerated perspective"),
          o("tele", "Compressed", "telephoto", "300mm telephoto compression, distant layers stacked flat against each other"),
          o("aerial", "From above", "အထက်မှ", "aerial view from a few hundred metres, the pattern of the place legible as geometry"),
          o("long", "Long exposure", "ရှည်ဖွင့်", "several-second exposure, water and cloud smoothed to a continuous blur, static elements sharp"),
        ],
      },
      {
        id: "grade",
        label: "Grade",
        labelMy: "အရောင်",
        order: 5,
        multi: true,
        options: GRADE,
      },
    ],
  },

  /* ---------------------------------------------------------- */
  {
    id: "imagine",
    label: "Imagine",
    labelMy: "စိတ်ကူး",
    hint: "No photograph required. Start from the idea.",
    hintMy: "ဓာတ်ပုံ မလို။ စိတ်ကူးကနေ စ။",
    preset: {
      genre: ["surreal"],
      medium: ["photographic"],
      device: ["scale"],
      palette: ["duotone"],
    },
    groups: [
      {
        id: "genre",
        label: "Genre",
        labelMy: "အမျိုးအစား",
        order: 1,
        options: [
          o("surreal", "Surreal", "အံ့ဖွယ်", "a surreal image obeying its own internal logic, everything rendered plainly and without irony"),
          o("myth", "Myth", "ဒဏ္ဍာရီ", "a scene from Burmese myth — nat spirits, ogres and guardian beings treated as ordinary inhabitants of the world", { mm: true, weight: 1.1 }),
          o("scifi", "Science fiction", "သိပ္ပံ", "a near-future scene, technology worn-in and repaired rather than pristine"),
          o("dream", "Dream", "အိပ်မက်", "dream logic, scale and continuity quietly wrong, the image calm about it"),
          o("folk", "Folk tale", "ပုံပြင်", "a folk tale illustrated as though it happened, plain setting, heightened single event", { mm: true }),
          o("noir", "Noir", "အမှောင်", "noir atmosphere, hard shadow, rain, a single figure and a great deal of unexplained space"),
        ],
      },
      {
        id: "medium",
        label: "Medium",
        labelMy: "ပုံစံ",
        order: 2,
        options: [
          o("photographic", "Photographic", "ဓာတ်ပုံ", "rendered as a photograph — real optics, real depth of field, real film response"),
          o("oil", "Oil paint", "ဆီဆေး", "oil on canvas, visible brush loading, glazed shadow and impasto highlight"),
          o("ink", "Ink and wash", "မှင်", "brush ink and wash on absorbent paper, controlled bleed, large areas left empty"),
          o("render", "3D render", "3D", "physically based 3D render, clean geometry, area lights, subtle ambient occlusion"),
          o("collage", "Collage", "ကပ်ပုံ", "cut-paper collage, torn edges and hard drop shadows between layers"),
          o("mural", "Temple mural", "နံရံဆေးရေး", "in the manner of a Burmese temple wall mural — flat planes, red and gold, figures in registers, no perspective", { mm: true }),
        ],
      },
      {
        id: "device",
        label: "The impossible bit",
        labelMy: "မဖြစ်နိုင်တာ",
        order: 3,
        multi: true,
        options: [
          o("scale", "Scale is wrong", "အရွယ်လွဲ", "one element at drastically the wrong scale, treated as completely normal by everything around it"),
          o("float", "It floats", "လေထဲပျံ", "the subject suspended in air with no support and no explanation, casting a correct shadow below"),
          o("double", "Double exposure", "ထပ်ရိုက်", "two scenes overlaid as a single in-camera double exposure, one legible through the other"),
          o("mirror", "Mirrored", "မှန်ထဲ", "a reflection that disagrees with the thing reflected"),
          o("inside-out", "Interior outdoors", "အတွင်းအပြင်", "a fully furnished interior standing in open landscape with no walls"),
          o("time", "Two times at once", "အချိန်နှစ်ခု", "two moments occupying the same frame, the older one faint but exactly registered"),
        ],
      },
      {
        id: "palette",
        label: "Palette",
        labelMy: "အရောင်စဉ်",
        order: 4,
        options: [
          o("duotone", "Two colours", "အရောင်နှစ်ခု", "restricted to two hues and their mixtures, everything else neutral"),
          o("gold-red", "Gold and cinnabar", "ရွှေနှင့်ဟင်္သပဒါး", "gold leaf and cinnabar red against deep black, lacquer palette", { mm: true }),
          o("pastel", "Pastel", "နုညံ့", "high-key pastel, low contrast, nothing fully saturated"),
          o("mono", "Monochrome", "အဖြူအမည်း", "black and white, full tonal range from true black to clean white"),
          o("acid", "Acid", "တောက်ပ", "aggressively saturated, clashing complementaries, no neutral anywhere"),
        ],
      },
    ],
  },
];

/* Each mode's own catalogue, widened by catalogue-more: extra options
   added to the groups it already has (lights and grades everywhere),
   and the groups a photographer reaches for next. Groups are put in
   prompt order; shared option lists are copied, never mutated. */
function widen(base: Mode[]): Mode[] {
  return base.map((m) => {
    const extra = MORE[m.id] ?? {};
    const groups = m.groups.map((g) => {
      const add = [
        ...(g.id === "light" ? LIGHT_MORE : []),
        ...(g.id === "grade" ? GRADE_MORE : []),
        ...(extra.add?.[g.id] ?? []),
      ];
      if (!add.length) return g;
      const seen = new Set(g.options.map((x) => x.id));
      const fresh = add.filter((x) => !seen.has(x.id) && !!seen.add(x.id));
      return { ...g, options: [...g.options, ...fresh] };
    });
    const have = new Set(groups.map((g) => g.id));
    const more = (extra.groups ?? []).filter((g) => !have.has(g.id));
    return { ...m, groups: [...groups, ...more].sort((a, b) => a.order - b.order) };
  });
}

export const MODES: Mode[] = widen(BASE);

export const getMode = (id: ModeId): Mode =>
  MODES.find((m) => m.id === id) ?? MODES[0];

/** Applied to every compile — the failures nobody wants to see. */
export const BASE_NEGATIVE = [
  "extra fingers",
  "deformed hands",
  "asymmetric eyes",
  "duplicated jewellery",
  "garbled text",
  "watermark",
  "plastic skin",
];
