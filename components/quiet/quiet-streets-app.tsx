"use client";

import { useCallback, useMemo, useState } from "react";
import { NOISE_MAP_ID, UrbanNoiseMap, flyToCity, type NoiseCameraMap, type NoiseRect } from "@/components/ui/urban-noise-map";
import { useMapWatch } from "@/hooks/use-map-watch";
import { useNoiseSession } from "@/hooks/use-noise-session";
import { useQuietState } from "@/hooks/use-quiet-state";
import { useWide } from "@/hooks/use-wide";
import { cityCenter, findCity, type City } from "@/lib/cities";
import { AppHeader } from "@/lib/kit/app-header";
import { API_KEY, GATEWAY } from "@/lib/kit/config";
import type { Lang } from "@/lib/kit/i18n";
import { useLang } from "@/lib/kit/use-lang";
import { MANIFEST } from "@/lib/manifest";
import { MapProvider, useMap } from "@/lib/map-context";
import { MAX_PINS, addPin, pinNumber, pinOf, removePin, type Pin } from "@/lib/pins";
import type { NoiseSession } from "@/lib/session";
import type { Period } from "@/lib/url";
import { CityPicker } from "./city-picker";
import { CitySelect } from "./city-select";
import { CompareSheet } from "./compare-sheet";
import { CompareTray, type Candidate } from "./compare-tray";
import { ModelledNotice } from "./modelled-notice";
import { NeedsKey } from "./needs-key";
import { PinMarkers } from "./pin-markers";

/** The zoom a city opens at: the block's own opening zoom, where streets read one by one. */
const CITY_ZOOM = 12;

/** The block's floating card, measured so a city switch frames clear of it. Read-only; null when it is not there. */
function blockPanel(): NoiseRect | null {
  const card = document.querySelector(`[data-unmap-block="urban-noise-map"] [data-slot="card"]`);
  return card ? card.getBoundingClientRect() : null;
}

/**
 * Quiet Streets: a city picker, then the urban-noise-map block full-bleed under the app header,
 * with the app's own pieces around it: the modelled-not-measured notice, the header's city
 * switch, and pinning up to three places to compare. The block is unmodified; everything the app
 * adds reaches it from outside (the shared map context, the session under its requests).
 */
export function QuietStreetsApp({ session }: { session: NoiseSession }) {
  // The outer provider holds no map of its own: it lets the city switch, the pins and the tray,
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
        actions={API_KEY && city ? <CitySelect lang={lang} value={cityAtCentre ?? (map ? null : city.slug)} onCity={onCity} /> : null}
      />
      {!state.ready ? (
        <div className="min-h-0 flex-1 bg-muted" aria-busy="true" />
      ) : !API_KEY ? (
        <NeedsKey lang={lang} />
      ) : !city ? (
        <CityPicker lang={lang} onPick={(picked) => update({ city: picked.slug })} />
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
  city: City;
  period: Period;
  onPeriod: (period: Period) => void;
  /** Whether the block's card is showing a spot (Clear takes it away). */
  pickShown: boolean;
}) {
  const snapshot = useNoiseSession(session);
  const wide = useWide();
  const [pins, setPins] = useState<Pin[]>([]);
  const [comparing, setComparing] = useState(false);
  // The city the block was opened on: its camera is its own after that.
  const [opening] = useState(() => cityCenter(city));

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
      <ModelledNotice lang={lang} strip />
      <main className="relative flex min-h-0 flex-1 flex-col">
        {snapshot.gate === "granted" ? (
          <CompareTray lang={lang} pins={pins} candidate={candidate} onPin={onPin} onRemove={onRemove} onOpen={() => setComparing(true)} />
        ) : null}
        <div className="relative min-h-0 flex-1">
          <UrbanNoiseMap apiKey={API_KEY} gateway={GATEWAY} lang={lang} center={opening} zoom={CITY_ZOOM} period={period} onPeriodChange={onPeriod} className="h-full" />
        </div>
        <PinMarkers pins={pins} />
        <CompareSheet open={comparing && pins.length > 0} onOpenChange={setComparing} side={wide ? "right" : "bottom"} pins={pins} period={period} lang={lang} onRemove={onRemove} />
      </main>
    </>
  );
}
