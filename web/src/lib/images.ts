"use client";

import { useSyncExternalStore } from "react";
import { API, connected } from "./premium";

/* ------------------------------------------------------------------
   The image half of SHOW — the models on offer, and AI refinement of a
   crafted prompt. Both live on the server; this is the client side.
   ------------------------------------------------------------------ */

export type ImageModel = {
  id: string;
  label: string;
  vendor: string;
  note: string;
  note_my: string;
  aspects: string[];
  refs: number;
};

type Catalog = { status: "off" | "loading" | "ready" | "error"; models: ImageModel[]; refine: string; provider: string };

const OFF: Catalog = { status: "off", models: [], refine: "", provider: "" };
let catalog: Catalog = connected() ? { ...OFF, status: "loading" } : OFF;
let asked = false;
const listeners = new Set<() => void>();

async function load() {
  try {
    const r = await fetch(`${API}/v1/models`);
    const j = (await r.json()) as { models: ImageModel[]; refine: string; provider: string };
    catalog = { status: "ready", ...j };
  } catch {
    catalog = { ...OFF, status: "error" };
  }
  listeners.forEach((l) => l());
}

export function useModels(): Catalog {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      if (!asked && connected()) {
        asked = true;
        void load();
      }
      return () => listeners.delete(cb);
    },
    () => catalog,
    () => OFF,
  );
}

/* -- refine ------------------------------------------------------- */

export type Refined = { prompt: string; negative: string; notes: string[]; model: string; left: number };

export class RefineError extends Error {
  constructor(
    public kind: "offline" | "login" | "limit" | "failed",
    message: string,
  ) {
    super(message);
  }
}

export async function refinePrompt(prompt: string, negative: string): Promise<Refined> {
  if (!connected()) throw new RefineError("offline", "not connected");
  let r: Response;
  try {
    r = await fetch(`${API}/v1/refine`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, negative }),
    });
  } catch {
    throw new RefineError("failed", "the server could not be reached");
  }
  const j = (await r.json().catch(() => ({}))) as Refined & { message?: string };
  if (r.status === 401) throw new RefineError("login", j.message ?? "sign in");
  if (r.status === 403) throw new RefineError("limit", j.message ?? "limit reached");
  if (!r.ok) throw new RefineError("failed", j.message ?? `server ${r.status}`);
  return j;
}

