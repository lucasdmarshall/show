"use client";

import { useSyncExternalStore } from "react";

/* Below 900px the rooms lay out for a phone: the prompt first, the Make
   button held above the tabs. Rooms open after the page has hydrated, so
   reading the width here never flashes the other layout. */

const QUERY = "(max-width: 899px)";

const subscribe = (on: () => void) => {
  const m = window.matchMedia(QUERY);
  m.addEventListener("change", on);
  return () => m.removeEventListener("change", on);
};

export const useIsPhone = () =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
