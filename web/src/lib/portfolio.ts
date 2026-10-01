"use client";

import { useSyncExternalStore } from "react";
import { canvas, ctx2d, toBlob } from "./image";
import { zip } from "./zip";
import type { WorkItem } from "./vault";

/* ------------------------------------------------------------------
   Portfolio — a real public page.

   The benchmark's "exhibition" publishes to nowhere a stranger can
   reach. Here the page is a real static site: an index.html, the
   photographs, and the card Facebook shows when the link is shared.
   It can be dropped on any host today, and SHOW's own address serves
   the same files once the server is connected.
   ------------------------------------------------------------------ */

export type Profile = {
  handle: string;
  name: string;
  nameMy: string;
  bio: string;
  bioMy: string;
  city: string;
  phone: string;
  messenger: string;
  viber: string;
  /** where the site will live — needed for the share card's absolute URL */
  address: string;
  theme: "black" | "ivory";
  cover: string | null;
};

const KEY = "show.portfolio.v1";

export const EMPTY_PROFILE: Profile = {
  handle: "",
  name: "",
  nameMy: "",
  bio: "",
  bioMy: "",
  city: "Yangon",
  phone: "",
  messenger: "",
  viber: "",
  address: "",
  theme: "black",
  cover: null,
};

let cache: Profile | null = null;
const listeners = new Set<() => void>();

function read(): Profile {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...EMPTY_PROFILE, ...(JSON.parse(raw) as Partial<Profile>) } : EMPTY_PROFILE;
  } catch {
    cache = EMPTY_PROFILE;
  }
  return cache;
}

export function saveProfile(p: Profile) {
  cache = p;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* kept for this session */
  }
  listeners.forEach((l) => l());
}

export function useProfile(): Profile {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => EMPTY_PROFILE,
  );
}

export const cleanHandle = (s: string) =>
  s
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 30);

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/* -- images -------------------------------------------------------- */

async function resized(blob: Blob, max: number, q = 0.88): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = canvas(Math.round(bmp.width * k), Math.round(bmp.height * k));
  ctx2d(c).drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return toBlob(c, "image/jpeg", q);
}

/** The card a share shows: 1200×630, the cover, the name. */
export async function shareCard(p: Profile, cover: Blob | null, fonts: { sans: string; my: string }): Promise<Blob> {
  const W = 1200;
  const H = 630;
  const c = canvas(W, H);
  const x = ctx2d(c);
  x.fillStyle = p.theme === "black" ? "#08080a" : "#f7f1e6";
  x.fillRect(0, 0, W, H);
  if (cover) {
    const bmp = await createImageBitmap(cover);
    const ia = bmp.width / bmp.height;
    const ra = W / H;
    const sw = ia > ra ? bmp.height * ra : bmp.width;
    const sh = ia > ra ? bmp.height : bmp.width / ra;
    x.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) * 0.4, sw, sh, 0, 0, W, H);
    bmp.close();
    const g = x.createLinearGradient(0, 0, W * 0.75, 0);
    g.addColorStop(0, "rgba(8,8,10,0.86)");
    g.addColorStop(1, "rgba(8,8,10,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
  }
  const ink = cover || p.theme === "black" ? "#f2efe9" : "#14130f";
  x.fillStyle = "#d4a22f";
  x.fillRect(72, 200, 56, 2);
  x.textBaseline = "alphabetic";
  x.font = `800 22px ${fonts.sans}`;
  if ("letterSpacing" in x) (x as unknown as { letterSpacing: string }).letterSpacing = "6px";
  x.fillText(`@${p.handle || "yourname"}`.toUpperCase(), 72, 180);
  if ("letterSpacing" in x) (x as unknown as { letterSpacing: string }).letterSpacing = "0px";
  x.fillStyle = ink;
  x.font = `200 76px ${fonts.sans}, ${fonts.my}`;
  x.fillText(p.name || "Your name", 70, 300);
  if (p.nameMy) {
    x.font = `700 44px ${fonts.my}, ${fonts.sans}`;
    x.fillText(p.nameMy, 72, 372);
  }
  x.font = `500 24px ${fonts.sans}, ${fonts.my}`;
  x.globalAlpha = 0.72;
  x.fillText([p.city, "Photography"].filter(Boolean).join(" · "), 72, 540);
  x.globalAlpha = 1;
  return toBlob(c, "image/jpeg", 0.9);
}

/* -- the page -------------------------------------------------------- */

export type SiteImage = { src: string; w: number; h: number; caption: string; captionMy: string };

export function pageHtml(p: Profile, images: SiteImage[], coverSrc: string | null, ogSrc: string): string {
  const dark = p.theme === "black";
  const title = p.name ? `${p.name}${p.nameMy ? ` · ${p.nameMy}` : ""}` : "Portfolio";
  const desc = p.bio || p.bioMy || `Photography${p.city ? ` in ${p.city}` : ""}`;
  const base = p.address.replace(/\/+$/, "");
  const og = base ? `${base}/${ogSrc}` : ogSrc;
  const contact = [
    p.messenger ? `<a href="https://m.me/${esc(p.messenger.replace(/^.*m\.me\//, ""))}">Messenger</a>` : "",
    p.viber ? `<a href="viber://chat?number=${esc(p.viber.replace(/[^\d+]/g, ""))}">Viber</a>` : "",
    p.phone ? `<a href="tel:${esc(p.phone.replace(/[^\d+]/g, ""))}">${esc(p.phone)}</a>` : "",
  ]
    .filter(Boolean)
    .join("");

  return `<!doctype html>
<html lang="my">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="profile">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(og)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
${base ? `<meta property="og:url" content="${esc(base)}/">` : ""}
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Padauk:wght@400;700&family=Plus+Jakarta+Sans:wght@200;500;800&display=swap">
<style>
:root{--bg:${dark ? "#08080a" : "#f7f1e6"};--ink:${dark ? "#f2efe9" : "#14130f"};--ink2:${dark ? "#9c978e" : "#5a564d"};--gold:${dark ? "#d4a22f" : "#8a6a17"};--line:${dark ? "rgba(255,255,255,.08)" : "rgba(20,19,15,.1)"}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:500 16px/1.7 "Plus Jakarta Sans","Padauk",system-ui,sans-serif}
.my{font-family:"Padauk","Plus Jakarta Sans",sans-serif;line-height:1.9}
a{color:inherit}
header{position:relative;min-height:${coverSrc ? "88svh" : "auto"};display:flex;align-items:flex-end;padding:clamp(24px,6vw,72px) 16px}
header img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
header::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,var(--bg) 0%,rgba(0,0,0,0) 55%)}
.who{position:relative;z-index:1;max-width:1200px;margin:0 auto;width:100%}
.handle{font-weight:800;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold)}
h1{font-weight:200;font-size:clamp(40px,9vw,112px);line-height:.98;letter-spacing:-.03em;margin:.2em 0 .1em}
.nm{font-size:clamp(22px,4vw,36px);font-weight:700;margin:0}
.bio{max-width:62ch;color:var(--ink2);margin:18px 0 0}
.contact{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}
.contact a{text-decoration:none;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;padding:12px 18px;border:1px solid var(--gold);border-radius:6px;color:var(--gold)}
.contact a:first-child{background:var(--gold);color:var(--bg)}
main{max-width:1400px;margin:0 auto;padding:24px 16px 64px;columns:2 160px;column-gap:12px}
figure{margin:0 0 16px;break-inside:avoid}
figure button{all:unset;display:block;cursor:zoom-in;width:100%}
figure img{display:block;width:100%;height:auto;border-radius:4px;background:#000}
figcaption{font-size:13px;color:var(--ink2);margin-top:8px}
figcaption span{display:block}
@media(min-width:900px){main{columns:3 280px;column-gap:20px;padding:40px 32px 96px}header{padding:72px 32px}}
footer{border-top:1px solid var(--line);padding:24px 16px;text-align:center;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink2)}
.lb{position:fixed;inset:0;background:rgba(0,0,0,.94);display:none;align-items:center;justify-content:center;z-index:9;cursor:zoom-out}
.lb.on{display:flex}.lb img{max-width:96vw;max-height:92vh;object-fit:contain}
</style>
</head>
<body>
<header>
${coverSrc ? `<img src="${esc(coverSrc)}" alt="">` : ""}
<div class="who">
<div class="handle">@${esc(p.handle || "yourname")}${p.city ? ` · ${esc(p.city)}` : ""}</div>
<h1>${esc(p.name || "Your name")}</h1>
${p.nameMy ? `<p class="nm my">${esc(p.nameMy)}</p>` : ""}
${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ""}
${p.bioMy ? `<p class="bio my">${esc(p.bioMy)}</p>` : ""}
${contact ? `<div class="contact">${contact}</div>` : ""}
</div>
</header>
<main>
${images
  .map(
    (im) => `<figure><button type="button" data-full="${esc(im.src)}"><img src="${esc(im.src)}" width="${im.w}" height="${im.h}" loading="lazy" alt="${esc(im.caption)}"></button>${
      im.caption || im.captionMy
        ? `<figcaption>${im.caption ? `<span>${esc(im.caption)}</span>` : ""}${im.captionMy ? `<span class="my">${esc(im.captionMy)}</span>` : ""}</figcaption>`
        : ""
    }</figure>`,
  )
  .join("\n")}
</main>
<footer>Made with SHOW</footer>
<div class="lb" id="lb"><img alt=""></div>
<script>
var lb=document.getElementById("lb"),li=lb.querySelector("img");
document.querySelectorAll("[data-full]").forEach(function(b){b.addEventListener("click",function(){li.src=b.getAttribute("data-full");lb.classList.add("on")})});
lb.addEventListener("click",function(){lb.classList.remove("on")});
document.addEventListener("keydown",function(e){if(e.key==="Escape")lb.classList.remove("on")});
</script>
</body>
</html>
`;
}

/** Everything the site needs, as one zip to drop on any host. */
export async function buildSite(p: Profile, works: WorkItem[], fonts: { sans: string; my: string }): Promise<Blob> {
  const files: { name: string; data: Blob | string }[] = [];
  const images: SiteImage[] = [];
  for (let i = 0; i < works.length; i++) {
    const w = works[i];
    const img = await resized(w.blob, 2400);
    const name = `images/${String(i + 1).padStart(3, "0")}.jpg`;
    files.push({ name, data: img });
    const k = Math.min(1, 2400 / Math.max(w.w, w.h));
    images.push({ src: name, w: Math.round(w.w * k), h: Math.round(w.h * k), caption: w.exhibit?.caption ?? "", captionMy: w.exhibit?.captionMy ?? "" });
  }
  const coverWork = works.find((w) => w.id === p.cover) ?? works[0] ?? null;
  let coverSrc: string | null = null;
  if (coverWork) {
    coverSrc = "images/cover.jpg";
    files.push({ name: coverSrc, data: await resized(coverWork.blob, 2800) });
  }
  files.push({ name: "og.jpg", data: await shareCard(p, coverWork?.blob ?? null, fonts) });
  files.unshift({ name: "index.html", data: pageHtml(p, images, coverSrc, "og.jpg") });
  return zip(files);
}
