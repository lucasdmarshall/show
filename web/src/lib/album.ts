/* ------------------------------------------------------------------
   Album — the Myanmar Text Engine, the layout half.

   Covers, invitations, price lists, promos, testimonials and album
   spreads, set as real type on a canvas. The browser's shaper does the
   Burmese; lib/myanmar breaks the lines at syllables and fixes Zawgyi
   on the way in. One renderer draws the preview and the export, so what
   is approved is exactly what prints.
   ------------------------------------------------------------------ */

import { kyat, myDigits, wrap } from "./myanmar";
import { layoutAlbum, planSpreads, type Rect } from "./layout";

export type TemplateId = "cover" | "invitation" | "pricelist" | "promo" | "testimonial" | "spread";

export const TEMPLATES: { id: TemplateId; label: string; labelMy: string; photos: number }[] = [
  { id: "invitation", label: "Invitation", labelMy: "ဖိတ်စာ", photos: 1 },
  { id: "cover", label: "Album cover", labelMy: "အယ်လ်ဘမ် မျက်နှာဖုံး", photos: 1 },
  { id: "spread", label: "Album spreads", labelMy: "အယ်လ်ဘမ် စာမျက်နှာ", photos: 300 },
  { id: "pricelist", label: "Price list", labelMy: "ဈေးနှုန်းစာရင်း", photos: 1 },
  { id: "promo", label: "Promotion", labelMy: "ပရိုမိုးရှင်း", photos: 1 },
  { id: "testimonial", label: "Testimonial", labelMy: "သုံးသပ်ချက်", photos: 1 },
];

export type Format = { id: string; label: string; labelMy: string; w: number; h: number };

export const FORMATS: Format[] = [
  { id: "post", label: "Facebook post 4:5", labelMy: "Facebook post", w: 1600, h: 2000 },
  { id: "square", label: "Square", labelMy: "လေးထောင့်", w: 2048, h: 2048 },
  { id: "story", label: "Story / Reel", labelMy: "Story", w: 1080, h: 1920 },
  { id: "fbcover", label: "Facebook cover", labelMy: "FB cover", w: 1640, h: 624 },
  { id: "card", label: "Card 5×7 in", labelMy: "ကတ် ၅×၇", w: 1500, h: 2100 },
  { id: "a5", label: "A5 print", labelMy: "A5 print", w: 1748, h: 2480 },
  { id: "spread", label: "Album spread 2:1", labelMy: "Spread ၂:၁", w: 4000, h: 2000 },
];

export type Palette = { id: string; label: string; labelMy: string; bg: string; ink: string; soft: string; accent: string };

export const PALETTES: Palette[] = [
  { id: "black-gold", label: "Black & gold", labelMy: "အနက်နဲ့ ရွှေ", bg: "#0b0b0d", ink: "#f2efe9", soft: "#9c978e", accent: "#d4a22f" },
  { id: "ivory", label: "Ivory", labelMy: "ဆင်စွယ်ရောင်", bg: "#f7f1e6", ink: "#231c14", soft: "#7a6c5b", accent: "#9a7420" },
  { id: "maroon", label: "Maroon & gold", labelMy: "နီညိုနဲ့ ရွှေ", bg: "#4a0f14", ink: "#fbecd5", soft: "#d9b99b", accent: "#e8b64c" },
  { id: "emerald", label: "Emerald", labelMy: "မြစိမ်း", bg: "#0e2e25", ink: "#f1ead9", soft: "#a7bfae", accent: "#d8b45a" },
  { id: "blush", label: "Blush", labelMy: "ပန်းနု", bg: "#f8e9e6", ink: "#3a2326", soft: "#8b6a6e", accent: "#b5646f" },
  { id: "white", label: "White", labelMy: "အဖြူ", bg: "#ffffff", ink: "#111111", soft: "#6b6b6b", accent: "#111111" },
];

export type Item = { name: string; price: number; note: string };

export type Doc = {
  template: TemplateId;
  format: string;
  palette: string;
  serif: boolean;
  burmeseDigits: boolean;
  fields: Record<string, string>;
  items: Item[];
};

export const FIELDS: Record<TemplateId, { id: string; label: string; labelMy: string; multi?: boolean; initial: string }[]> = {
  invitation: [
    { id: "heading", label: "Heading", labelMy: "ခေါင်းစဉ်", initial: "မင်္ဂလာ ဖိတ်ကြားလွှာ" },
    { id: "names", label: "Names", labelMy: "အမည်များ", initial: "ကိုအောင်မြတ်  &  မသဉ္ဇာ" },
    { id: "body", label: "Message", labelMy: "စာသား", multi: true, initial: "ကျွန်ုပ်တို့၏ မင်္ဂလာအခမ်းအနားသို့ ကြွရောက်ချီးမြှင့်ပေးပါရန် လေးစားစွာ ဖိတ်ကြားအပ်ပါသည်။" },
    { id: "date", label: "Date", labelMy: "ရက်စွဲ", initial: "၂၀၂၆ ခုနှစ်၊ ဒီဇင်ဘာလ ၁၂ ရက်၊ စနေနေ့" },
    { id: "time", label: "Time", labelMy: "အချိန်", initial: "နံနက် ၉ နာရီ မှ ၁၁ နာရီ" },
    { id: "venue", label: "Venue", labelMy: "နေရာ", multi: true, initial: "စထရင်းဟိုတယ်၊ ဧည့်ခန်းမကြီး\nကမ်းနားလမ်း၊ ရန်ကုန်" },
  ],
  cover: [
    { id: "title", label: "Title", labelMy: "ခေါင်းစဉ်", initial: "အောင်မြတ် & သဉ္ဇာ" },
    { id: "subtitle", label: "Subtitle", labelMy: "ခေါင်းစဉ်ခွဲ", initial: "Our Wedding Day" },
    { id: "date", label: "Date", labelMy: "ရက်စွဲ", initial: "12 · 12 · 2026" },
  ],
  spread: [{ id: "caption", label: "Caption on first page", labelMy: "ပထမစာမျက်နှာ စာတန်း", initial: "" }],
  pricelist: [
    { id: "studio", label: "Studio", labelMy: "စတူဒီယို", initial: "SHOW Studio" },
    { id: "headline", label: "Headline", labelMy: "ခေါင်းစဉ်", initial: "ဓာတ်ပုံ ဈေးနှုန်းများ" },
    { id: "contact", label: "Contact", labelMy: "ဆက်သွယ်ရန်", initial: "☎ 09 123 456 789  ·  m.me/showstudio" },
  ],
  promo: [
    { id: "offer", label: "Offer", labelMy: "လျှော့ဈေး", initial: "၃၀%" },
    { id: "headline", label: "Headline", labelMy: "ခေါင်းစဉ်", initial: "သီတင်းကျွတ် အထူးလျှော့ဈေး" },
    { id: "sub", label: "Details", labelMy: "အသေးစိတ်", multi: true, initial: "အောက်တိုဘာလ တစ်လလုံး မင်္ဂလာ package အားလုံး" },
    { id: "cta", label: "Call to action", labelMy: "လုပ်စေချင်တာ", initial: "ယခုပဲ Messenger မှ booking လုပ်ပါ" },
  ],
  testimonial: [
    { id: "quote", label: "Quote", labelMy: "ပြောစကား", multi: true, initial: "ပုံတွေ ရလာတော့ မိသားစုတစ်ခုလုံး ငိုကြတယ်။ ဒီလောက် လှလိမ့်မယ်လို့ မထင်ခဲ့ဘူး။" },
    { id: "name", label: "Name", labelMy: "အမည်", initial: "မသဉ္ဇာ" },
    { id: "role", label: "Who", labelMy: "ဘယ်သူလဲ", initial: "မင်္ဂလာဆောင် · ၂၀၂၆" },
  ],
};

export const DEFAULT_ITEMS: Item[] = [
  { name: "မင်္ဂလာ Pre-wedding", price: 450000, note: "ပြင်ပ ၂ နေရာ · ပုံ ၄၀" },
  { name: "မင်္ဂလာဆောင် နေ့", price: 800000, note: "ဓာတ်ပုံဆရာ ၂ ယောက် · album တစ်အုပ်" },
  { name: "ကလေး studio", price: 180000, note: "Theme ၃ ခု · ပုံ ၂၀" },
  { name: "မိသားစု portrait", price: 120000, note: "စတူဒီယို · ၁ နာရီ" },
];

export const initialDoc = (template: TemplateId): Doc => ({
  template,
  format: template === "spread" ? "spread" : template === "invitation" ? "card" : "post",
  palette: template === "invitation" ? "maroon" : template === "pricelist" ? "black-gold" : "ivory",
  serif: template === "invitation" || template === "cover",
  burmeseDigits: true,
  fields: Object.fromEntries(FIELDS[template].map((f) => [f.id, f.initial])),
  items: DEFAULT_ITEMS,
});

/* -- album spreads: laid out in lib/layout (runs under the checks) -- */

export { planSpreads, layoutSpread, layoutAlbum, type Rect } from "./layout";

/* -- the renderer ------------------------------------------------- */

export type Fonts = { sans: string; my: string; serif: string };

type Style = { size: number; weight?: number; color: string; align?: CanvasTextAlign; lh?: number; family: string; tracking?: number };

function setFont(ctx: CanvasRenderingContext2D, s: Style) {
  ctx.font = `${s.weight ?? 400} ${s.size}px ${s.family}`;
  ctx.fillStyle = s.color;
  ctx.textAlign = s.align ?? "center";
  ctx.textBaseline = "alphabetic";
  if ("letterSpacing" in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${s.tracking ?? 0}px`;
}

/** Set a block of text inside a width; returns the height used. */
export function block(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, s: Style): number {
  setFont(ctx, s);
  const lines = wrap(text, maxW, (t) => ctx.measureText(t).width);
  const lh = s.size * (s.lh ?? 1.5);
  lines.forEach((l, i) => ctx.fillText(l, x, y + s.size + i * lh));
  return lines.length ? s.size + (lines.length - 1) * lh + s.size * 0.35 : 0;
}

/** The largest size, up to `max`, at which the text fits in `lines` lines. */
export function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number, max: number, lines: number, s: Omit<Style, "size">): number {
  for (let size = max; size > 10; size *= 0.93) {
    setFont(ctx, { ...s, size });
    if (wrap(text, maxW, (t) => ctx.measureText(t).width).length <= lines) return size;
  }
  return 10;
}

export function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, r: Rect, focusY = 0.4) {
  const ia = img.width / img.height;
  const ra = r.w / r.h;
  let sw = img.width;
  let sh = img.height;
  let sx = 0;
  let sy = 0;
  if (ia > ra) {
    sw = img.height * ra;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / ra;
    sy = (img.height - sh) * focusY;
  }
  ctx.drawImage(img, sx, sy, sw, sh, r.x, r.y, r.w, r.h);
}

/* a Burmese-leaning frame: double hairline and a curl at each corner */
function frame(ctx: CanvasRenderingContext2D, W: number, H: number, inset: number, color: string) {
  const u = Math.min(W, H) / 1000;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2 * u;
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  ctx.lineWidth = 1 * u;
  const i2 = inset + 12 * u;
  ctx.strokeRect(i2, i2, W - i2 * 2, H - i2 * 2);
  const curl = (cx: number, cy: number, sx: number, sy: number) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy + sy * 60 * u);
    ctx.bezierCurveTo(cx, cy + sy * 20 * u, cx + sx * 20 * u, cy, cx + sx * 60 * u, cy);
    ctx.moveTo(cx + sx * 18 * u, cy + sy * 18 * u);
    ctx.arc(cx + sx * 18 * u, cy + sy * 18 * u, 9 * u, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + sx * 34 * u, cy + sy * 34 * u - 7 * u);
    ctx.lineTo(cx + sx * 34 * u + 7 * u, cy + sy * 34 * u);
    ctx.lineTo(cx + sx * 34 * u, cy + sy * 34 * u + 7 * u);
    ctx.lineTo(cx + sx * 34 * u - 7 * u, cy + sy * 34 * u);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  const c = i2 + 6 * u;
  curl(c, c, 1, 1);
  curl(W - c, c, -1, 1);
  curl(c, H - c, 1, -1);
  curl(W - c, H - c, -1, -1);
  ctx.restore();
}

function rule(ctx: CanvasRenderingContext2D, cx: number, y: number, w: number, color: string, u: number) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.4 * u;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, y);
  ctx.lineTo(cx - 12 * u, y);
  ctx.moveTo(cx + 12 * u, y);
  ctx.lineTo(cx + w / 2, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, y - 6 * u);
  ctx.lineTo(cx + 6 * u, y);
  ctx.lineTo(cx, y + 6 * u);
  ctx.lineTo(cx - 6 * u, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export type Photo = CanvasImageSource & { width: number; height: number };

/**
 * Draw one page. `page` is the spread index for album spreads; every
 * other template has one page.
 */
export function render(ctx: CanvasRenderingContext2D, doc: Doc, photos: Photo[], fonts: Fonts, page = 0) {
  const fmt = FORMATS.find((f) => f.id === doc.format)!;
  const W = fmt.w;
  const H = fmt.h;
  const pal = PALETTES.find((p) => p.id === doc.palette)!;
  const u = Math.min(W, H) / 1000;
  const f = doc.fields;
  const num = (s: string) => (doc.burmeseDigits ? myDigits(s) : s);
  const my = `${doc.serif ? fonts.serif : fonts.my}, ${fonts.sans}`;
  const sans = `${fonts.sans}, ${fonts.my}`;
  const wide = W / H > 1.6;

  /* Flowing templates are drawn, measured, and drawn again smaller if
     the words ran past the page — long names and long venues happen. */
  const draw = (z: number, dy = 0): number => {
    const t = u * z;
    let bottom = 0;
    ctx.save();
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    switch (doc.template) {
      case "invitation": {
        const p = photos[0];
        let y = 150 * t + dy;
        frame(ctx, W, H, 44 * u, pal.accent);
        if (p && !wide) {
          const ph = H * 0.34 * z;
          const pw = ph * 0.8;
          ctx.save();
          ctx.beginPath();
          /* an arched window, the shape of a pagoda doorway */
          const x0 = (W - pw) / 2;
          ctx.moveTo(x0, y + ph);
          ctx.lineTo(x0, y + pw / 2);
          ctx.arc(W / 2, y + pw / 2, pw / 2, Math.PI, 0);
          ctx.lineTo(x0 + pw, y + ph);
          ctx.closePath();
          ctx.clip();
          drawCover(ctx, p, { x: x0, y, w: pw, h: ph });
          ctx.restore();
          ctx.strokeStyle = pal.accent;
          ctx.lineWidth = 2 * u;
          ctx.beginPath();
          ctx.moveTo(x0 - 10 * t, y + ph + 10 * t);
          ctx.lineTo(x0 - 10 * t, y + pw / 2);
          ctx.arc(W / 2, y + pw / 2, pw / 2 + 10 * t, Math.PI, 0);
          ctx.lineTo(x0 + pw + 10 * t, y + ph + 10 * t);
          ctx.stroke();
          y += ph + 70 * t;
        } else {
          y += 60 * t;
        }
        const mw = W - 260 * t;
        y += block(ctx, f.heading ?? "", W / 2, y, mw, { size: 44 * t, color: pal.accent, family: my, weight: 700 });
        rule(ctx, W / 2, y + 26 * t, 260 * t, pal.accent, u);
        y += 60 * t;
        const nameSize = fit(ctx, f.names ?? "", mw, 88 * t, 2, { color: pal.ink, family: my, weight: 700 });
        y += block(ctx, f.names ?? "", W / 2, y, mw, { size: nameSize, color: pal.ink, family: my, weight: 700, lh: 1.35 });
        y += 30 * t;
        y += block(ctx, f.body ?? "", W / 2, y, mw * 0.92, { size: 30 * t, color: pal.soft, family: my, lh: 1.75 });
        y += 40 * t;
        rule(ctx, W / 2, y, 160 * t, pal.accent, u);
        y += 34 * t;
        y += block(ctx, num(f.date ?? ""), W / 2, y, mw, { size: 34 * t, color: pal.ink, family: my, weight: 700 });
        y += block(ctx, num(f.time ?? ""), W / 2, y + 6 * t, mw, { size: 30 * t, color: pal.soft, family: my });
        y += 30 * t;
        y += block(ctx, f.venue ?? "", W / 2, y, mw, { size: 30 * t, color: pal.ink, family: my, lh: 1.6 });
        bottom = y + 150 * u;
        break;
      }

      case "cover": {
        const p = photos[0];
        if (p) {
          drawCover(ctx, p, { x: 0, y: 0, w: W, h: H });
          const g = ctx.createLinearGradient(0, H * 0.45, 0, H);
          g.addColorStop(0, "rgba(0,0,0,0)");
          g.addColorStop(1, "rgba(0,0,0,0.72)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, W, H);
        }
        const ink = p ? "#f6f1e7" : pal.ink;
        const mw = W - 200 * u;
        const ts = fit(ctx, f.title ?? "", mw, 120 * u, 2, { color: ink, family: my, weight: 700 });
        setFont(ctx, { size: ts, color: ink, family: my, weight: 700 });
        const tl = wrap(f.title ?? "", mw, (t) => ctx.measureText(t).width).length;
        let y = H - 140 * u - ts * 1.3 * tl - 80 * u;
        y += block(ctx, f.title ?? "", W / 2, y, mw, { size: ts, color: ink, family: my, weight: 700, lh: 1.3 });
        rule(ctx, W / 2, y + 24 * u, 200 * u, pal.accent, u);
        block(ctx, f.subtitle ?? "", W / 2, y + 44 * u, mw, { size: 34 * u, color: ink, family: sans, weight: 300, tracking: 3 * u });
        block(ctx, num(f.date ?? ""), W / 2, H - 110 * u, mw, { size: 26 * u, color: pal.accent, family: sans, weight: 800, tracking: 8 * u });
        break;
      }

      case "spread": {
        const plan = planSpreads(photos.map((p) => p.width / p.height));
        const set = plan[page] ?? [];
        const margin = set.length === 1 ? 0 : 70 * u;
        const rects = layoutAlbum(set.map((i) => photos[i].width / photos[i].height), W, H, margin, 26 * u);
        set.forEach((pi, k) => drawCover(ctx, photos[pi], rects[k]));
        /* the gutter of a lay-flat album: a faint fold */
        const g = ctx.createLinearGradient(W / 2 - 40 * u, 0, W / 2 + 40 * u, 0);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(0.5, "rgba(0,0,0,0.18)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(W / 2 - 40 * u, 0, 80 * u, H);
        if (page === 0 && f.caption) {
          block(ctx, f.caption, W * 0.75, H - 150 * u, W * 0.4, { size: 40 * u, color: set.length === 1 ? "#fff" : pal.ink, family: my, weight: 700 });
        }
        break;
      }

      case "pricelist": {
        const p = photos[0];
        const top = wide ? 0 : H * 0.3;
        if (p && !wide) {
          drawCover(ctx, p, { x: 0, y: 0, w: W, h: top });
          const g = ctx.createLinearGradient(0, top * 0.5, 0, top);
          g.addColorStop(0, "rgba(0,0,0,0)");
          g.addColorStop(1, pal.bg);
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, W, top);
        }
        const x0 = 110 * u;
        const mw = W - x0 * 2;
        let y = top + 30 * u;
        block(ctx, (f.studio ?? "").toUpperCase(), W / 2, y, mw, { size: 24 * u, color: pal.accent, family: sans, weight: 800, tracking: 10 * u });
        y += 60 * u;
        y += block(ctx, f.headline ?? "", W / 2, y, mw, { size: 64 * u, color: pal.ink, family: my, weight: 700 });
        y += 40 * u;
        const rowH = Math.min(150 * u, (H - y - 170 * u) / Math.max(1, doc.items.length));
        doc.items.forEach((it) => {
          setFont(ctx, { size: rowH * 0.3, color: pal.ink, family: my, weight: 700, align: "left" });
          ctx.fillText(it.name, x0, y + rowH * 0.36);
          const price = kyat(it.price, doc.burmeseDigits);
          setFont(ctx, { size: rowH * 0.3, color: pal.accent, family: my, weight: 700, align: "right" });
          ctx.fillText(price, W - x0, y + rowH * 0.36);
          const nameW = (() => {
            setFont(ctx, { size: rowH * 0.3, color: pal.ink, family: my, weight: 700, align: "left" });
            return ctx.measureText(it.name).width;
          })();
          setFont(ctx, { size: rowH * 0.3, color: pal.accent, family: my, weight: 700, align: "right" });
          const priceW = ctx.measureText(price).width;
          /* dotted leader between name and price */
          ctx.save();
          ctx.strokeStyle = pal.soft;
          ctx.globalAlpha = 0.5;
          ctx.setLineDash([2 * u, 8 * u]);
          ctx.lineWidth = 2 * u;
          ctx.beginPath();
          ctx.moveTo(x0 + nameW + 20 * u, y + rowH * 0.33);
          ctx.lineTo(W - x0 - priceW - 20 * u, y + rowH * 0.33);
          ctx.stroke();
          ctx.restore();
          setFont(ctx, { size: rowH * 0.2, color: pal.soft, family: my, align: "left" });
          ctx.fillText(num(it.note), x0, y + rowH * 0.72);
          y += rowH;
        });
        block(ctx, num(f.contact ?? ""), W / 2, H - 120 * u, mw, { size: 28 * u, color: pal.soft, family: `${fonts.sans}, ${fonts.my}` });
        break;
      }

      case "promo": {
        const p = photos[0];
        if (p) drawCover(ctx, p, wide ? { x: W * 0.5, y: 0, w: W * 0.5, h: H } : { x: 0, y: 0, w: W, h: H * 0.58 });
        const tx = wide ? W * 0.25 : W / 2;
        const mw = wide ? W * 0.42 : W - 180 * t;
        let y = wide ? 90 * t : H * 0.58 + 50 * t;
        /* the offer, as a seal */
        const sealR = 120 * t;
        const sx = wide ? tx : W - 200 * t;
        const sy = wide ? y + sealR : H * 0.58;
        ctx.fillStyle = pal.accent;
        ctx.beginPath();
        for (let k = 0; k < 48; k++) {
          const a = (k / 48) * Math.PI * 2;
          const rr = k % 2 ? sealR : sealR * 0.9;
          ctx.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
        const os = fit(ctx, num(f.offer ?? ""), sealR * 1.5, 80 * t, 1, { color: pal.bg, family: my, weight: 700 });
        setFont(ctx, { size: os, color: pal.bg, family: my, weight: 700 });
        ctx.textBaseline = "middle";
        ctx.fillText(num(f.offer ?? ""), sx, sy);
        ctx.textBaseline = "alphabetic";
        if (wide) y += sealR * 2 + 40 * t;
        else y += 60 * t;
        const hs = fit(ctx, f.headline ?? "", mw, 76 * t, 2, { color: pal.ink, family: my, weight: 700 });
        y += block(ctx, f.headline ?? "", tx, y, mw, { size: hs, color: pal.ink, family: my, weight: 700, lh: 1.4 });
        y += 20 * t;
        y += block(ctx, num(f.sub ?? ""), tx, y, mw, { size: 32 * t, color: pal.soft, family: my, lh: 1.7 });
        y += 36 * t;
        setFont(ctx, { size: 30 * t, color: pal.bg, family: my, weight: 700 });
        const cw = Math.min(mw, ctx.measureText(f.cta ?? "").width + 90 * t);
        ctx.fillStyle = pal.ink;
        const ch = 86 * t;
        ctx.beginPath();
        ctx.roundRect(tx - cw / 2, y, cw, ch, ch / 2);
        ctx.fill();
        setFont(ctx, { size: 30 * t, color: pal.bg, family: my, weight: 700 });
        ctx.textBaseline = "middle";
        ctx.fillText(f.cta ?? "", tx, y + ch / 2);
        ctx.textBaseline = "alphabetic";
        bottom = y + ch + 60 * u;
        break;
      }

      case "testimonial": {
        const p = photos[0];
        const r = Math.min(W, H) * 0.16 * z;
        let y = (wide ? 110 * t : H * 0.16) + dy;
        if (p) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(W / 2, y + r, r, 0, Math.PI * 2);
          ctx.clip();
          drawCover(ctx, p, { x: W / 2 - r, y, w: r * 2, h: r * 2 }, 0.3);
          ctx.restore();
          ctx.strokeStyle = pal.accent;
          ctx.lineWidth = 2 * u;
          ctx.beginPath();
          ctx.arc(W / 2, y + r, r + 12 * t, 0, Math.PI * 2);
          ctx.stroke();
          y += r * 2 + 80 * t;
        }
        setFont(ctx, { size: 200 * t, color: pal.accent, family: `Georgia, ${fonts.serif}` });
        ctx.fillText("“", W / 2, y + 110 * t);
        y += 110 * t;
        const mw = W - 220 * t;
        const qs = fit(ctx, f.quote ?? "", mw, 56 * t, wide ? 3 : 6, { color: pal.ink, family: my, weight: 400 });
        y += block(ctx, f.quote ?? "", W / 2, y, mw, { size: qs, color: pal.ink, family: my, lh: 1.7 });
        y += 40 * t;
        rule(ctx, W / 2, y, 140 * t, pal.accent, u);
        y += 30 * t;
        y += block(ctx, f.name ?? "", W / 2, y, mw, { size: 38 * t, color: pal.ink, family: my, weight: 700 });
        y += block(ctx, num(f.role ?? ""), W / 2, y, mw, { size: 28 * t, color: pal.soft, family: my });
        bottom = y + 90 * u;
        break;
      }
    }
    ctx.restore();
    return bottom;
  };

  /* the largest scale that fits, then the block centred in what is left */
  let ok = 1;
  let bottom = draw(1);
  if (bottom > H) {
    let lo = 0.4;
    let hi = 1;
    for (let k = 0; k < 7; k++) {
      const mid = (lo + hi) / 2;
      if (draw(mid) <= H) lo = mid;
      else hi = mid;
    }
    ok = lo;
    bottom = draw(ok);
  }
  if ((doc.template === "invitation" || doc.template === "testimonial") && bottom < H) {
    draw(ok, (H - bottom) / 2);
  }
}

export const pagesOf = (doc: Doc, photoAspects: number[]) =>
  doc.template === "spread" ? Math.max(1, planSpreads(photoAspects).length) : 1;
