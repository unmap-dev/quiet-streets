"use client";

import { useCallback, useMemo, useState } from "react";
import { NOISE_MAP_ID, UrbanNoiseMap, flyToCity, type NoiseCameraMap, type NoiseRect } from "@/components/ui/urban-noise-map";
import { useMapWatch } from "@/hooks/use-map-watch";
import { useNoiseSession } from "@/hooks/use-noise-session";
import { useQuietState } from "@/hooks/use-quiet-state";
import { useWide } from "@/hooks/use-wide";
import { COVERAGE_BBOX, findCity, fitView, type City } from "@/lib/cities";
import { AppHeader } from "@/lib/kit/app-header";
import { API_KEY, GATEWAY } from "@/lib/kit/config";
import type { Lang } from "@/lib/kit/i18n";
import { useLang } from "@/lib/kit/use-lang";
import { MANIFEST } from "@/lib/manifest";
import { MapProvider, useMap } from "@/lib/map-context";
import { MAX_PINS, addPin, pinNumber, pinOf, removePin, type Pin } from "@/lib/pins";
import type { NoiseSession } from "@/lib/session";
import type { Period } from "@/lib/url";
import { CitySelect } from "./city-select";
import { CompareSheet } from "./compare-sheet";
import { CompareTray, type Candidate } from "./compare-tray";
import { ModelledNotice } from "./modelled-notice";
import { NeedsKey } from "./needs-key";
import { PinMarkers } from "./pin-markers";

/**
 * What sits above the block's map: the header and the modelled-not-measured strip, and on a phone
 * the header's second row and the compare tray too. The opening camera is computed before the map
 * exists, so these are estimates; they only decide how tightly the first view fits.
 */
const CHROME_ABOVE_MAP = { wide: 96, narrow: 150 };

/**
 * The first camera: the named area, or every covered area, fitted to this screen clear of the
 * block's card. A page opened in a pane that has no size yet (a hidden tab, a preview) is fitted
 * as a laptop screen rather than to nothing.
 */
function openingView(city: City | null): { center: [number, number]; zoom: number } {
  const sized = window.innerWidth >= 240 && window.innerHeight >= 240;
  const width = sized ? window.innerWidth : 1280;
  const height = sized ? window.innerHeight : 800;
  const chrome = width >= 640 ? CHROME_ABOVE_MAP.wide : CHROME_ABOVE_MAP.narrow;
  return fitView(city?.bbox ?? COVERAGE_BBOX, width, Math.max(200, height - chrome));
}

/** The block's floating card, measured so an area switch frames clear of it. Read-only; null when it is not there. */
function blockPanel(): NoiseRect | null {
  const card = document.querySelector(`[data-unmap-block="urban-noise-map"] [data-slot="card"]`);
  return card ? card.getBoundingClientRect() : null;
}

/**
 * Quiet Streets: the urban-noise-map block full-bleed under the app header, opened on all 41
 * covered metropolitan areas at once (or on the one `?city=` names), with the app's own pieces
 * around it: the modelled-not-measured notice, the header's jump-to-an-area switch, and pinning up
 * to three places to compare. The block is unmodified; everything the app adds reaches it from
 * outside (the shared map context, the session under its requests).
 */
export function QuietStreetsApp({ session }: { session: NoiseSession }) {
  // The outer provider holds no map of its own: it lets the area switch, the pins and the tray,
  // which sit outside the block, reach the map the block registers under NOISE_MAP_ID.
  return (
    <MapProvider apiKey={API_KEY} gateway={GATEWAY} container={null} id="quiet-streets-shell">
      <Shell session={session} />
    </MapProvider>
  );
}

function Shell({ session }: { session: NoiseSession }) {
  const [lang, setLang] = useLang();
  const [state, update] = useQuietState();
  const city = findCity(state.city);
  const map = useMap(NOISE_MAP_ID);
  const { pickShown, cityAtCentre } = useMapWatch(map);

  const onCity = useCallback(
    (next: City) => {
      update({ city: next.slug });
      if (map) flyToCity(map as unknown as NoiseCameraMap, next, blockPanel());
    },
    [map, update],
  );

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader
        manifest={MANIFEST}
        lang={lang}
        onLang={setLang}
        actions={API_KEY && state.ready ? <CitySelect lang={lang} value={cityAtCentre ?? (map ? null : (city?.slug ?? null))} onCity={onCity} /> : null}
      />
      {!state.ready ? (
        <div className="min-h-0 flex-1 bg-muted" aria-busy="true" />
      ) : !API_KEY ? (
        <NeedsKey lang={lang} />
      ) : (
        <NoiseView session={session} lang={lang} city={city} period={state.period} onPeriod={(period) => update({ period })} pickShown={pickShown} />
      )}
    </div>
  );
}

function NoiseView({
  session,
  lang,
  city,
  period,
  onPeriod,
  pickShown,
}: {
  session: NoiseSession;
  lang: Lang;
  /** The area the link named, or null for the national view. */
  city: City | null;
  period: Period;
  onPeriod: (period: Period) => void;
  /** Whether the block's card is showing a spot (Clear takes it away). */
  pickShown: boolean;
}) {
  const snapshot = useNoiseSession(session);
  const wide = useWide();
  const [pins, setPins] = useState<Pin[]>([]);
  const [comparing, setComparing] = useState(false);
  // The block's camera is its own after the first one.
  const [opening] = useState(() => openingView(city));

  const candidate = useMemo<Candidate>(() => {
    const lookup = snapshot.lookup;
    if (!lookup || !pickShown) return { state: "none" };
    if (lookup.status === "pending") return { state: "pending" };
    const pin = pinOf(lookup);
    if (!pin) return { state: "none" };
    return { state: "ready", pin, number: pinNumber(pins, pin.id), full: pins.length >= MAX_PINS };
  }, [snapshot.lookup, pickShown, pins]);

  const onPin = useCallback((pin: Pin) => setPins((current) => addPin(current, pin).pins), []);
  const onRemove = useCallback(
    (id: string) => {
      const next = removePin(pins, id);
      setPins(next);
      if (next.length === 0) setComparing(false);
    },
    [pins],
  );

  return (
    <>
      <ModelledNotice lang={lang} />
      <main className="relative flex min-h-0 flex-1 flex-col">
        {snapshot.gate === "granted" ? (
          <CompareTray lang={lang} pins={pins} candidate={candidate} onPin={onPin} onRemove={onRemove} onOpen={() => setComparing(true)} />
        ) : null}
        <div className="relative min-h-0 flex-1">
          <UrbanNoiseMap apiKey={API_KEY} gateway={GATEWAY} lang={lang} center={opening.center} zoom={opening.zoom} period={period} onPeriodChange={onPeriod} className="h-full" />
        </div>
        <PinMarkers pins={pins} />
        <CompareSheet open={comparing && pins.length > 0} onOpenChange={setComparing} side={wide ? "right" : "bottom"} pins={pins} period={period} lang={lang} onRemove={onRemove} />
      </main>
    </>
  );
}
