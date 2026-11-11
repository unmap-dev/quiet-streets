"use client";

import "@/lib/kit/maplibre-worker";
import { GATEWAY } from "@/lib/kit/config";
import { installNoiseSession } from "@/lib/session";
import { QuietStreetsApp } from "./quiet-streets-app";

// Before anything renders: the block's SDK clients bind `fetch` when they are built.
const session = installNoiseSession(GATEWAY);

export default function ClientEntry() {
  return <QuietStreetsApp session={session} />;
}
