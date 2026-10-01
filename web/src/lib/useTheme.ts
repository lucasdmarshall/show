"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type ThemeChoice = "system" | "light" | "dark";
const KEY = "show.theme";

/* ------------------------------------------------------------------
   Both the stored choice and the OS posture are external stores, so
   they are read through useSyncExternalStore: no setState-in-effect,
   and the server snapshot is stable so hydration stays quiet.
   ------------------------------------------------------------------ */

const choiceListeners = new Set<() => void>();

function emitChoice() {
  for (const l of choiceListeners) l();
}

function subscribeChoice(cb: () => void) {
  choiceListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    choiceListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* private mode or blocked storage — fall through to the default */
  }
  return "system";
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeSystem(cb: () => void) {
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

const readSystemDark = () => window.matchMedia(DARK_QUERY).matches;

export function useTheme() {
  const choice = useSyncExternalStore(
    subscribeChoice,
    readChoice,
    () => "system" as ThemeChoice,
  );

  const systemDark = useSyncExternalStore(
    subscribeSystem,
    readSystemDark,
    () => true,
  );

  const resolved: "light" | "dark" =
    choice === "system" ? (systemDark ? "dark" : "light") : choice;

  useEffect(() => {
    const root = document.documentElement;
    if (choice === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", choice);
  }, [choice]);

  const setTheme = useCallback((next: ThemeChoice) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* the choice still applies for this session */
    }
    emitChoice();
  }, []);

  return { choice, resolved, setTheme };
}
