"use client";

import { Marker } from "@/components/ui/marker-popup";
import { NOISE_MAP_ID } from "@/components/ui/urban-noise-map";
import type { Pin } from "@/lib/pins";
import { PinBadge } from "./pin-badge";

/**
 * The pinned places on the block's map, numbered as the tray lists them. They are drawn with the
 * registry's Marker on the block's map id, which the outer MapProvider lets the app reach, so the
 * block needs no change to carry them. Decorative: the tray and the comparison name each one.
 */
export function PinMarkers({ pins }: { pins: readonly Pin[] }) {
  return (
    <>
      {pins.map((pin, index) => (
        <Marker
          key={pin.id}
          mapId={NOISE_MAP_ID}
          lngLat={pin.at}
          markerContent={<PinBadge n={index + 1} className="size-6 text-xs shadow-md ring-2 ring-background" />}
        />
      ))}
    </>
  );
}
