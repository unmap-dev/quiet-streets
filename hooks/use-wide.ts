"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(min-width: 640px)";

function subscribe(onChange: () => void) {
  const list = window.matchMedia?.(QUERY);
  list?.addEventListener("change", onChange);
  return () => list?.removeEventListener("change", onChange);
}

/** True at Tailwind's `sm` and up, where the comparison opens beside the map rather than over it. */
export function useWide(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(QUERY)?.matches !== false,
    () => true,
  );
}
