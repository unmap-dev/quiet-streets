"use client";

import { useSyncExternalStore } from "react";
import type { NoiseSession, SessionSnapshot } from "@/lib/session";

/** The session's add-on answer and the block's newest lookup, re-rendering when either changes. */
export function useNoiseSession(session: NoiseSession): SessionSnapshot {
  return useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
}
