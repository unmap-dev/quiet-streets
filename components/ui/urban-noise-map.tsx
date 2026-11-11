"use client";

/**
 * <UrbanNoiseMap> - how loud a street is, day and night, in six Canadian cities: the modelled
 * noise overlay on a quiet basemap, a Day / Night switch that recolours the whole map from the
 * day-evening-night level (Lden) to the night level (Lnight), and, for a spot you click or an
 * address you search, a card with that spot's level against the WHO 2018 guideline (53 dB Lden by
 * day, 45 dB Lnight at night), its WHO-anchored score and a bar per noise source. A full-bleed map
 * with a floating panel, a bottom sheet on a phone.
 *
 * Coverage is Calgary, Edmonton, Vancouver, Toronto, Montréal and Québec City. A spot outside them
 * gets a "not covered" answer with the six cities to jump to, never a number. A spot with no
 * modelled source in range says so, never 0 dB and never "quiet".
 *
 * The overlay and the lookup need the Urban Noise add-on. The block asks the gateway once whether
 * your key holds it and composes the overlay only if it does: a refused overlay would make the
 * whole style request fail. Without it the map still renders and the panel says why.
 *
 * Metering: every authenticated request is one call. The block makes the add-on probe (one
 * `GET /layers/urban-noise/22/0/0`), then the map's own style and tile requests. Each map click or
 * chosen search result makes one `GET /noise/point`; the search box makes one
 * `GET /geocode/autocomplete` per pause in typing. Switching Day and Night makes no call: both
 * levels are in the tiles already.
 *
 * The levels are modelled, not measured: a screening estimate, not a compliance assessment. They
 * are computed from OpenStreetMap, so the data is ODbL; the panel credits OpenStreetMap and the
 * noise model (PickYourPlace) at all times, and the map attribution carries the same credit.
 *
 * Composes the map, map-layers and geocoder items on your shadcn Card, ToggleGroup, Badge, Alert,
 * Button, Skeleton and Spinner. Installed by `npx shadcn add` with its page at
 * app/urban-noise-map/page.tsx. Edit freely.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Noise, type NoisePoint } from "@unmap/sdk";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Geocoder } from "@/components/ui/geocoder";
import { Map } from "@/components/ui/map";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMap, useMapGeneration, useMapReady } from "@/lib/map-context";
import { HELPER_KEY, accentColor, tokenColor } from "@/lib/map-layers";

// --- urban-noise-map helpers (kept identical across both lanes) ---
export type NoiseLang = "en" | "fr";

/** Which level the map is coloured by: the day-evening-night level (Lden) or the night level (Lnight). */
export type NoisePeriod = "day" | "night";

/** The block's own map id, so a map elsewhere on the page never answers for it. */
export const NOISE_MAP_ID = "urban-noise-map";

/** Where a reader gets an unmap key: the no-key state's first action. */
export const KEY_URL = "https://unmap.dev/dashboard";

/** Where the map opens: Calgary, at the zoom its noise reads street by street. */
export const OPENING_VIEW: { center: [number, number]; zoom: number } = { center: [-114.07, 51.045], zoom: 12 };

/** The catalog overlay the block composes, once the key is known to hold the add-on. */
export const NOISE_OVERLAYS: string[] = ["urban-noise"];

/** The fill the `urban-noise` overlay draws (apps/gateway/src/overlays.ts). */
export const NOISE_FILL_LAYER = "overlay_urban-noise_fill";

/** The tile property each period colours by. */
export const PERIOD_FIELD: Record<NoisePeriod, "lden" | "lnight"> = { day: "lden", night: "lnight" };

/** The WHO 2018 Environmental Noise Guidelines for road traffic: 53 dB Lden by day, 45 dB Lnight at night. */
export const WHO_DB: Record<NoisePeriod, number> = { day: 53, night: 45 };

/**
 * Where each period's colour steps, in dB: five classes, the second boundary always the WHO
 * guideline, so every warm class on the map is above it. Day: below 45, 45 to 53, 53 to 60, 60 to
 * 65, 65 and up. Night: below 40, 40 to 45, 45 to 50, 50 to 55, 55 and up.
 */
export const PERIOD_STEPS: Record<NoisePeriod, readonly [number, number, number, number]> = {
  day: [45, 53, 60, 65],
  night: [40, 45, 50, 55],
};

/** The range every bar in the card is drawn on, in dB: a quiet suburb to a highway shoulder. */
export const GAUGE_DB: { min: number; max: number } = { min: 30, max: 80 };

/** The zoom a looked-up point is shown at: the 25 m hexagons draw from 15. */
export const POINT_ZOOM = 16;

/** How long the map fades out and back when the period switches. */
export const PERIOD_FADE_MS = 180;

/** The noise sources the model sums, in the order the card lists them. */
export const NOISE_SOURCES = ["road", "rail", "aircraft", "commercial"] as const;
export type NoiseSourceKey = (typeof NOISE_SOURCES)[number];

/** A city Urban Noise covers. `bbox` is [west, south, east, north]. */
export interface NoiseCityRef {
  slug: string;
  name: { en: string; fr: string };
  bbox: [number, number, number, number];
}

/** The six covered cities, from the release manifest, for the "start in a city" buttons. */
export const NOISE_CITIES: readonly NoiseCityRef[] = [
  { slug: "calgary", name: { en: "Calgary", fr: "Calgary" }, bbox: [-114.334, 50.832, -113.856, 51.219] },
  { slug: "edmonton", name: { en: "Edmonton", fr: "Edmonton" }, bbox: [-113.735, 53.371, -113.235, 53.719] },
  { slug: "vancouver", name: { en: "Vancouver", fr: "Vancouver" }, bbox: [-123.293, 49.092, -122.987, 49.328] },
  { slug: "toronto", name: { en: "Toronto", fr: "Toronto" }, bbox: [-79.663, 43.571, -79.107, 43.869] },
  { slug: "montreal", name: { en: "Montréal", fr: "Montréal" }, bbox: [-73.984, 45.381, -73.446, 45.729] },
  { slug: "quebec-city", name: { en: "Québec City", fr: "Québec" }, bbox: [-71.585, 46.702, -71.106, 47.007] },
];

export const NOISE_COPY = {
  en: {
    title: "How loud is it here?",
    intro: "Click the map or search an address for its modelled noise, day and night.",
    introTouch: "Tap the map or search an address for its modelled noise, day and night.",
    checking: "Checking this key's add-ons...",
    search: "Search an address",
    period: "Colour the map by",
    periods: { day: "Day", night: "Night" },
    metrics: { day: "Lden", night: "Lnight" },
    startIn: "Or start in a city",
    goTo: (city: string) => `Go to ${city}`,
    loading: "Looking up this spot...",
    droppedPin: "Dropped pin",
    clear: "Clear",
    collapse: "Hide",
    expand: "Show",
    level: { day: "Day level, Lden", night: "Night level, Lnight" },
    above: { day: "Above the WHO day guideline", night: "Above the WHO night guideline" },
    within: { day: "Within the WHO day guideline", night: "Within the WHO night guideline" },
    guideline: (db: string) => `Guideline ${db}`,
    versus: (above: boolean | null, db: string) => (above === null ? `WHO ${db}` : above ? `Above WHO ${db}` : `Within WHO ${db}`),
    score: "Score",
    outOf: "of 100",
    labels: { Quiet: "Quiet", Moderate: "Moderate", Noisy: "Noisy", "Very noisy": "Very noisy", Severe: "Severe" } as Record<string, string>,
    bySource: "By source",
    main: "Main source",
    mainIs: (source: string) => `Main source: ${source}`,
    notModelled: "Not modelled here",
    sources: { road: "Road traffic", rail: "Rail", aircraft: "Aircraft", commercial: "Commercial" },
    noSourceTitle: "No modelled noise source here",
    noSourceBody:
      "No road, rail, aircraft or commercial source is modelled within range of this spot. That is not the same as quiet: the model has nothing to say here.",
    outsideTitle: "This place is not covered",
    outsideBody: "Urban Noise covers six cities. Pick one to look there.",
    unavailableTitle: "Urban noise is not available yet",
    unavailableBody: "The gateway is not serving the noise data yet, so the map shows no overlay. Try again later.",
    deniedTitle: {
      addon_required: "Noise levels need the Urban Noise add-on",
      dev_only: "Urban noise is free for development only",
      usage_limit_reached: "This month's development allowance is used",
    },
    deniedBody: {
      addon_required: "This key does not hold the Urban Noise add-on, so the map shows the basemap without noise levels and lookups are off.",
      dev_only: "On the dev plan, urban noise works from localhost. From this origin it needs a paid plan with the Urban Noise add-on.",
      usage_limit_reached: "The dev plan's premium calls for this month are used. Noise levels come back next month, or now with a paid plan.",
    },
    unknownTitle: "Could not check the Urban Noise add-on",
    unknownBody: (status: number) =>
      status === 401
        ? "The gateway refused this key. Check the key and its allowed origins."
        : `The gateway answered ${status === 0 ? "nothing (a network error)" : `HTTP ${status}`}, so the noise overlay is off.`,
    busy: "Too many requests. Try again in a moment.",
    keyRefused: "The gateway refused this key. Check it and try again.",
    failed: "The lookup failed. Try again.",
    retry: "Try again",
    pricing: "Plans and add-ons",
    pricingUrl: "https://unmap.dev/pricing",
    legend: "Legend",
    legendTitle: { day: "Day-evening-night level, Lden", night: "Night level, Lnight, 23:00 to 07:00" },
    below: (db: string) => `Below ${db}`,
    range: (from: string, to: string) => `${from} to ${to}`,
    andUp: (db: string) => `${db} and up`,
    whoLine: (db: string) => `WHO guideline, ${db}`,
    noData: "No colour: no modelled source",
    modelled: "Modelled, not measured: a screening estimate, not a compliance assessment.",
    attribution: "© OpenStreetMap contributors",
    attributionUrl: "https://www.openstreetmap.org/copyright",
    licence: "ODbL",
    licenceUrl: "https://opendatacommons.org/licenses/odbl/",
    model: "noise model: PickYourPlace",
    say: (place: string, level: string, status: string, score: string) => [place, level, status, score].filter((part) => part !== "").join(". ") + ".",
    sayScore: (score: string, label: string) => `Score ${score} of 100, ${label}`,
    noKeyTitle: "Add your unmap key to load the map.",
    getKey: "Get a key",
    noKey:
      'No unmap key. Pass apiKey. On Next.js, set NEXT_PUBLIC_UNMAP_KEY in .env.local. On Nuxt, set NUXT_PUBLIC_UNMAP_KEY in .env. If you installed with unmap add, nuxt.config already declares runtimeConfig: { public: { unmapKey: "" } }; otherwise add it there. Then restart the dev server.',
  },
  fr: {
    title: "Quel est le niveau de bruit ici ?",
    intro: "Cliquez sur la carte ou cherchez une adresse pour voir son bruit modélisé, le jour et la nuit.",
    introTouch: "Touchez la carte ou cherchez une adresse pour voir son bruit modélisé, le jour et la nuit.",
    checking: "Vérification des modules complémentaires de cette clé...",
    search: "Chercher une adresse",
    period: "Colorer la carte selon",
    periods: { day: "Jour", night: "Nuit" },
    metrics: { day: "Lden", night: "Lnight" },
    startIn: "Ou commencez dans une ville",
    goTo: (city: string) => `Aller à ${city}`,
    loading: "Recherche de ce point...",
    droppedPin: "Point choisi",
    clear: "Effacer",
    collapse: "Masquer",
    expand: "Afficher",
    level: { day: "Niveau de jour, Lden", night: "Niveau de nuit, Lnight" },
    above: { day: "Au-dessus de la ligne directrice de l'OMS pour le jour", night: "Au-dessus de la ligne directrice de l'OMS pour la nuit" },
    within: { day: "Sous la ligne directrice de l'OMS pour le jour", night: "Sous la ligne directrice de l'OMS pour la nuit" },
    guideline: (db: string) => `Ligne directrice ${db}`,
    versus: (above: boolean | null, db: string) => (above === null ? `OMS ${db}` : above ? `Au-dessus de l'OMS, ${db}` : `Sous l'OMS, ${db}`),
    score: "Score",
    outOf: "sur 100",
    labels: { Quiet: "Calme", Moderate: "Modéré", Noisy: "Bruyant", "Very noisy": "Très bruyant", Severe: "Sévère" } as Record<string, string>,
    bySource: "Par source",
    main: "Source principale",
    mainIs: (source: string) => `Source principale\u00a0: ${source}`,
    notModelled: "Non modélisé ici",
    sources: { road: "Circulation routière", rail: "Train", aircraft: "Avions", commercial: "Commerces" },
    noSourceTitle: "Aucune source de bruit modélisée ici",
    noSourceBody:
      "Aucune source routière, ferroviaire, aérienne ou commerciale n'est modélisée à portée de ce point. Ce n'est pas la même chose que le calme : le modèle n'a rien à dire ici.",
    outsideTitle: "Ce lieu n'est pas couvert",
    outsideBody: "Bruit urbain couvre six villes. Choisissez-en une pour y regarder.",
    unavailableTitle: "Le bruit urbain n'est pas encore offert",
    unavailableBody: "La passerelle ne sert pas encore les données de bruit : la carte s'affiche sans la couche. Réessayez plus tard.",
    deniedTitle: {
      addon_required: "Les niveaux de bruit nécessitent le module complémentaire Bruit urbain",
      dev_only: "Le bruit urbain est gratuit en développement seulement",
      usage_limit_reached: "L'allocation de développement de ce mois est épuisée",
    },
    deniedBody: {
      addon_required:
        "Cette clé n'a pas le module complémentaire Bruit urbain : la carte montre le fond de carte sans les niveaux de bruit, et les recherches sont désactivées.",
      dev_only:
        "Avec le forfait de développement, le bruit urbain fonctionne depuis localhost. Depuis cette origine, il faut un forfait payant avec le module complémentaire Bruit urbain.",
      usage_limit_reached:
        "Les appels premium du forfait de développement sont épuisés pour ce mois. Les niveaux de bruit reviennent le mois prochain, ou dès maintenant avec un forfait payant.",
    },
    unknownTitle: "Impossible de vérifier le module complémentaire Bruit urbain",
    unknownBody: (status: number) =>
      status === 401
        ? "La passerelle a refusé cette clé. Vérifiez la clé et ses origines autorisées."
        : `La passerelle a répondu ${status === 0 ? "rien (une erreur réseau)" : `HTTP ${status}`} : la couche de bruit est désactivée.`,
    busy: "Trop de requêtes. Réessayez dans un instant.",
    keyRefused: "La passerelle a refusé cette clé. Vérifiez-la et réessayez.",
    failed: "La recherche a échoué. Réessayez.",
    retry: "Réessayer",
    pricing: "Forfaits et modules complémentaires",
    pricingUrl: "https://unmap.dev/fr/pricing",
    legend: "Légende",
    legendTitle: { day: "Niveau jour-soir-nuit, Lden", night: "Niveau de nuit, Lnight, de 23 h à 7 h" },
    below: (db: string) => `Moins de ${db}`,
    range: (from: string, to: string) => `De ${from} à ${to}`,
    andUp: (db: string) => `${db} et plus`,
    whoLine: (db: string) => `Ligne directrice de l'OMS, ${db}`,
    noData: "Sans couleur : aucune source modélisée",
    modelled: "Modélisé, pas mesuré : une estimation de dépistage, pas une évaluation de conformité.",
    attribution: "© les contributeurs d'OpenStreetMap",
    attributionUrl: "https://www.openstreetmap.org/copyright",
    licence: "ODbL",
    licenceUrl: "https://opendatacommons.org/licenses/odbl/",
    model: "modèle de bruit : PickYourPlace",
    say: (place: string, level: string, status: string, score: string) => [place, level, status, score].filter((part) => part !== "").join(". ") + ".",
    sayScore: (score: string, label: string) => `Score de ${score} sur 100, ${label.toLowerCase()}`,
    noKeyTitle: "Ajoutez votre clé unmap pour charger la carte.",
    getKey: "Obtenir une clé",
    noKey:
      'Aucune clé unmap. Passez apiKey. Avec Next.js, définissez NEXT_PUBLIC_UNMAP_KEY dans .env.local. Avec Nuxt, définissez NUXT_PUBLIC_UNMAP_KEY dans .env. Si vous avez installé le bloc avec unmap add, nuxt.config déclare déjà runtimeConfig: { public: { unmapKey: "" } } ; sinon, ajoutez-le. Redémarrez ensuite le serveur de développement.',
  },
};

/** The 403 codes that mean "this key may not read the noise data", and what unlocks it. */
export type NoiseDeniedCode = "addon_required" | "dev_only" | "usage_limit_reached";

/** Whether this key may read the noise data, as the add-on probe answered. */
export type NoiseGate =
  | { state: "checking" }
  | { state: "granted" }
  | { state: "denied"; code: NoiseDeniedCode; addon: string }
  /** The gateway serves no noise release yet (404 or 503). */
  | { state: "unavailable" }
  | { state: "unknown"; status: number };

function deniedCode(code: unknown): NoiseDeniedCode | null {
  return code === "addon_required" || code === "dev_only" || code === "usage_limit_reached" ? code : null;
}

/**
 * Ask the gateway whether `apiKey` may read the `urban-noise` layer. One request, metered like any
 * other: a tile at zoom 22, past every archive, which the gateway answers 204 once the add-on check
 * has passed, 403 with a reason when it has not, and 404 while no release is served. Nothing is
 * drawn from it. A network failure or any other status is `unknown`; an aborted probe rejects
 * with the AbortError.
 */
export async function probeNoise(apiKey: string, gateway = "https://api.unmap.dev", signal?: AbortSignal): Promise<NoiseGate> {
  const url = `${gateway.replace(/\/+$/, "")}/layers/urban-noise/22/0/0?key=${encodeURIComponent(apiKey)}`;
  let response: { ok: boolean; status: number; json(): Promise<unknown> };
  try {
    response = await fetch(url, { signal });
  } catch (caught) {
    if ((caught as { name?: unknown } | null)?.name === "AbortError") throw caught;
    return { state: "unknown", status: 0 };
  }
  if (response.ok) return { state: "granted" };
  if (response.status === 404 || response.status === 503) return { state: "unavailable" };
  if (response.status === 403) {
    const body = (await response.json().catch(() => null)) as { code?: unknown; addon?: unknown } | null;
    const code = deniedCode(body?.code);
    if (code) return { state: "denied", code, addon: typeof body?.addon === "string" ? body.addon : "" };
  }
  return { state: "unknown", status: response.status };
}

/** Why a lookup gave no level, by what the gateway said. */
export type NoiseFailure =
  | { kind: "outside"; cities: NoiseCityRef[] }
  | { kind: "denied"; code: NoiseDeniedCode; addon: string }
  | { kind: "unavailable" }
  | { kind: "busy" }
  | { kind: "keyRefused" }
  | { kind: "failed" };

/** The failure a rejected `/noise/point` means. A 422 lists the covered cities; the six known ones stand in if it did not. */
export function failureFrom(caught: unknown): NoiseFailure {
  const failure = typeof caught === "object" && caught !== null ? (caught as { status?: unknown; code?: unknown; addon?: unknown; cities?: unknown }) : {};
  const status = typeof failure.status === "number" ? failure.status : 0;
  if (status === 422 && failure.code === "outside_coverage") {
    const cities = Array.isArray(failure.cities) && failure.cities.length > 0 ? (failure.cities as NoiseCityRef[]) : [...NOISE_CITIES];
    return { kind: "outside", cities };
  }
  const code = deniedCode(failure.code);
  if (status === 403 && code) return { kind: "denied", code, addon: typeof failure.addon === "string" ? failure.addon : "" };
  if (status === 503) return { kind: "unavailable" };
  if (status === 429) return { kind: "busy" };
  if (status === 401 || status === 403) return { kind: "keyRefused" };
  return { kind: "failed" };
}

const locale = (lang: NoiseLang) => (lang === "fr" ? "fr-CA" : "en-CA");

/** A level in whole decibels, the precision a modelled screening value carries: "49 dB". */
export function formatDb(db: number, lang: NoiseLang): string {
  return `${new Intl.NumberFormat(locale(lang), { maximumFractionDigits: 0 }).format(db)} dB`;
}

/** A point as latitude and longitude to four decimals (about 10 m): "51.0540, -114.0884", "51,0540 ; -114,0884". */
export function formatCoords(at: [number, number], lang: NoiseLang): string {
  const number = new Intl.NumberFormat(locale(lang), { minimumFractionDigits: 4, maximumFractionDigits: 4, useGrouping: false });
  return `${number.format(at[1])}${lang === "fr" ? " ; " : ", "}${number.format(at[0])}`;
}

/** A city's name in the reader's language, by its slug, among `cities`; the slug when it is not there. */
export function cityName(slug: string, lang: NoiseLang, cities: readonly NoiseCityRef[] = NOISE_CITIES): string {
  const city = cities.find((entry) => entry.slug === slug) ?? NOISE_CITIES.find((entry) => entry.slug === slug);
  return city ? city.name[lang] : slug;
}

/** Where `db` falls on the card's bar, 0 to 1. */
export function gaugeShare(db: number): number {
  return Math.min(1, Math.max(0, (db - GAUGE_DB.min) / (GAUGE_DB.max - GAUGE_DB.min)));
}

/** The noise fields the card reads, as `/noise/point` returns them. */
export interface NoiseReading {
  lden: number | null;
  lnight: number | null;
  score: number | null;
  label: string | null;
  exceeds_who: { day: boolean | null; night: boolean | null };
  dominant_source: string | null;
  sources_db: Partial<Record<NoiseSourceKey, number | null>>;
}

/** One period's level and where it stands against the WHO guideline; null `db` when nothing is modelled. */
export function periodReading(point: NoiseReading, period: NoisePeriod): { db: number | null; who: number; above: boolean | null } {
  const db = period === "day" ? point.lden : point.lnight;
  const who = WHO_DB[period];
  if (db === null || !Number.isFinite(db)) return { db: null, who, above: null };
  const flagged = point.exceeds_who[period];
  return { db, who, above: typeof flagged === "boolean" ? flagged : db > who };
}

/** The card's per-source rows, in a fixed order: each source's level, its bar, and whether it is the main one. */
export function sourceRows(point: NoiseReading, lang: NoiseLang): Array<{ key: NoiseSourceKey; label: string; db: number | null; value: string; share: number; main: boolean }> {
  const copy = NOISE_COPY[lang];
  return NOISE_SOURCES.map((key) => {
    const raw = point.sources_db[key];
    const db = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    return {
      key,
      label: copy.sources[key],
      db,
      value: db === null ? copy.notModelled : formatDb(db, lang),
      share: db === null ? 0 : gaugeShare(db),
      main: point.dominant_source === key && db !== null,
    };
  });
}

/** The score label in the reader's language: "Moderate", "Modéré". */
export function labelText(label: string | null, lang: NoiseLang): string {
  return label ? (NOISE_COPY[lang].labels[label] ?? label) : "";
}

/** What the live region says once a spot is answered. */
export function announce(point: NoiseReading, place: string, period: NoisePeriod, lang: NoiseLang): string {
  const copy = NOISE_COPY[lang];
  const reading = periodReading(point, period);
  if (reading.db === null) return `${place}. ${copy.noSourceTitle}.`;
  const status = reading.above ? copy.above[period] : copy.within[period];
  const score = point.score === null ? "" : copy.sayScore(String(point.score), labelText(point.label, lang));
  return copy.say(place, `${copy.level[period]} ${formatDb(reading.db, lang)}`, status, score);
}

/** The five colours of the overlay's ramp, quiet to severe. */
export interface NoiseRamp {
  quiet: string;
  moderate: string;
  noisy: string;
  veryNoisy: string;
  severe: string;
}

/**
 * The ramp the gateway's overlay is drawn with, read from its `fill-color`: a `step` on
 * `noise_score_who` from severe (below 20) to quiet (80 and up). The block recolours with the same
 * five colours, so it carries none of its own and follows the gateway if the ramp changes. Null
 * for any other expression, including one this block has already set.
 */
export function readRamp(expression: unknown): NoiseRamp | null {
  if (!Array.isArray(expression) || expression[0] !== "step" || expression.length !== 11) return null;
  const input = expression[1];
  if (!Array.isArray(input) || input[0] !== "get" || input[1] !== "noise_score_who") return null;
  const colours = [expression[2], expression[4], expression[6], expression[8], expression[10]];
  if (!colours.every((colour) => typeof colour === "string" && colour !== "")) return null;
  const [severe, veryNoisy, noisy, moderate, quiet] = colours as string[];
  return { quiet: quiet!, moderate: moderate!, noisy: noisy!, veryNoisy: veryNoisy!, severe: severe! };
}

/** The fill colour and filter that draw `period`: stepped on its level at `PERIOD_STEPS`, a hexagon without that level left out. */
export function periodPaint(period: NoisePeriod, ramp: NoiseRamp): { color: unknown[]; filter: unknown[] } {
  const field = PERIOD_FIELD[period];
  const [a, b, c, d] = PERIOD_STEPS[period];
  return {
    color: ["step", ["get", field], ramp.quiet, a, ramp.moderate, b, ramp.noisy, c, ramp.veryNoisy, d, ramp.severe],
    filter: ["has", field],
  };
}

/** The legend's rows for `period`, quiet first, and which rows are above the WHO guideline. */
export function legendRows(period: NoisePeriod, ramp: NoiseRamp, lang: NoiseLang): Array<{ colour: string; label: string; above: boolean }> {
  const copy = NOISE_COPY[lang];
  const [a, b, c, d] = PERIOD_STEPS[period].map((db) => formatDb(db, lang));
  const who = WHO_DB[period];
  const steps = PERIOD_STEPS[period];
  return [
    { colour: ramp.quiet, label: copy.below(a!), above: false },
    { colour: ramp.moderate, label: copy.range(a!, b!), above: steps[0] >= who },
    { colour: ramp.noisy, label: copy.range(b!, c!), above: steps[1] >= who },
    { colour: ramp.veryNoisy, label: copy.range(c!, d!), above: steps[2] >= who },
    { colour: ramp.severe, label: copy.andUp(d!), above: steps[3] >= who },
  ];
}

/** The part of a MapLibre map the period switch changes. */
export interface NoisePaintMap {
  getLayer(id: string): unknown;
  setPaintProperty(id: string, name: string, value: unknown): unknown;
  setFilter(id: string, filter: unknown): unknown;
}

/**
 * Colour the overlay by `period`. With `animate`, the fill fades out, changes, and fades back in
 * over `PERIOD_FADE_MS` each way, so the switch reads as the city changing rather than a flicker;
 * without it (the first paint, a style swap, or reduced motion) it changes at once. Returns the
 * function that cancels a fade in progress and puts the opacity back.
 */
export function applyPeriod(map: NoisePaintMap, period: NoisePeriod, ramp: NoiseRamp, opacity: number, animate: boolean): () => void {
  if (!map.getLayer(NOISE_FILL_LAYER)) return () => {};
  const paint = periodPaint(period, ramp);
  const swap = () => {
    if (!map.getLayer(NOISE_FILL_LAYER)) return;
    map.setPaintProperty(NOISE_FILL_LAYER, "fill-color", paint.color);
    map.setFilter(NOISE_FILL_LAYER, paint.filter);
  };
  if (!animate) {
    swap();
    return () => {};
  }
  map.setPaintProperty(NOISE_FILL_LAYER, "fill-opacity-transition", { duration: PERIOD_FADE_MS, delay: 0 });
  map.setPaintProperty(NOISE_FILL_LAYER, "fill-opacity", 0);
  let done = false;
  const timer = setTimeout(() => {
    done = true;
    swap();
    if (map.getLayer(NOISE_FILL_LAYER)) map.setPaintProperty(NOISE_FILL_LAYER, "fill-opacity", opacity);
  }, PERIOD_FADE_MS);
  return () => {
    clearTimeout(timer);
    if (!done && map.getLayer(NOISE_FILL_LAYER)) map.setPaintProperty(NOISE_FILL_LAYER, "fill-opacity", opacity);
  };
}

/** The source and layers that mark the looked-up spot. */
export const PICK_SOURCE = "urban-noise-map-pick";
export const PICK_HEX = "urban-noise-map-pick-hex";
export const PICK_HALO = "urban-noise-map-pick-halo";
export const PICK_DOT = "urban-noise-map-pick-dot";

/** The part of a MapLibre map the spot marker draws on. */
export interface NoisePickMap {
  getLayer(id: string): unknown;
  getSource(id: string): unknown;
  addSource(id: string, source: Record<string, unknown>): unknown;
  addLayer(layer: Record<string, unknown>): unknown;
  removeLayer(id: string): unknown;
  removeSource(id: string): unknown;
}

/** Take the spot marker off the map. */
export function clearPick(map: NoisePickMap): void {
  for (const id of [PICK_DOT, PICK_HALO, PICK_HEX]) if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(PICK_SOURCE)) map.removeSource(PICK_SOURCE);
}

/**
 * Mark the looked-up spot: a dot in your accent ringed in your background, and, from zoom 15
 * where the 25 m hexagons draw, the hexagon that answered outlined on the overlay's own source.
 * Drawn from scratch; call it again after a style swap.
 */
export function applyPick(map: NoisePickMap, pick: { at: [number, number]; h3: string | null } | null, colours: { accent: string; halo: string | null }): void {
  clearPick(map);
  if (!pick) return;
  const metadata = { [HELPER_KEY]: true };
  const fill = map.getLayer(NOISE_FILL_LAYER) as { source?: unknown } | undefined;
  if (pick.h3 && typeof fill?.source === "string") {
    map.addLayer({
      id: PICK_HEX,
      type: "line",
      source: fill.source,
      "source-layer": "noise",
      filter: ["==", ["get", "h3_id"], pick.h3],
      paint: { "line-color": colours.accent, "line-width": 2.5 },
      metadata,
    });
  }
  map.addSource(PICK_SOURCE, { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: pick.at } } });
  if (colours.halo) {
    map.addLayer({ id: PICK_HALO, type: "circle", source: PICK_SOURCE, paint: { "circle-radius": 11, "circle-color": colours.halo, "circle-opacity": 0.85 }, metadata });
  }
  map.addLayer({
    id: PICK_DOT,
    type: "circle",
    source: PICK_SOURCE,
    paint: { "circle-radius": 6, "circle-color": colours.accent, ...(colours.halo ? { "circle-stroke-color": colours.halo, "circle-stroke-width": 2 } : {}) },
    metadata,
  });
}

/** A box on screen, as getBoundingClientRect() gives it. */
export interface NoiseRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** Camera padding in pixels, as MapLibre takes it. */
export interface NoisePadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** The panel's inset from the map edge, and the gutter the camera keeps. */
export const GUTTER = 24;
/** The least map, in pixels, a padded camera must have to frame at its full gutter. */
const MIN_FRAME = 120;
/** The tightened gutter, and the least strip the camera keeps to frame in beside a tall panel. */
const TIGHT = 8;
const MIN_STRIP = 32;

/**
 * Camera padding that keeps the framed spot clear of the floating panel: its width on the left
 * when it floats beside the map, its height at the bottom when it is a sheet across it. An even
 * gutter when nothing is measured. When the full gutter would leave too little map, the gutter
 * tightens and the frame stays in the strip the panel leaves.
 */
export function panelPadding(map: NoiseRect, panel: NoiseRect | null, gutter = GUTTER): NoisePadding {
  const even = { top: gutter, right: gutter, bottom: gutter, left: gutter };
  if (!panel || panel.width <= 0 || panel.height <= 0 || map.width <= 0 || map.height <= 0) return even;
  const sheet = panel.width >= map.width * 0.6;
  const cover = Math.round(sheet ? map.bottom - panel.top : panel.right - map.left);
  const size = sheet ? map.height : map.width;
  if (size - 2 * gutter - cover >= MIN_FRAME) return sheet ? { ...even, bottom: cover + gutter } : { ...even, left: cover + gutter };
  const near = Math.min(cover + TIGHT, size - TIGHT - MIN_STRIP);
  return sheet ? { ...even, top: TIGHT, bottom: near } : { ...even, left: near, right: TIGHT };
}

/** True when the reader asked for less motion: the camera jumps and the map recolours at once. */
export function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

/** True on a screen with no hover, where the reader taps rather than clicks. */
export function touchScreen(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(hover: none)")?.matches === true;
}

/** The part of a MapLibre map the camera uses. */
export interface NoiseCameraMap {
  getContainer(): { getBoundingClientRect(): NoiseRect };
  getZoom(): number;
  flyTo(options: Record<string, unknown>): unknown;
  jumpTo(options: Record<string, unknown>): unknown;
  fitBounds(bounds: [[number, number], [number, number]], options: Record<string, unknown>): unknown;
}

/** Ease to a searched spot at street zoom, clear of the panel; jump there when the reader asked for less motion. */
export function flyToPoint(map: NoiseCameraMap, at: [number, number], panel: NoiseRect | null): void {
  const padding = panelPadding(map.getContainer().getBoundingClientRect(), panel);
  const camera = { center: at, zoom: Math.max(map.getZoom(), POINT_ZOOM), padding };
  if (reducedMotion()) map.jumpTo(camera);
  else map.flyTo({ ...camera, duration: 1200, essential: true });
}

/** Frame a covered city, clear of the panel. */
export function flyToCity(map: NoiseCameraMap, city: NoiseCityRef, panel: NoiseRect | null): void {
  const [west, south, east, north] = city.bbox;
  const padding = panelPadding(map.getContainer().getBoundingClientRect(), panel);
  map.fitBounds(
    [
      [west, south],
      [east, north],
    ],
    { padding, maxZoom: 13, ...(reducedMotion() ? { animate: false } : { duration: 1400, essential: true }) },
  );
}
// --- end urban-noise-map helpers ---

export interface UrbanNoiseMapProps {
  /** unmap API key with the Urban Noise add-on. The page passes NEXT_PUBLIC_UNMAP_KEY. With none, the block asks for one and loads nothing. */
  apiKey: string;
  /** Gateway base URL. Defaults to the unmap production gateway. */
  gateway?: string;
  /** Language of the copy and the map labels. Defaults to "en". */
  lang?: NoiseLang;
  /** Where the map opens, [longitude, latitude]: the initial camera only. Defaults to Calgary. */
  center?: [number, number];
  /** The opening zoom: the initial camera only, like `center`. Defaults to 12. */
  zoom?: number;
  /** The basemap under the noise. Defaults to "muted", which keeps the colour for the data. */
  mapStyle?: string;
  /** The level the map is coloured by. Omit it and the block keeps its own, starting with "day". */
  period?: NoisePeriod;
  /** Fires when the reader switches between Day and Night. */
  onPeriodChange?: (period: NoisePeriod) => void;
  className?: string;
}

/** What the card shows: nothing yet, a spot being looked up, its answer, or why there is none. */
type NoiseLookup =
  | { state: "idle" }
  | { state: "loading"; at: [number, number]; name: string | null }
  | { state: "result"; at: [number, number]; name: string | null; point: NoisePoint }
  | { state: "failed"; at: [number, number]; name: string | null; failure: NoiseFailure };

/** A camera move the map binding makes: to a searched spot or a city, once per `seq`. */
type NoiseFlight = { seq: number; to: { kind: "point"; at: [number, number] } | { kind: "city"; city: NoiseCityRef } };

export function UrbanNoiseMap({
  apiKey,
  gateway,
  lang = "en",
  center = OPENING_VIEW.center,
  zoom = OPENING_VIEW.zoom,
  mapStyle = "muted",
  period: periodProp,
  onPeriodChange,
  className,
}: UrbanNoiseMapProps) {
  const copy = NOISE_COPY[lang];
  const hasKey = apiKey.trim() !== "";
  const noise = useMemo(() => new Noise({ key: apiKey, gateway }), [apiKey, gateway]);
  // The opening camera, kept: after this the reader moves the map, not the props.
  const [opening] = useState(() => ({ center, zoom }));
  const [gate, setGate] = useState<NoiseGate>({ state: "checking" });
  const [attempt, setAttempt] = useState(0);
  const [ownPeriod, setOwnPeriod] = useState<NoisePeriod>(periodProp ?? "day");
  const period = periodProp ?? ownPeriod;
  const [lookup, setLookup] = useState<NoiseLookup>({ state: "idle" });
  const [ramp, setRamp] = useState<NoiseRamp | null>(null);
  const [flight, setFlight] = useState<NoiseFlight | null>(null);
  const [touch] = useState(touchScreen);
  // Below `sm` the sheet folds down to its title so the map shows; a new spot unfolds it.
  const [collapsed, setCollapsed] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lookupRef = useRef<AbortController | null>(null);

  // A new key starts over: its add-on answer is its own.
  useEffect(() => {
    setGate({ state: "checking" });
    setLookup({ state: "idle" });
  }, [apiKey, gateway]);

  // One probe per key. Nothing gated is composed until it answers.
  useEffect(() => {
    if (!hasKey) return;
    const controller = new AbortController();
    probeNoise(apiKey, gateway, controller.signal).then(
      (next) => {
        if (!controller.signal.aborted) setGate(next);
      },
      () => {
        // Aborted: a newer probe or the unmount owns the state.
      },
    );
    return () => controller.abort();
  }, [apiKey, gateway, hasKey, attempt]);

  useEffect(() => () => lookupRef.current?.abort(), []);

  /** One `/noise/point` for a spot; a newer spot cancels an older one still in flight. */
  const lookUp = useCallback(
    (at: [number, number], name: string | null) => {
      lookupRef.current?.abort();
      const controller = new AbortController();
      lookupRef.current = controller;
      setCollapsed(false);
      setLookup({ state: "loading", at, name });
      noise.point({ lat: at[1], lng: at[0], signal: controller.signal }).then(
        ({ data }) => {
          if (!controller.signal.aborted) setLookup({ state: "result", at, name, point: data });
        },
        (caught: unknown) => {
          if (!controller.signal.aborted) setLookup({ state: "failed", at, name, failure: failureFrom(caught) });
        },
      );
    },
    [noise],
  );

  function choosePeriod(next: NoisePeriod) {
    setOwnPeriod(next);
    onPeriodChange?.(next);
  }

  function chooseCity(city: NoiseCityRef) {
    lookupRef.current?.abort();
    setLookup({ state: "idle" });
    setFlight((current) => ({ seq: (current?.seq ?? 0) + 1, to: { kind: "city", city } }));
  }

  function clear() {
    lookupRef.current?.abort();
    setLookup({ state: "idle" });
  }

  function retryGate() {
    setGate({ state: "checking" });
    setAttempt((current) => current + 1);
  }

  if (!hasKey) {
    // Where the map would be: the block's gutter, the Alert at a readable width, the first action first.
    return (
      <div
        data-unmap-block="urban-noise-map"
        data-state="no-key"
        className={["flex h-full min-h-[480px] items-start justify-center bg-muted/40 p-4 sm:items-center sm:p-6", className].filter(Boolean).join(" ")}
      >
        <Alert role="alert" className="w-full max-w-md motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          <AlertTitle className="line-clamp-none">{copy.noKeyTitle}</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <a className="font-medium text-primary underline underline-offset-4" href={KEY_URL} target="_blank" rel="noreferrer">
              {copy.getKey}
            </a>
            <p>{copy.noKey}</p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  if (gate.state === "checking") {
    // Where the map will be: the answer is one request away, so a quiet line, not a skeleton of a map.
    return (
      <div
        data-unmap-block="urban-noise-map"
        data-state="checking"
        className={["flex h-full min-h-[480px] items-center justify-center gap-2 bg-muted/40 p-4 sm:p-6", className].filter(Boolean).join(" ")}
      >
        <Spinner className="size-4 text-muted-foreground" />
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {copy.checking}
        </p>
      </div>
    );
  }

  const granted = gate.state === "granted";
  const place = lookup.state === "idle" ? "" : (lookup.name ?? copy.droppedPin);
  const said = lookup.state === "result" ? announce(lookup.point, place, period, lang) : lookup.state === "loading" ? copy.loading : "";
  const headline = lookup.state === "result" ? periodReading(lookup.point, period).db : null;
  const summary = lookup.state === "idle" ? null : headline === null ? place : `${place} · ${formatDb(headline, lang)}`;
  // Folded below `sm`: everything under the title goes, and the title carries the spot.
  const fold = collapsed ? "max-sm:hidden" : undefined;
  const pick =
    lookup.state === "idle" ? null : { at: lookup.at, h3: lookup.state === "result" && lookup.point.lden !== null ? lookup.point.h3 : null };

  return (
    <div data-unmap-block="urban-noise-map" data-period={period} className={["relative h-full min-h-[480px]", className].filter(Boolean).join(" ")}>
      <Map
        id={NOISE_MAP_ID}
        apiKey={apiKey}
        gateway={gateway}
        lang={lang}
        style={mapStyle}
        {...(granted ? { overlays: NOISE_OVERLAYS } : {})}
        center={opening.center}
        zoom={opening.zoom}
        className="h-full"
      >
        {granted ? (
          <NoiseBinding
            period={period}
            pick={pick}
            flight={flight}
            panelRef={panelRef}
            onRamp={setRamp}
            onPoint={(at) => lookUp(at, null)}
          />
        ) : null}
        {granted && ramp ? <NoiseLegend lang={lang} period={period} ramp={ramp} /> : null}
        <p data-testid="noise-announce" aria-live="polite" className="sr-only">
          {said}
        </p>
        {/* A card floating on the map at 24 px; below `sm`, a sheet across the bottom (at most 55% of the map) that clears the attribution, scrolls as one piece and folds down to its title. */}
        <div
          ref={panelRef}
          data-collapsed={collapsed ? "true" : undefined}
          className="absolute inset-x-4 bottom-10 z-10 flex max-h-[55%] flex-col sm:inset-x-auto sm:top-6 sm:bottom-auto sm:left-6 sm:max-h-[calc(100%-3rem)] sm:w-[23rem] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300 sm:motion-safe:slide-in-from-bottom-0 sm:motion-safe:slide-in-from-left-4"
        >
          <Card className="flex min-h-0 flex-1 flex-col gap-0 py-0 max-sm:overflow-y-auto max-sm:overscroll-contain">
            <CardHeader className={["shrink-0 gap-1 pt-4 pb-3", collapsed ? "max-sm:pb-4" : ""].join(" ")}>
              <div className="flex items-start justify-between gap-3">
                <CardTitle role="heading" aria-level={2}>
                  {copy.title}
                </CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid="noise-fold"
                  aria-expanded={!collapsed}
                  className="-mt-1.5 -mr-2 shrink-0 text-muted-foreground sm:hidden"
                  onClick={() => setCollapsed((current) => !current)}
                >
                  {collapsed ? copy.expand : copy.collapse}
                </Button>
              </div>
              {granted && lookup.state === "idle" ? <CardDescription className={fold}>{touch ? copy.introTouch : copy.intro}</CardDescription> : null}
              {collapsed && summary ? (
                <CardDescription data-testid="noise-summary" className="truncate tabular-nums sm:hidden">
                  {summary}
                </CardDescription>
              ) : null}
            </CardHeader>
            {granted ? (
              <div data-testid="noise-tools" className={["flex shrink-0 flex-col gap-2.5 border-b px-6 pb-4", fold].filter(Boolean).join(" ")}>
                <Geocoder
                  mapId={NOISE_MAP_ID}
                  apiKey={apiKey}
                  gateway={gateway}
                  lang={lang}
                  placeholder={copy.search}
                  proximity="map"
                  flyToZoom={POINT_ZOOM}
                  onSelect={(result) => {
                    const at: [number, number] = [result.lng, result.lat];
                    lookUp(at, result.name);
                    setFlight((current) => ({ seq: (current?.seq ?? 0) + 1, to: { kind: "point", at } }));
                  }}
                  className="[&>p]:hidden"
                />
                <ToggleGroup
                  variant="outline"
                  size="sm"
                  aria-label={copy.period}
                  className="w-full"
                  value={[period]}
                  // Pressing the pressed item empties the group; the period keeps its value.
                  onValueChange={(next: unknown[]) => {
                    const value = next[0];
                    if (value === "day" || value === "night") choosePeriod(value);
                  }}
                >
                  {(["day", "night"] as const).map((value) => (
                    <ToggleGroupItem key={value} value={value} className="flex-1 gap-1.5 aria-pressed:font-semibold">
                      {copy.periods[value]}
                      <span className="text-xs font-normal text-muted-foreground">{copy.metrics[value]}</span>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            ) : null}
            <CardContent className={["flex flex-col gap-4 py-4 max-sm:shrink-0 sm:min-h-0 sm:flex-1 sm:overflow-y-auto sm:overscroll-contain", fold].filter(Boolean).join(" ")}>
              {gate.state === "denied" || gate.state === "unknown" || gate.state === "unavailable" ? (
                <Alert data-unmap-addon-gate={gate.state === "denied" ? gate.code : gate.state}>
                  <AlertTitle className="line-clamp-none">
                    {gate.state === "denied" ? copy.deniedTitle[gate.code] : gate.state === "unavailable" ? copy.unavailableTitle : copy.unknownTitle}
                  </AlertTitle>
                  <AlertDescription className="flex flex-col items-start gap-2">
                    <p>{gate.state === "denied" ? copy.deniedBody[gate.code] : gate.state === "unavailable" ? copy.unavailableBody : copy.unknownBody(gate.status)}</p>
                    {gate.state === "denied" ? (
                      <a className="font-medium text-primary underline underline-offset-4" href={copy.pricingUrl} target="_blank" rel="noreferrer">
                        {copy.pricing}
                      </a>
                    ) : (
                      <Button type="button" variant="outline" size="sm" onClick={retryGate}>
                        {copy.retry}
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              ) : null}
              {granted && lookup.state === "idle" ? <CityButtons lang={lang} label={copy.startIn} onCity={chooseCity} /> : null}
              {granted && lookup.state === "loading" ? <NoiseCardSkeleton lang={lang} /> : null}
              {granted && lookup.state === "result" ? (
                <NoiseAnswer key={`${lookup.at.join(",")}`} lang={lang} period={period} place={place} at={lookup.at} point={lookup.point} onClear={clear} />
              ) : null}
              {granted && lookup.state === "failed" ? (
                <NoiseFailureCard
                  lang={lang}
                  failure={lookup.failure}
                  onRetry={() => lookUp(lookup.at, lookup.name)}
                  onCity={chooseCity}
                  onClear={clear}
                />
              ) : null}
            </CardContent>
            <div data-testid="noise-credits" className={["flex shrink-0 flex-col gap-1 border-t px-6 py-3 text-xs text-muted-foreground", fold].filter(Boolean).join(" ")}>
              <p>
                <a className="underline underline-offset-2" href={copy.attributionUrl} target="_blank" rel="noreferrer">
                  {copy.attribution}
                </a>{" "}
                (
                <a className="underline underline-offset-2" href={copy.licenceUrl} target="_blank" rel="noreferrer">
                  {copy.licence}
                </a>
                ), {copy.model}.
              </p>
              <p>{copy.modelled}</p>
            </div>
          </Card>
        </div>
      </Map>
    </div>
  );
}

/** The six cities as buttons that frame each one: the empty state's first action, and the way out of "not covered". */
function CityButtons({ lang, label, cities = NOISE_CITIES, onCity }: { lang: NoiseLang; label: string; cities?: readonly NoiseCityRef[]; onCity: (city: NoiseCityRef) => void }) {
  const copy = NOISE_COPY[lang];
  return (
    <div data-testid="noise-cities" className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <ul className="flex flex-wrap gap-1.5">
        {cities.map((city) => (
          <li key={city.slug}>
            <Button type="button" variant="outline" size="sm" aria-label={copy.goTo(city.name[lang])} onClick={() => onCity(city)}>
              {city.name[lang]}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Where the answer will be, in its shape: a heading, the headline level, two bars and four sources. */
function NoiseCardSkeleton({ lang }: { lang: NoiseLang }) {
  return (
    <section data-testid="noise-loading" aria-busy="true" aria-label={NOISE_COPY[lang].loading} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3.5 w-1/2" />
      </div>
      <Skeleton className="h-10 w-28" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-2 w-full" />
      </div>
      <div className="flex flex-col gap-2">
        {NOISE_SOURCES.map((key) => (
          <Skeleton key={key} className="h-3.5 w-full" />
        ))}
      </div>
    </section>
  );
}

/** A bar on the card's 30 to 80 dB scale, with the WHO guideline as a tick when one applies. */
function LevelBar({ share, strong, who, whoLabel }: { share: number; strong: boolean; who?: number; whoLabel?: string }) {
  const tick = who === undefined ? null : gaugeShare(who);
  return (
    <span aria-hidden="true" className="relative block h-2 w-full rounded-full bg-muted">
      <span
        data-strong={strong ? "true" : undefined}
        className="absolute inset-y-0 left-0 rounded-full bg-muted-foreground/40 data-[strong=true]:bg-primary motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out"
        style={{ width: `${Math.round(share * 1000) / 10}%` }}
      />
      {tick !== null ? (
        <span className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground" style={{ left: `${Math.round(tick * 1000) / 10}%` }} title={whoLabel} />
      ) : null}
    </span>
  );
}

/** The answer for one spot: the active period's level as the headline, both periods against the WHO line, the score, and a bar per source. */
function NoiseAnswer({
  lang,
  period,
  place,
  at,
  point,
  onClear,
}: {
  lang: NoiseLang;
  period: NoisePeriod;
  place: string;
  at: [number, number];
  point: NoisePoint;
  onClear: () => void;
}) {
  const copy = NOISE_COPY[lang];
  const reading = periodReading(point, period);
  const header = (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 className="text-base leading-tight font-semibold text-balance">{place}</h3>
        <p className="text-xs text-muted-foreground tabular-nums">
          {cityName(point.city, lang)}, {formatCoords(at, lang)}
        </p>
      </div>
      <Button type="button" variant="ghost" size="sm" className="-mr-2 shrink-0 text-muted-foreground" onClick={onClear}>
        {copy.clear}
      </Button>
    </div>
  );
  if (reading.db === null) {
    return (
      <section data-testid="noise-answer" data-state="no-source" aria-label={place} className="flex flex-col gap-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
        {header}
        <Alert>
          <AlertTitle className="line-clamp-none">{copy.noSourceTitle}</AlertTitle>
          <AlertDescription>
            <p>{copy.noSourceBody}</p>
          </AlertDescription>
        </Alert>
      </section>
    );
  }
  const rows = sourceRows(point, lang);
  return (
    <section data-testid="noise-answer" data-state="result" aria-label={place} className="flex flex-col gap-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
      {header}
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">{copy.level[period]}</p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p data-testid="noise-headline" className="text-4xl leading-none font-semibold tracking-tight tabular-nums">
            {formatDb(reading.db, lang)}
          </p>
          <Badge variant={reading.above ? "destructive" : "secondary"} data-above={reading.above ? "true" : "false"}>
            {reading.above ? copy.above[period] : copy.within[period]}
          </Badge>
        </div>
      </div>
      <dl className="flex flex-col gap-3">
        {(["day", "night"] as const).map((value) => {
          const row = periodReading(point, value);
          const active = value === period;
          return (
            <div key={value} data-active={active ? "true" : undefined} className="flex flex-col gap-1.5 opacity-60 data-[active=true]:opacity-100 motion-safe:transition-opacity">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <dt className="font-medium">
                  {copy.periods[value]} <span className="text-xs font-normal text-muted-foreground">{copy.metrics[value]}</span>
                </dt>
                <dd className="font-semibold tabular-nums">
                  {row.db === null ? copy.notModelled : formatDb(row.db, lang)}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{copy.versus(row.above, formatDb(row.who, lang))}</span>
                </dd>
              </div>
              <LevelBar share={row.db === null ? 0 : gaugeShare(row.db)} strong={active} who={row.who} whoLabel={copy.guideline(formatDb(row.who, lang))} />
            </div>
          );
        })}
      </dl>
      {point.score !== null ? (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2.5">
          <p className="text-sm text-muted-foreground">{copy.score}</p>
          <p className="flex items-baseline gap-1.5">
            <span className="text-lg leading-none font-semibold tabular-nums">{point.score}</span>
            <span className="text-xs text-muted-foreground">{copy.outOf}</span>
            {point.label ? (
              <Badge variant="outline" className="ml-1">
                {labelText(point.label, lang)}
              </Badge>
            ) : null}
          </p>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{copy.bySource}</p>
        <dl data-testid="noise-sources" className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 text-sm">
          {rows.map((row) => (
            <div key={row.key} data-main={row.main ? "true" : undefined} className="contents">
              <dt className="text-muted-foreground">
                <span className={row.main ? "font-medium text-foreground" : undefined}>{row.label}</span>
                {row.main ? <span className="sr-only">, {copy.main}</span> : null}
              </dt>
              <span aria-hidden="true" className="block">
                {row.db === null ? <span className="block h-1.5 w-full rounded-full border border-dashed border-border" /> : <LevelBar share={row.share} strong={row.main} />}
              </span>
              <dd className={["text-right tabular-nums", row.db === null ? "text-xs text-muted-foreground" : "font-medium"].join(" ")}>{row.value}</dd>
            </div>
          ))}
        </dl>
        {rows.some((row) => row.main) ? (
          <p className="text-xs text-muted-foreground">{copy.mainIs(rows.find((row) => row.main)?.label ?? "")}</p>
        ) : null}
      </div>
    </section>
  );
}

/** Why a spot has no level, and the way forward: the six cities, the pricing page, or a retry. */
function NoiseFailureCard({
  lang,
  failure,
  onRetry,
  onCity,
  onClear,
}: {
  lang: NoiseLang;
  failure: NoiseFailure;
  onRetry: () => void;
  onCity: (city: NoiseCityRef) => void;
  onClear: () => void;
}) {
  const copy = NOISE_COPY[lang];
  if (failure.kind === "outside") {
    return (
      <section data-testid="noise-answer" data-state="outside" className="flex flex-col gap-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
        <Alert>
          <AlertTitle className="line-clamp-none">{copy.outsideTitle}</AlertTitle>
          <AlertDescription>
            <p>{copy.outsideBody}</p>
          </AlertDescription>
        </Alert>
        <CityButtons lang={lang} label={copy.startIn} cities={failure.cities} onCity={onCity} />
      </section>
    );
  }
  if (failure.kind === "denied") {
    return (
      <Alert data-testid="noise-answer" data-state="denied">
        <AlertTitle className="line-clamp-none">{copy.deniedTitle[failure.code]}</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          <p>{copy.deniedBody[failure.code]}</p>
          <a className="font-medium text-primary underline underline-offset-4" href={copy.pricingUrl} target="_blank" rel="noreferrer">
            {copy.pricing}
          </a>
        </AlertDescription>
      </Alert>
    );
  }
  const title = failure.kind === "unavailable" ? copy.unavailableTitle : null;
  const body = failure.kind === "unavailable" ? copy.unavailableBody : failure.kind === "busy" ? copy.busy : failure.kind === "keyRefused" ? copy.keyRefused : copy.failed;
  return (
    <Alert variant={failure.kind === "unavailable" ? "default" : "destructive"} role="alert" data-testid="noise-answer" data-state={failure.kind}>
      {title ? <AlertTitle className="line-clamp-none">{title}</AlertTitle> : null}
      <AlertDescription className="flex flex-col items-start gap-2">
        <p>{body}</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {copy.retry}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            {copy.clear}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

/** The map side of the block: the period's colours, the spot marker, map clicks and camera moves. It renders inside <Map>. */
function NoiseBinding({
  period,
  pick,
  flight,
  panelRef,
  onRamp,
  onPoint,
}: {
  period: NoisePeriod;
  pick: { at: [number, number]; h3: string | null } | null;
  flight: NoiseFlight | null;
  panelRef: RefObject<HTMLDivElement | null>;
  onRamp: (ramp: NoiseRamp) => void;
  onPoint: (at: [number, number]) => void;
}) {
  const map = useMap(NOISE_MAP_ID);
  const ready = useMapReady(NOISE_MAP_ID);
  const generation = useMapGeneration(NOISE_MAP_ID);
  const rampRef = useRef<{ ramp: NoiseRamp; opacity: number } | null>(null);
  // What was last painted, so only a period switch on the same style fades; a new style paints at once.
  const paintedRef = useRef<{ generation: number; period: NoisePeriod } | null>(null);
  const pointRef = useRef(onPoint);
  pointRef.current = onPoint;

  // Read the overlay's ramp from the style the gateway sent, then colour the map by the period.
  useEffect(() => {
    if (!map || !ready) return;
    const paint = map as unknown as NoisePaintMap & { getPaintProperty(id: string, name: string): unknown };
    if (!paint.getLayer(NOISE_FILL_LAYER)) return;
    const live = readRamp(paint.getPaintProperty(NOISE_FILL_LAYER, "fill-color"));
    if (live) {
      const opacity = paint.getPaintProperty(NOISE_FILL_LAYER, "fill-opacity");
      rampRef.current = { ramp: live, opacity: typeof opacity === "number" ? opacity : 0.45 };
      onRamp(live);
    }
    const known = rampRef.current;
    if (!known) return;
    const last = paintedRef.current;
    const animate = !!last && last.generation === generation && last.period !== period && !reducedMotion();
    paintedRef.current = { generation, period };
    return applyPeriod(paint, period, known.ramp, known.opacity, animate);
  }, [map, ready, generation, period, onRamp]);

  // The spot marker, drawn again whenever the spot changes and after every style swap.
  const pickKey = pick ? `${pick.at.join(",")}|${pick.h3 ?? ""}` : "";
  useEffect(() => {
    if (!map || !ready) return;
    let removed = false;
    const onRemove = () => {
      removed = true;
    };
    map.on("remove", onRemove);
    const target = map as unknown as NoisePickMap;
    if (map.getStyle()) {
      applyPick(target, pickKey ? pick : null, { accent: accentColor(map, undefined, undefined), halo: tokenColor(map, "--background") });
    }
    return () => {
      map.off("remove", onRemove);
      if (!removed && map.getStyle()) clearPick(target);
    };
    // `pickKey` stands for `pick`, which is a new object every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready, generation, pickKey]);

  // A click anywhere asks for that spot; a crosshair says the map answers clicks.
  useEffect(() => {
    if (!map || typeof map.on !== "function") return;
    const onClick = (event: { lngLat: { lng: number; lat: number } }) => pointRef.current([event.lngLat.lng, event.lngLat.lat]);
    map.on("click", onClick);
    const canvas = map.getCanvas?.();
    if (canvas) canvas.style.cursor = "crosshair";
    return () => {
      map.off("click", onClick);
      if (canvas) canvas.style.cursor = "";
    };
  }, [map]);

  // Camera moves the panel asked for: a searched spot, or a city.
  useEffect(() => {
    if (!map || !flight) return;
    const camera = map as unknown as NoiseCameraMap;
    const panel = panelRef.current?.getBoundingClientRect() ?? null;
    if (flight.to.kind === "point") flyToPoint(camera, flight.to.at, panel);
    else flyToCity(camera, flight.to.city, panel);
    // One move per `seq`; the target travels with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, flight?.seq]);

  return null;
}

/**
 * What the colours mean for the period the map is drawn by, in the colours the style draws them,
 * with the WHO guideline drawn as a rule between the classes it separates. Open by default on a
 * wide screen, folded on a phone.
 */
function NoiseLegend({ lang, period, ramp }: { lang: NoiseLang; period: NoisePeriod; ramp: NoiseRamp }) {
  const copy = NOISE_COPY[lang];
  const [wide] = useState(() => typeof window === "undefined" || window.matchMedia?.("(min-width: 640px)")?.matches !== false);
  const rows = legendRows(period, ramp, lang);
  const firstAbove = rows.findIndex((row) => row.above);
  return (
    <details
      open={wide}
      data-testid="noise-legend"
      className="group absolute top-3 left-3 z-10 max-w-[15rem] rounded-lg border bg-popover/95 text-popover-foreground shadow-md backdrop-blur sm:top-auto sm:right-3 sm:bottom-10 sm:left-auto"
    >
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold select-none [&::-webkit-details-marker]:hidden">{copy.legend}</summary>
      <div className="flex flex-col gap-2 px-3 pb-3 text-xs">
        <p key={period} className="text-muted-foreground motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          {copy.legendTitle[period]}
        </p>
        <ul className="flex flex-col gap-1">
          {rows.map((row, index) => (
            <li key={`${period}-${index}`} className="flex flex-col gap-1">
              {index === firstAbove ? (
                <span data-testid="noise-legend-who" className="flex items-center gap-2 py-0.5 text-[0.6875rem] font-medium">
                  <span aria-hidden="true" className="h-0.5 w-4 shrink-0 rounded-full bg-foreground" />
                  {copy.whoLine(formatDb(WHO_DB[period], lang))}
                </span>
              ) : null}
              <span className="flex items-center gap-2 tabular-nums">
                <span aria-hidden="true" className="size-3 shrink-0 rounded-sm border border-border/60" style={{ backgroundColor: row.colour }} />
                {row.label}
              </span>
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-2 text-muted-foreground">
          <span aria-hidden="true" className="size-3 shrink-0 rounded-sm border border-dashed border-border" />
          {copy.noData}
        </p>
      </div>
    </details>
  );
}
