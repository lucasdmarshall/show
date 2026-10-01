"use client";

import { useSyncExternalStore } from "react";
import { API, connected } from "./premium";

/* ------------------------------------------------------------------
   The account — only when a server is connected. Everything device-side
   works without one; signing in is what making photographs and
   publishing need. The session is an HttpOnly cookie the app never sees.
   ------------------------------------------------------------------ */

export type Me = { id: string; login: string; name: string; member: boolean; member_until: number };

type State = { status: "off" | "loading" | "out" | "in"; me: Me | null };

let state: State = { status: connected() ? "loading" : "off", me: null };
let started = false;
const listeners = new Set<() => void>();
const OFF: State = { status: "off", me: null };

function set(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

export async function refresh() {
  if (!connected()) return;
  try {
    const r = await fetch(`${API}/v1/me`, { credentials: "include" });
    set(r.ok ? { status: "in", me: (await r.json()) as Me } : { status: "out", me: null });
  } catch {
    set({ status: "out", me: null });
  }
}

export function useAccount(): State {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      if (!started) {
        started = true;
        void refresh();
      }
      return () => listeners.delete(cb);
    },
    () => state,
    () => OFF,
  );
}

async function post(path: string, body: unknown): Promise<string | null> {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (r.ok) {
    await refresh();
    return null;
  }
  try {
    return ((await r.json()) as { message?: string }).message ?? `error ${r.status}`;
  } catch {
    return `error ${r.status}`;
  }
}

/** Resolves to an error message, or null on success. */
export const signUp = (login: string, password: string, name: string) => post("/v1/auth/signup", { login, password, name });
export const signIn = (login: string, password: string) => post("/v1/auth/login", { login, password });
export const signOut = async () => {
  await post("/v1/auth/logout", {});
  const { firebaseSignOut } = await import("./firebase");
  await firebaseSignOut().catch(() => undefined);
  set({ status: "out", me: null });
};

/** A Firebase-proven person, turned into a SHOW session. */
export async function signInWithFirebase(idToken: string, name: string): Promise<string | null> {
  return post("/v1/auth/firebase", { idToken, name });
}

/* Any room can ask for the sign-in sheet; the shell owns it. */
export const ACCOUNT_EVENT = "show:account";
export const askSignIn = () => window.dispatchEvent(new Event(ACCOUNT_EVENT));

/** fetch against the server, with the session. */
export const api = (path: string, init: RequestInit = {}) => fetch(`${API}${path}`, { credentials: "include", ...init });
