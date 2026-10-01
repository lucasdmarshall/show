"use client";

import { useSyncExternalStore } from "react";
import type { ModeId } from "./catalogue";
import type { Selection } from "./compile";

/* ------------------------------------------------------------------
   Library — saved prompts, versioned as a graph rather than a stack.

   A version keeps a parent, so branching costs nothing: try the light
   two ways, keep both, and diff them word by word to see what actually
   changed. Everything lives in this browser; there is no server yet
   and the storage layer is written so there does not need to be one.
   ------------------------------------------------------------------ */

const KEY = "show.library.v1";

export type Snapshot = {
  source: "studio" | "reverse";
  mode?: ModeId;
  selection?: Selection;
  extra?: string;
  /** Reverse builds descriptors by measuring, not by choosing. */
  parts?: string[];
  aspect: string;
  /** older saves name the engine they were written for */
  target?: string;
  positive: string;
  negative: string;
  tokens: number;
};

export type Version = {
  id: string;
  parent: string | null;
  label: string;
  at: number;
  snap: Snapshot;
};

export type Entry = {
  id: string;
  title: string;
  at: number;
  head: string;
  versions: Version[];
};

/* -- store -------------------------------------------------------- */

let cache: Entry[] | null = null;
const listeners = new Set<() => void>();

function read(): Entry[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Entry[]) : [];
  } catch {
    /* private mode, blocked storage, or a corrupt value */
    cache = [];
  }
  return cache;
}

function write(next: Entry[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* the session still works, it just will not survive a reload */
  }
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

const EMPTY: Entry[] = [];

export function useLibrary(): Entry[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/* -- ids ---------------------------------------------------------- */

const rid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);

/* -- operations --------------------------------------------------- */

export function saveNew(
  title: string,
  snap: Snapshot,
): { entry: string; version: string } {
  const vid = rid();
  const name = title.trim() || "Untitled";
  const entry: Entry = {
    id: rid(),
    title: name,
    at: Date.now(),
    head: vid,
    versions: [{ id: vid, parent: null, label: name, at: Date.now(), snap }],
  };
  write([entry, ...read()]);
  return { entry: entry.id, version: vid };
}

/** A new version hanging off `parent` — the branch point, if any. */
export function addVersion(
  entryId: string,
  parent: string | null,
  label: string,
  snap: Snapshot,
): string {
  const vid = rid();
  write(
    read().map((e) =>
      e.id === entryId
        ? {
            ...e,
            at: Date.now(),
            head: vid,
            versions: [
              ...e.versions,
              { id: vid, parent, label: label.trim() || "Untitled", at: Date.now(), snap },
            ],
          }
        : e,
    ),
  );
  return vid;
}

export function rename(entryId: string, title: string) {
  write(
    read().map((e) =>
      e.id === entryId ? { ...e, title: title.trim() || e.title } : e,
    ),
  );
}

export function setHead(entryId: string, versionId: string) {
  write(read().map((e) => (e.id === entryId ? { ...e, head: versionId } : e)));
}

export function removeEntry(entryId: string) {
  write(read().filter((e) => e.id !== entryId));
}

/** Removes a version and re-parents its children onto its own parent. */
export function removeVersion(entryId: string, versionId: string) {
  write(
    read().map((e) => {
      if (e.id !== entryId) return e;
      if (e.versions.length <= 1) return e;
      const victim = e.versions.find((v) => v.id === versionId);
      if (!victim) return e;
      const versions = e.versions
        .filter((v) => v.id !== versionId)
        .map((v) => (v.parent === versionId ? { ...v, parent: victim.parent } : v));
      return {
        ...e,
        versions,
        head: e.head === versionId ? versions[versions.length - 1].id : e.head,
      };
    }),
  );
}

/** Depth in the version graph, for indenting a branch. */
export function depthOf(versions: Version[], id: string): number {
  let depth = 0;
  let cur = versions.find((v) => v.id === id);
  while (cur?.parent) {
    depth++;
    cur = versions.find((v) => v.id === cur!.parent);
    if (depth > 32) break; /* a cycle should be impossible, but do not hang */
  }
  return depth;
}

/* -- diff --------------------------------------------------------- */

export type DiffPart = { text: string; kind: "same" | "add" | "del" };

/**
 * Word-level diff over an LCS table. Prompts run to a couple of hundred
 * words, so the quadratic table is cheap and the result is exact.
 *
 * Whitespace is dropped before comparing — leaving it in lets the table
 * match spaces across unrelated runs, which shreds the output into
 * fragments. The renderer puts a single space back between parts.
 */
export function diffWords(a: string, b: string): DiffPart[] {
  const A = a.trim().split(/\s+/).filter(Boolean);
  const B = b.trim().split(/\s+/).filter(Boolean);
  const n = A.length;
  const m = B.length;

  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        A[i] === B[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: DiffPart[] = [];
  const push = (word: string, kind: DiffPart["kind"]) => {
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += ` ${word}`;
    else out.push({ text: word, kind });
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      push(A[i], "same");
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push(A[i], "del");
      i++;
    } else {
      push(B[j], "add");
      j++;
    }
  }
  while (i < n) push(A[i++], "del");
  while (j < m) push(B[j++], "add");

  return out;
}

export function countChange(parts: DiffPart[]) {
  let add = 0;
  let del = 0;
  for (const p of parts) {
    const words = p.text ? p.text.split(" ").length : 0;
    if (p.kind === "add") add += words;
    if (p.kind === "del") del += words;
  }
  return { add, del };
}
