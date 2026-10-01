"use client";

import { useSyncExternalStore } from "react";
import { thumbnail, uid } from "./image";

/* ------------------------------------------------------------------
   The vault — every photograph SHOW makes, kept on this device.

   localStorage holds text; photographs need IndexedDB. Everything a
   room exports lands here automatically, private until the person
   chooses to put it in their portfolio. Deleting moves to a trash that
   the person empties themselves.
   ------------------------------------------------------------------ */

const DB = "show";
const VERSION = 1;
export const STORES = ["work", "events", "eventPhotos"] as const;
type Store = (typeof STORES)[number];

let opening: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise((res, rej) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: "id" });
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => {
      opening = null;
      rej(req.error);
    };
  });
  return opening;
}

const done = <T>(req: IDBRequest<T>) =>
  new Promise<T>((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });

export async function put<T extends { id: string }>(store: Store, value: T) {
  const d = await db();
  await done(d.transaction(store, "readwrite").objectStore(store).put(value));
}

export async function get<T>(store: Store, id: string): Promise<T | undefined> {
  const d = await db();
  return done(d.transaction(store).objectStore(store).get(id)) as Promise<T | undefined>;
}

export async function all<T>(store: Store): Promise<T[]> {
  const d = await db();
  return done(d.transaction(store).objectStore(store).getAll()) as Promise<T[]>;
}

export async function del(store: Store, id: string) {
  const d = await db();
  await done(d.transaction(store, "readwrite").objectStore(store).delete(id));
}

/* -- a store, watched ------------------------------------------------
   Rooms read a store through a hook; any write through `table()` tells
   every reader. The snapshot is a stable array until the next write. */

export function table<T extends { id: string }>(store: Store, order: (a: T, b: T) => number) {
  let cache: T[] | null = null;
  let loading: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const EMPTY: T[] = [];

  const emit = () => listeners.forEach((l) => l());

  /* one read in flight at a time; everyone waiting shares it */
  const load = () =>
    (loading ??= (async () => {
      try {
        cache = (await all<T>(store)).sort(order);
      } catch {
        cache = [];
      } finally {
        loading = null;
        emit();
      }
    })());

  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    if (!cache) void load();
    return () => listeners.delete(cb);
  };

  return {
    use(): T[] {
      return useSyncExternalStore(subscribe, () => cache ?? EMPTY, () => EMPTY);
    },
    /** null until the first read has finished */
    ready: () => cache !== null,
    async put(v: T) {
      await put(store, v);
      /* a write before the first read must not stand in for the whole store */
      if (!cache) return load();
      cache = [...cache.filter((x) => x.id !== v.id), v].sort(order);
      emit();
    },
    async patch(id: string, change: Partial<T>) {
      const cur = (cache ?? []).find((x) => x.id === id) ?? (await get<T>(store, id));
      if (!cur) return;
      await this.put({ ...cur, ...change });
    },
    async remove(id: string) {
      await del(store, id);
      if (!cache) return load();
      cache = cache.filter((x) => x.id !== id);
      emit();
    },
    list: () => cache ?? EMPTY,
    reload: load,
  };
}

/* -- work: what has been made ------------------------------------- */

export type WorkItem = {
  id: string;
  /** which room made it */
  source: string;
  title: string;
  created: number;
  w: number;
  h: number;
  blob: Blob;
  thumb: Blob;
  /** in the portfolio, with its caption */
  exhibit: { caption: string; captionMy: string; order: number } | null;
  /** when it went to the trash */
  trashed: number | null;
};

export const work = table<WorkItem>("work", (a, b) => b.created - a.created);
export const useWork = () => work.use();

/** Keep a finished photograph. Called by every room's export. */
export async function keep(blob: Blob, source: string, title: string): Promise<WorkItem | null> {
  try {
    const t = await thumbnail(blob, 640);
    const item: WorkItem = {
      id: uid(),
      source,
      title,
      created: Date.now(),
      w: t.w,
      h: t.h,
      blob,
      thumb: t.blob,
      exhibit: null,
      trashed: null,
    };
    await work.put(item);
    return item;
  } catch {
    /* private mode or storage full — the download still happened */
    return null;
  }
}

/* One object URL per stored blob, for as long as the blob lives. Thumbs
   are small, and a vault's worth of them is cheaper than churning URLs
   on every render. */
const urls = new WeakMap<Blob, string>();
export function urlOf(b: Blob): string {
  let u = urls.get(b);
  if (!u) {
    u = URL.createObjectURL(b);
    urls.set(b, u);
  }
  return u;
}

/** Ask the browser not to evict the vault when space runs short. */
export async function persist(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export async function usage(): Promise<{ used: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { used: e.usage ?? 0, quota: e.quota ?? 0 } : null;
  } catch {
    return null;
  }
}
