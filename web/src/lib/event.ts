"use client";

import QRCode from "qrcode";
import { compilePipeline, renderFinal, type Settings } from "./grade";
import { measure, type Metrics } from "./series";
import { canvas, ctx2d, readImage, thumbnail, toBlob, uid } from "./image";
import { table } from "./vault";
import { API, connected } from "./premium";

/* ------------------------------------------------------------------
   Event — photographs into guests' hands before they leave.

   Everything is kept in IndexedDB as it happens, so a refresh, a flat
   battery or a closed tab loses nothing. Each photograph is made
   guest-ready the moment it arrives — the event's look, the studio's
   logo — and checked for focus and clipping against the rest of the
   night.
   ------------------------------------------------------------------ */

export type Guest = { id: string; name: string; code: string };

export type WallStyle = "slideshow" | "mosaic" | "polaroid" | "strip" | "newest";

export type EventDoc = {
  id: string;
  name: string;
  nameMy: string;
  date: string;
  place: string;
  created: number;
  look: Settings | null;
  lookName: string | null;
  logo: Blob | null;
  wall: WallStyle;
  guests: Guest[];
  /** galleries are live on the server and follow every change */
  published?: boolean;
};

export type EventPhoto = {
  id: string;
  eventId: string;
  name: string;
  blob: Blob;
  thumb: Blob;
  w: number;
  h: number;
  guests: string[];
  metrics: Pick<Metrics, "sharp" | "clipHigh" | "clipLow" | "key">;
  review: boolean;
  queued: boolean;
  printed: number;
  created: number;
  /** the guest list the server last saw for this photo; absent = not uploaded */
  synced?: string | null;
};

export const events = table<EventDoc>("events", (a, b) => b.created - a.created);
export const photos = table<EventPhoto>("eventPhotos", (a, b) => a.created - b.created);

/* codes a guest can read out loud: no 0/O, no 1/I */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function guestCode(taken: Set<string>): string {
  for (;;) {
    let c = "";
    for (let i = 0; i < 4; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    if (!taken.has(c)) return c;
  }
}

export function newEvent(name: string, nameMy: string, date: string, place: string): EventDoc {
  return { id: uid(), name, nameMy, date, place, created: Date.now(), look: null, lookName: null, logo: null, wall: "mosaic", guests: [] };
}

/** Where a guest's gallery lives. It resolves once the server is connected. */
export const galleryUrl = (ev: EventDoc, g: Guest) =>
  `${API || "https://show.mm"}/e/${ev.id}/${g.code}`;

export const wallUrl = (ev: EventDoc) => `${API || "https://show.mm"}/e/${ev.id}`;

export const qr = (text: string, dark = "#08080a", light = "#ffffff") =>
  QRCode.toDataURL(text, { margin: 1, width: 512, errorCorrectionLevel: "M", color: { dark, light } });

/* -- making a photograph guest-ready ------------------------------ */

const GUEST_SIZE = 2048;

export async function prepare(ev: EventDoc, file: File): Promise<EventPhoto> {
  const { data } = await readImage(file, GUEST_SIZE);
  if (ev.look) renderFinal(data.data, compilePipeline(ev.look));
  const m = measure(data.data, data.width, data.height);
  const c = canvas(data.width, data.height);
  const x = ctx2d(c);
  x.putImageData(data, 0, 0);
  if (ev.logo) {
    const logo = await createImageBitmap(ev.logo);
    const lw = data.width * 0.14;
    const lh = lw * (logo.height / logo.width);
    const pad = data.width * 0.03;
    x.globalAlpha = 0.9;
    x.drawImage(logo, data.width - lw - pad, data.height - lh - pad, lw, lh);
    x.globalAlpha = 1;
    logo.close();
  }
  const blob = await toBlob(c, "image/jpeg", 0.9);
  const t = await thumbnail(blob, 520);
  /* a filename carrying a guest's code files the photograph for them */
  const hit = ev.guests.filter((g) => file.name.toUpperCase().includes(g.code));
  return {
    id: uid(),
    eventId: ev.id,
    name: file.name,
    blob,
    thumb: t.blob,
    w: data.width,
    h: data.height,
    guests: hit.map((g) => g.id),
    metrics: { sharp: m.sharp, clipHigh: m.clipHigh, clipLow: m.clipLow, key: m.key },
    review: false,
    queued: false,
    printed: 0,
    created: Date.now(),
  };
}

/** The quality check, relative to the night: soft and blown frames. */
export function flags(list: EventPhoto[]) {
  const mid = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? s[s.length >> 1] : 0;
  };
  const med = mid(list.map((p) => p.metrics.sharp));
  /* relative to the night: a venue with a white backdrop is all bright */
  const high = mid(list.map((p) => p.metrics.clipHigh));
  return new Map(
    list.map((p) => [
      p.id,
      {
        soft: list.length >= 4 && p.metrics.sharp < med / 3,
        clipped: p.metrics.clipHigh > Math.max(0.05, high * 2 + 0.02),
      },
    ]),
  );
}

/* -- watch folder (Chrome / Edge) --------------------------------- */

type DirHandle = {
  values(): AsyncIterable<{ kind: string; name: string; getFile(): Promise<File> }>;
  name: string;
};

export const canWatch = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

/**
 * Poll a folder the tethering software writes into, and hand over each
 * new image once. Returns a stop function.
 */
export async function watchFolder(onFiles: (files: File[]) => void, every = 3000): Promise<{ stop: () => void; name: string }> {
  const dir = (await (window as unknown as { showDirectoryPicker: (o?: object) => Promise<DirHandle> }).showDirectoryPicker({ mode: "read" })) as DirHandle;
  const seen = new Set<string>();
  let stopped = false;
  let first = true;
  const tick = async () => {
    if (stopped) return;
    const fresh: File[] = [];
    for await (const entry of dir.values()) {
      if (entry.kind !== "file" || !/\.(jpe?g|png|webp|heic)$/i.test(entry.name)) continue;
      const f = await entry.getFile();
      const key = `${entry.name}:${f.size}:${f.lastModified}`;
      if (seen.has(key)) continue;
      seen.add(key);
      /* a file still being written grows between polls; wait for it */
      if (!first && Date.now() - f.lastModified < 1500) {
        seen.delete(key);
        continue;
      }
      fresh.push(f);
    }
    first = false;
    if (fresh.length) onFiles(fresh);
    if (!stopped) window.setTimeout(tick, every);
  };
  void tick();
  return { stop: () => (stopped = true), name: dir.name };
}

/* -- keeping the server's galleries in step ------------------------ */

const auth = { credentials: "include" as const };
const sig = (p: EventPhoto) => JSON.stringify([...p.guests].sort());

export class SignInNeeded extends Error {}

async function check(res: Response) {
  if (res.status === 401) throw new SignInNeeded();
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(j.message ?? `server ${res.status}`);
  }
}

export async function pushEvent(ev: EventDoc) {
  await check(
    await fetch(`${API}/v1/events/${ev.id}`, {
      ...auth,
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: ev.name,
        nameMy: ev.nameMy,
        date: ev.date,
        place: ev.place,
        guests: ev.guests.map((g) => ({ code: g.code, name: g.name })),
      }),
    }),
  );
}

/** Upload what the server has not seen; retag what it has. */
export async function pushPhoto(ev: EventDoc, p: EventPhoto) {
  const codes = p.guests.map((gid) => ev.guests.find((g) => g.id === gid)?.code).filter((c): c is string => !!c);
  if (p.synced == null) {
    const form = new FormData();
    form.set("meta", JSON.stringify({ id: p.id, guests: codes }));
    form.set("photo", p.blob, `${p.id}.jpg`);
    await check(await fetch(`${API}/v1/events/${ev.id}/photos`, { ...auth, method: "POST", body: form }));
  } else if (p.synced !== sig(p)) {
    await check(
      await fetch(`${API}/v1/events/${ev.id}/photos/${p.id}/guests`, {
        ...auth,
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guests: codes }),
      }),
    );
  } else return;
  await photos.patch(p.id, { synced: sig(p) });
}

export const needsSync = (p: EventPhoto) => p.synced == null || p.synced !== sig(p);

export async function pullPhoto(ev: EventDoc, id: string) {
  if (!connected() || !ev.published) return;
  await fetch(`${API}/v1/events/${ev.id}/photos/${id}`, { ...auth, method: "DELETE" }).catch(() => undefined);
}
