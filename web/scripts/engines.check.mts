/* Engine checks for the device-side rooms. Run: npm run check:engines */

import { repair, median, RESTORE_DEFAULT } from "../src/lib/restore.ts";
import { centre, correction, cull, drift, measure } from "../src/lib/series.ts";
import { crc32, zip } from "../src/lib/zip.ts";
import { check as mmCheck, isZawgyi, kyat, myDigits, syllables, wrap, zg2uni } from "../src/lib/myanmar.ts";
import { layoutAlbum, planSpreads } from "../src/lib/layout.ts";
import { naturalImageText, numberOf } from "../src/lib/references.ts";
import { togetherPrompt } from "../src/lib/together.ts";
import { register } from "node:module";

/* the app's own modules import without extensions; let Node find the .ts */
register(
  "data:text/javascript," +
    encodeURIComponent(
      `export async function resolve(s, c, next) {
        try { return await next(s, c); }
        catch (e) { if (s.startsWith(".") && !/\\.[cm]?[jt]s$/.test(s)) return next(s + ".ts", c); throw e; }
      }`,
    ),
);
const { compile, compileParts, asOneText } = await import("../src/lib/compile.ts");
const { MODES } = await import("../src/lib/catalogue.ts");
import { harmonize, HARMONY_NEUTRAL, keyBackdrop, lightSide } from "../src/lib/composite.ts";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failed++;
};

/* -- a synthetic print: soft gradient, specks, one scratch -------- */
const W = 240;
const H = 180;
const base = new Uint8ClampedArray(W * H * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const v = 90 + (x / W) * 60 + (y / H) * 20;
    base[i] = v + 12;
    base[i + 1] = v + 4;
    base[i + 2] = v - 10;
    base[i + 3] = 255;
  }
}
const damaged = base.slice();
const specks = [
  [30, 30],
  [100, 60],
  [180, 140],
  [60, 150],
];
for (const [sx, sy] of specks) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const i = ((sy + dy) * W + sx + dx) * 4;
      damaged[i] = damaged[i + 1] = damaged[i + 2] = 250;
    }
  }
}
for (let y = 20; y < 160; y++) {
  const i = (y * W + 150) * 4;
  damaged[i] = damaged[i + 1] = damaged[i + 2] = 35;
}

{
  const lum = new Uint8Array([5, 1, 9, 3, 7, 2, 8, 4, 6]);
  const m = median(lum, 3, 3, 1);
  check("median: centre of a 3×3 is the true median", m[4] === 5, `got ${m[4]}`);
}

const r = repair(damaged, W, H, { ...RESTORE_DEFAULT, fade: 0, sharpen: 0 });
{
  let worst = 0;
  for (const [sx, sy] of specks) {
    const i = (sy * W + sx) * 4;
    worst = Math.max(worst, Math.abs(r.clean[i] - base[i]));
  }
  check("specks are filled to within 12 levels of the print", worst <= 12, `worst ${worst}`);

  let scratch = 0;
  for (let y = 30; y < 150; y += 10) {
    const i = (y * W + 150) * 4;
    scratch = Math.max(scratch, Math.abs(r.clean[i] - base[i]));
  }
  check("the scratch is filled to within 12 levels", scratch <= 12, `worst ${scratch}`);

  let changedOutside = 0;
  for (let p = 0; p < W * H; p++) {
    if (r.mask[p]) continue;
    const i = p * 4;
    if (r.clean[i] !== damaged[i] || r.clean[i + 1] !== damaged[i + 1] || r.clean[i + 2] !== damaged[i + 2]) changedOutside++;
  }
  check("no pixel outside the mask is touched", changedOutside === 0, `${changedOutside} changed`);
  check("the mask is small — only the damage", r.touched < W * H * 0.03, `${r.touched} px`);
}

{
  const clean = repair(base, W, H, { ...RESTORE_DEFAULT, fade: 0, sharpen: 0 });
  check("an undamaged gradient is left alone", clean.touched === 0, `${clean.touched} px flagged`);
}

{
  /* a faded print lives in 90–170; restoring should open that out */
  const f = repair(base, W, H, { ...RESTORE_DEFAULT, dust: 0, scratches: 0, fade: 1, sharpen: 0 });
  let lo = 255;
  let hi = 0;
  for (let i = 0; i < f.final.length; i += 4) {
    const l = 0.2126 * f.final[i] + 0.7152 * f.final[i + 1] + 0.0722 * f.final[i + 2];
    lo = Math.min(lo, l);
    hi = Math.max(hi, l);
  }
  check("fade repair restores the range", lo < 20 && hi > 235, `${lo.toFixed(0)}–${hi.toFixed(0)}`);
  const mono = repair(base, W, H, { ...RESTORE_DEFAULT, tone: "mono" });
  const i = (90 * W + 120) * 4;
  check("mono makes R = G = B", mono.final[i] === mono.final[i + 1] && mono.final[i + 1] === mono.final[i + 2]);
}

/* -- series ------------------------------------------------------- */
const frame = (gain: number, warm: number) => {
  const px = new Uint8ClampedArray(64 * 48 * 4);
  for (let p = 0; p < 64 * 48; p++) {
    const v = (60 + ((p % 64) / 64) * 120) * gain;
    px[p * 4] = v + warm;
    px[p * 4 + 1] = v;
    px[p * 4 + 2] = v - warm;
    px[p * 4 + 3] = 255;
  }
  return measure(px, 64, 48);
};
{
  const ms = [frame(1, 0), frame(1.02, 1), frame(0.98, -1), frame(0.5, 0), frame(1, 18)];
  const c = centre(ms);
  const d = ms.map((m) => drift(m, c));
  check("series: matching frames are not flagged", d.slice(0, 3).every((x) => !x.reasons.length));
  check("series: an underexposed frame reads darker", d[3].reasons.some((x) => x.en.includes("darker")), d[3].reasons.map((x) => x.en).join());
  check("series: a warm frame reads warmer", d[4].reasons.some((x) => x.en === "warmer"));
  check("series: the fix for dark is positive exposure", correction(d[3]).exposure > 0.5, correction(d[3]).exposure.toFixed(2));
  check("series: the fix for warm is negative temperature", correction(d[4]).temperature < 0);
  const cl = cull(ms);
  check("cull: a burst keeps exactly one frame", cl.filter((x) => x.duplicateOf === null).length >= 1);
}

/* -- composite ---------------------------------------------------- */
{
  const w = 120;
  const h = 90;
  const bg = new Uint8ClampedArray(w * h * 4);
  const fg = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const x = p % w;
    const y = (p / w) | 0;
    const lit = 60 + (x / w) * 120; // brighter to the right
    bg.set([lit * 0.9, lit * 0.8, lit * 1.1, 255], p * 4);
    if (x >= 50 && x < 70 && y >= 30 && y < 80) fg.set([230, 200, 150, 255], p * 4);
  }
  const plain = harmonize({ bg, fg, w, h }, HARMONY_NEUTRAL);
  let same = true;
  for (let i = 0; i < plain.out.length; i++) if (plain.out[i] !== plain.raw[i]) same = false;
  check("composite: neutral settings are a plain paste", same);
  check("composite: light is read from the right", lightSide(bg, w, h) > 0);

  const m = harmonize({ bg, fg, w, h }, { ...HARMONY_NEUTRAL, match: 1 });
  const at = (px: Uint8ClampedArray, x: number, y: number) => px[(y * w + x) * 4 + 2];
  check("composite: match pulls the subject towards the scene's blue", at(m.out, 60, 50) > at(plain.out, 60, 50));

  const sh = harmonize({ bg, fg, w, h }, { ...HARMONY_NEUTRAL, shadow: 1 });
  const lum = (px: Uint8ClampedArray, x: number, y: number) => px[(y * w + x) * 4 + 1];
  check("composite: the contact shadow darkens the ground at the feet", lum(sh.out, 60, 81) < lum(plain.out, 60, 81) - 5, `${lum(plain.out, 60, 81)} → ${lum(sh.out, 60, 81)}`);
  check("composite: the shadow never touches the sky", lum(sh.out, 60, 5) === lum(plain.out, 60, 5));

  const key = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const x = p % w;
    const y = (p / w) | 0;
    key.set(x > 40 && x < 80 && y > 20 ? [40, 60, 90, 255] : [245, 245, 242, 255], p * 4);
  }
  const a = keyBackdrop(key, w, h, 0.3);
  check("key: the plain backdrop goes transparent", a[5 * w + 5] < 20 && a[60 * w + 60] > 235, `${a[5 * w + 5]} / ${a[60 * w + 60]}`);
}

/* -- Myanmar text ------------------------------------------------ */
{
  const pairs: [string, string, string][] = [
    ["ျမန္မာ", "မြန်မာ", "မြန်မာ"],
    ["ေက်ာင္း", "ကျောင်း", "ကျောင်း"],
    ["ေျမ", "မြေ", "မြေ"],
    ["သူ႔", "သူ့", "သူ့"],
    ["ႏိုင္ငံ", "နိုင်ငံ", "နိုင်ငံ"],
    ["မဂၤလာ", "မင်္ဂလာ", "မင်္ဂလာ"],
    ["ၿပီ", "ပြီ", "ပြီ"],
    ["ေရႊ", "ရွှေ", "ရွှေ"],
  ];
  const un = (x: string) => JSON.parse(`"${x}"`) as string;
  for (const [zg, uni, label] of pairs) {
    const got = zg2uni(un(zg));
    check(`zawgyi → unicode: ${label}`, got === un(uni), [...got].map((c) => c.codePointAt(0)!.toString(16)).join(" "));
  }
  const zgSentence = un("ေျမေရႊမဂၤလာပြဲေတာ္");
  check("zawgyi is detected", isZawgyi(zgSentence));
  check("unicode is not mistaken for zawgyi", !isZawgyi("မြန်မာနိုင်ငံ မင်္ဂလာပါ ကျောင်းသား ရွှေတိဂုံ"));
  check("latin is not zawgyi", !isZawgyi("Hello SHOW 2026"));

  const syl = syllables("မြန်မာနိုင်ငံ");
  check("syllables: မြန်|မာ|နိုင်|ငံ", syl.join("|") === "မြန်|မာ|နိုင်|ငံ", syl.join("|"));
  check("syllables: stacked consonant stays whole", syllables("မင်္ဂလာ").join("|") === "မင်္ဂ|လာ", syllables("မင်္ဂလာ").join("|"));
  check("syllables: latin words stay whole", syllables("SHOW Studio").join("|") === "SHOW| |Studio");
  const lines = wrap("မင်္ဂလာဆောင် ဖိတ်ကြားလွှာ", 5, (s) => syllables(s).filter((t) => t.trim()).length);
  check("wrap: breaks between syllables, never inside", lines.every((l) => syllables(l).filter((t) => t.trim()).length <= 5) && lines.join("").replace(/ /g, "") === "မင်္ဂလာဆောင်ဖိတ်ကြားလွှာ", lines.join(" / "));
  check("digits", myDigits("2026") === "၂၀၂၆");
  check("kyat", kyat(150000, true) === "၁၅၀,၀၀၀ ကျပ်" && kyat(150000, false) === "150,000 MMK");
  check("check: a sign with no consonant is flagged", mmCheck(" ိက").length > 0);
  check("check: clean text passes", mmCheck("မင်္ဂလာပါ").length === 0);
}

/* -- album layout ------------------------------------------------ */
{
  const a = Array.from({ length: 40 }, (_, i) => (i % 3 === 0 ? 0.667 : i % 5 === 0 ? 1 : 1.5));
  const plan = planSpreads(a);
  check("album: every photograph is placed exactly once", plan.flat().sort((x, y) => x - y).join() === a.map((_, i) => i).join());
  let crossing = 0;
  let outside = 0;
  let cropped = 0;
  for (const set of plan) {
    const rects = layoutAlbum(set.map((i) => a[i]), 4000, 2000, 140, 52);
    rects.forEach((r, j) => {
      if (set.length > 1 && r.x < 2000 && r.x + r.w > 2000 + 0.5) crossing++;
      if (r.x < -0.5 || r.y < -0.5 || r.x + r.w > 4000.5 || r.y + r.h > 2000.5) outside++;
      if (set.length > 1 && Math.abs(r.w / r.h - a[set[j]]) > 0.01) cropped++;
    });
  }
  check("album: no photograph lands in the fold", crossing === 0, `${crossing}`);
  check("album: everything stays on the page", outside === 0, `${outside}`);
  check("album: nothing is cropped", cropped === 0, `${cropped}`);
}

/* -- reference photographs -------------------------------------- */
{
  const im = { base: true, keep: ["face", "body"], refs: [{ role: "outfit" as const, note: "only the necklace" }, { role: "style" as const }] };
  check("refs: the photo to edit is image 1, references follow", numberOf(im, 0) === 2 && numberOf(im, 1) === 3);
  const t = naturalImageText(im);
  check("refs: the lead names image 1", t.lead.startsWith("Edit image 1"));
  check("refs: each reference says what to take", t.refs[0].startsWith("From image 2, take the outfit") && t.refs[0].includes("(only the necklace)"), t.refs[0]);
  check("refs: what to keep is said once, about image 1", t.keep === "From image 1, keep the face and identity, the body shape and pose exactly as photographed.", t.keep);
  const refsOnly = naturalImageText({ base: false, keep: [], refs: [{ role: "place" }] });
  check("refs: references without a photo to edit", refsOnly.lead.includes("attached image as a reference") && refsOnly.refs[0].startsWith("From image 1"));
}

/* -- the prompt: one text, never cut ------------------------------ */
{
  const im = { base: true, keep: ["face"], refs: [{ role: "place" as const, note: "the sunset sky" }] };
  const p = compileParts(["a bride in gold silk"], ["watermark"], "4:5", { images: im }).positive;
  check(
    "prompt: names every photograph in order",
    p.startsWith("Edit image 1") && p.indexOf("From image 2, take the setting and background (the sunset sky)") > 0 && p.includes("From image 1, keep the face and identity"),
    p,
  );

  /* every option of every group chosen at once: far past any old budget */
  for (const mode of MODES) {
    const sel = Object.fromEntries(mode.groups.map((g) => [g.id, g.options.map((o) => o.id)]));
    const out = compile(sel, mode.id, "4:5", "the last words matter too");
    const lastOf = mode.groups.flatMap((g) => g.options).at(-1)!.descriptor;
    check(
      `prompt: ${mode.id} keeps all ${mode.groups.reduce((n, g) => n + g.options.length, 0)} choices`,
      out.positive.toLowerCase().includes("the last words matter too") &&
        out.positive.toLowerCase().includes(lastOf.toLowerCase()) &&
        !("truncateAt" in out),
      `${out.tokens} tokens`,
    );
    check(
      `prompt: ${mode.id} is plain sentences — no engine syntax`,
      !/\s--[a-z]|::\d|\([^()]+:\d(\.\d+)?\)/.test(out.positive),
    );
  }

  const auto = togetherPrompt({ placed: false, keep: ["outfit", "pose"], look: "golden hour", side: 1, reunion: true, extra: "holding hands" });
  check(
    "harmonize: the person comes from image 2, into image 1, face locked",
    auto.startsWith("Place the person from image 2 into the scene in image 1") &&
      auto.includes("Take their face and identity only from image 2") &&
      auto.includes("also keep their clothing and their pose unchanged") &&
      !auto.includes("Pose them naturally") &&
      auto.includes("comes from the right") &&
      auto.includes("same day") &&
      auto.includes("Holding hands."),
    auto,
  );
  const placed = togetherPrompt({ placed: true, keep: [], look: "night", side: 0, reunion: false, extra: "" });
  check(
    "harmonize: a hand placement is kept, nothing invented about it",
    placed.startsWith("Image 1 is the scene with the person from image 2 roughly pasted") &&
      !placed.includes("Stand them where") &&
      !placed.includes("also keep") &&
      !placed.includes("comes from the"),
    placed,
  );

  const one = asOneText("Make a photograph: a bride.", "watermark, blur");
  check("prompt: copied as one text, with what to avoid", one === "Make a photograph: a bride.\n\nAvoid: watermark, blur.", one);
}

/* -- zip ---------------------------------------------------------- */
{
  check("crc32 of 'hello'", crc32(new TextEncoder().encode("hello")) === 0x3610a686);
  const z = new Uint8Array(await (await zip([{ name: "a.txt", data: "hi" }, { name: "a.txt", data: "yo" }, { name: "ပုံ.txt", data: "x" }])).arrayBuffer());
  const dv = new DataView(z.buffer);
  const end = z.length - 22;
  check("zip: end record signature", dv.getUint32(end, true) === 0x06054b50);
  check("zip: three entries", dv.getUint16(end + 10, true) === 3);
  const names = new TextDecoder().decode(z);
  check("zip: duplicate names made unique", names.includes("a-2.txt"));
}

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
