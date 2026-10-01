/* ------------------------------------------------------------------
   The Myanmar Text Engine — the text half.

   No image model can set Burmese: the script stacks, reorders and
   joins, and a diffusion model draws letter-shaped noise. So SHOW never
   asks a model for text. The design comes from the model (or from the
   photographer), and the words are set as real type by the browser's
   own shaper — which gets ြ ွ ှ ့ ် and stacked consonants right.

   What the shaper cannot do is fix the input. Half the Burmese text a
   studio pastes still arrives in Zawgyi, and Burmese has no spaces to
   break lines at. Both are handled here.

   No imports: runs under the engine checks in plain Node.
   ------------------------------------------------------------------ */

/* -- Zawgyi ------------------------------------------------------- */

/**
 * Is this Zawgyi rather than Unicode? Zawgyi stores letters in visual
 * order and uses code points Unicode gives to other languages, so a
 * few patterns give it away almost at once.
 */
export function zawgyiScore(text: string): number {
  if (!/[က-႟]/.test(text)) return 0;
  let z = 0;
  let u = 0;
  /* visual-order vowel sign E before its consonant */
  z += (text.match(/(^|[^က-အျ-ှ])ေ[က-အ]/g) ?? []).length * 2;
  /* Zawgyi's medial RA (U+103B) written before the consonant */
  z += (text.match(/(^|[^က-အ])ျ[က-အ]/g) ?? []).length * 2;
  /* glyph variants Zawgyi squats on */
  z += (text.match(/[ၠ-႗]/g) ?? []).length;
  /* Zawgyi's asat (U+1039) at a syllable end */
  z += (text.match(/[က-အ]္(?![က-အ])/g) ?? []).length;
  /* Unicode tells: asat U+103A, and medial order consonant+medial */
  u += (text.match(/်/g) ?? []).length;
  u += (text.match(/[က-အ][ျြ]/g) ?? []).length * 0.5;
  u += (text.match(/[က-အ]ေ/g) ?? []).length * 0.5;
  return z / Math.max(1, z + u);
}

export const isZawgyi = (text: string) => zawgyiScore(text) > 0.55;

/* The conversion is a sequence of rewrites, order matters. Glyph
   variants are mapped to their Unicode sequences first, then the
   visual-order signs are moved to logical order, then everything is
   put in Unicode's canonical storage order. */
const ZG: [RegExp, string][] = [
  [/​/g, ""],
  /* medials and asat: the Zawgyi code points mean different things */
  [/(ွ|ႇ)/g, "ှ"],
  [/ြ/g, "ွ"],
  [/(ျ|ၾ|ၿ|ႀ|ႁ|ႂ|ႃ|ႄ)/g, "ြ"],
  [/(်|ၽ)/g, "ျ"],
  [/္/g, "်"],
  /* stacked consonants and ligatures */
  [/ၪ/g, "ဉ"],
  [/ၫ/g, "ည"],
  [/ၬ/g, "္ဋ"],
  [/ၭ/g, "္ဌ"],
  [/ၮ/g, "ဍ္ဍ"],
  [/ၯ/g, "ဍ္ဎ"],
  [/ၰ/g, "္ဏ"],
  [/(ၱ|ၲ)/g, "္တ"],
  [/ၠ/g, "္က"],
  [/ၡ/g, "္ခ"],
  [/ၢ/g, "္ဂ"],
  [/ၣ/g, "္ဃ"],
  [/ၥ/g, "္စ"],
  [/(ၦ|ၧ)/g, "္ဆ"],
  [/ၨ/g, "္ဇ"],
  [/ၩ/g, "္ဈ"],
  [/(ၳ|ၴ)/g, "္ထ"],
  [/ၵ/g, "္ဒ"],
  [/ၶ/g, "္ဓ"],
  [/ၷ/g, "္န"],
  [/ၸ/g, "္ပ"],
  [/ၹ/g, "္ဖ"],
  [/ၺ/g, "္ဗ"],
  [/ၼ/g, "္မ"],
  [/ႅ/g, "္လ"],
  [/မာ(ၻ|႓)/g, "မ္ဘာ"],
  [/(ၻ|႓)/g, "္ဘ"],
  [/႖/g, "္တွ"],
  [/႗/g, "ဋ္ဋ"],
  [/႑/g, "ဏ္ဍ"],
  [/႒/g, "ဋ္ဌ"],
  /* vowel and tone variants */
  [/ဳ/g, "ု"],
  [/ဴ/g, "ူ"],
  [/ႈ/g, "ှု"],
  [/ႉ/g, "ှူ"],
  [/ႊ/g, "ွှ"],
  [/(႔|႕)/g, "့"],
  [/ႎ/g, "ိံ"],
  [/ႏ/g, "န"],
  [/႐/g, "ရ"],
  [/ႆ/g, "ဿ"],
  [/ဦ/g, "ဦ"],
  /* kinzi: Zawgyi writes it over the following consonant */
  [/([က-အ])ၤ/g, "င်္$1"],
  [/([က-အ])ႋ/g, "င်္$1ိ"],
  [/([က-အ])ႌ/g, "င်္$1ီ"],
  [/([က-အ])ႍ/g, "င်္$1ံ"],
  /* visual order → logical order: medial RA sits before its consonant */
  [/ြ([က-အ])(္[က-အ])?/g, "$1$2ြ"],
  /* …and so does vowel sign E, possibly before RA too */
  [/ေ([က-အ](?:္[က-အ])?)([ျ-ှ]*)/g, "$1$2ေ"],
  /* zero and seven used as the letters wa and ra */
  [/၀(?=[ါ-ှ])/g, "ဝ"],
  [/(?<=[က-အါ-ှ])၀(?![၀-၉])/g, "ဝ"],
  [/၇(?=[ါ-ှ])/g, "ရ"],
  /* canonical storage order */
  [/ှျ/g, "ျှ"],
  [/ွျ/g, "ျွ"],
  [/ှွ/g, "ွှ"],
  [/ွြ/g, "ြွ"],
  [/ှြ/g, "ြှ"],
  [/ေ([ျ-ှ]+)/g, "$1ေ"],
  [/ုိ/g, "ို"],
  [/ံု/g, "ုံ"],
  [/့ု/g, "ု့"],
  [/့ံ/g, "ံ့"],
  [/့်/g, "့်"],
  [/ာေ/g, "ော"],
  [/(ိ|ီ)ေ/g, "ေ$1"],
  [/့+/g, "့"],
  [/်+/g, "်"],
  [/င််္/g, "င်္"],
];

export function zg2uni(text: string): string {
  let s = text;
  for (const [re, to] of ZG) s = s.replace(re, to);
  return s;
}

/* -- line breaking: Burmese has no spaces between words ----------- */

/**
 * Syllable boundaries. A syllable starts at a consonant or independent
 * vowel, unless that consonant is stacked under the previous one
 * (preceded by virama) or closes the previous syllable (followed by
 * asat or virama). Latin runs, digits and spaces are their own tokens.
 */
const SYL =
  /(?<!္)[က-အဣ-ဧဩဪဿ၌-၏](?![်္])|[A-Za-z0-9၀-၉.,:;'’"“”!?%()&@#+\-/]+|\s+|[^က-႟\s]/g;

export function syllables(text: string): string[] {
  const starts = new Set<number>([0]);
  for (const m of text.matchAll(SYL)) {
    starts.add(m.index!);
    /* a Latin run or a space ends where it ends; a Burmese syllable
       ends only where the next one starts */
    if (!/^[က-႟]$/.test(m[0])) starts.add(m.index! + m[0].length);
  }
  const cut = [...starts].filter((i) => i <= text.length).sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < cut.length; i++) {
    const piece = text.slice(cut[i], cut[i + 1] ?? text.length);
    if (piece) out.push(piece);
  }
  /* a syllable may not start with a dependent sign: glue it back */
  const merged: string[] = [];
  for (const p of out) {
    if (merged.length && /^[ါ-ှၖ-ၙၢ-ၤၧ-ၭႃ-ႍ]/.test(p)) merged[merged.length - 1] += p;
    else merged.push(p);
  }
  return merged;
}

/**
 * Break text into lines no wider than `max`, at syllables and spaces,
 * with any line-starting space dropped. `measure` is the renderer's.
 */
export function wrap(text: string, max: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line: string[] = [];
    const width = (toks: string[]) => measure(toks.join("").trimEnd());
    for (const t of syllables(para)) {
      if (line.length && width([...line, t]) > max) {
        /* Burmese may break between any two syllables, but a reader
           prefers the break at a space — between phrases, not inside a
           name — so take the last space if it is not too far back */
        const sp = line.findLastIndex((x) => /^\s+$/.test(x));
        if (sp > 0 && width(line.slice(0, sp)) > max * 0.55) {
          lines.push(line.slice(0, sp).join("").trimEnd());
          line = line.slice(sp + 1);
        } else {
          lines.push(line.join("").trimEnd());
          line = [];
        }
        if (!/^\s+$/.test(t)) line.push(t);
      } else if (line.length || !/^\s+$/.test(t)) {
        line.push(t);
      }
    }
    lines.push(line.join("").trimEnd());
  }
  return lines;
}

/* -- numerals ----------------------------------------------------- */

export const myDigits = (s: string) => s.replace(/[0-9]/g, (d) => String.fromCharCode(0x1040 + Number(d)));

/** 150000 → "၁၅၀,၀၀၀ ကျပ်" or "150,000 MMK" */
export function kyat(n: number, burmese: boolean): string {
  const s = Math.round(n).toLocaleString("en-US");
  return burmese ? `${myDigits(s)} ကျပ်` : `${s} MMK`;
}

/* -- checks a studio would want before printing 500 invitations --- */

export type Issue = { at: number; en: string; my: string };

export function check(text: string): Issue[] {
  const issues: Issue[] = [];
  if (isZawgyi(text)) {
    issues.push({ at: 0, en: "This looks like Zawgyi — convert it to Unicode first", my: "ဒါ Zawgyi နဲ့ ရေးထားပုံရတယ် — Unicode ပြောင်းပါ" });
    return issues;
  }
  const push = (re: RegExp, en: string, my: string) => {
    for (const m of text.matchAll(re)) issues.push({ at: m.index!, en, my });
  };
  push(/(^|[\s၊။])[ါ-ှ]/g, "A vowel sign with no consonant before it", "ဗျည်းမပါဘဲ သရ စတင်နေ");
  push(/([ါ-ှ])\1/g, "The same sign typed twice", "သင်္ကေတ တစ်ခုတည်း နှစ်ခါ");
  push(/်[ါ-ဲ]/g, "A vowel after the killer (asat) — probably mistyped", "အသတ်နောက် သရ — မှားရိုက်ထားပုံရ");
  return issues;
}
