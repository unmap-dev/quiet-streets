"use client";

import { useEffect, useState } from "react";
import { PICK_SOURCE } from "@/components/ui/urban-noise-map";
import { AREA_ZOOM, cityAt } from "@/lib/cities";
import type { Map } from "@unmap/maps";

/**
 * What the app reads off the block's map without touching it: whether the block is showing a
 * looked-up spot (its marker source is on the map; Clear removes it), and which covered area the
 * camera is over, so the header's area switch follows the reader's own panning. Zoomed out past
 * `AREA_ZOOM` the camera is over the country, not an area, whatever box its centre falls in.
 */
export function useMapWatch(map: Map | null): { pickShown: boolean; cityAtCentre: string | null } {
  const [pickShown, setPickShown] = useState(false);
  const [cityAtCentre, setCityAtCentre] = useState<string | null>(null);

  useEffect(() => {
    if (!map) return;
    const readPick = () => setPickShown(!!map.getSource(PICK_SOURCE));
    const readCity = () => {
      const centre = map.getCenter();
      setCityAtCentre(map.getZoom() >= AREA_ZOOM ? (cityAt([centre.lng, centre.lat])?.slug ?? null) : null);
    };
    readPick();
    readCity();
    map.on("sourcedata", readPick);
    map.on("styledata", readPick);
    map.on("moveend", readCity);
    return () => {
      map.off("sourcedata", readPick);
      map.off("styledata", readPick);
      map.off("moveend", readCity);
    };
  }, [map]);

  return { pickShown, cityAtCentre };
}
