import type { Text } from "@/lib/kit/i18n";

/**
 * The six cities Urban Noise covers, as the city picker shows them. Plain data, so the domain
 * layer imports nothing from the registry UI; test/cities.test.ts holds the names and bounding
 * boxes identical to the block's own `NOISE_CITIES` (from the release manifest).
 *
 * What is added to the block's list is what the picker says about each city, all of it from the
 * docs' "Coverage and limits": the province, how many 25 m hexagons the city's grid has, and
 * whether its traffic is the city's own counts or road-class defaults. No noise level is
 * summarised per city: a city average would be interpretation, and the levels are per hexagon.
 */
export interface City {
  slug: string;
  name: Text;
  /** [west, south, east, north]. */
  bbox: [number, number, number, number];
  province: Text;
  /** Hexagons at H3 resolution 11 (about 25 m), in release 2026-11-10.28f32d82e125. */
  hexagons: number;
  /** True where traffic volumes are the city's own counts and building heights its lidar. */
  calibrated: boolean;
}

export const CITIES: readonly City[] = [
  { slug: "calgary", name: { en: "Calgary", fr: "Calgary" }, bbox: [-114.334, 50.832, -113.856, 51.219], province: { en: "Alberta", fr: "Alberta" }, hexagons: 631_986, calibrated: true },
  { slug: "edmonton", name: { en: "Edmonton", fr: "Edmonton" }, bbox: [-113.735, 53.371, -113.235, 53.719], province: { en: "Alberta", fr: "Alberta" }, hexagons: 535_841, calibrated: false },
  { slug: "vancouver", name: { en: "Vancouver", fr: "Vancouver" }, bbox: [-123.293, 49.092, -122.987, 49.328], province: { en: "British Columbia", fr: "Colombie-Britannique" }, hexagons: 273_690, calibrated: false },
  { slug: "toronto", name: { en: "Toronto", fr: "Toronto" }, bbox: [-79.663, 43.571, -79.107, 43.869], province: { en: "Ontario", fr: "Ontario" }, hexagons: 582_433, calibrated: false },
  { slug: "montreal", name: { en: "Montréal", fr: "Montréal" }, bbox: [-73.984, 45.381, -73.446, 45.729], province: { en: "Quebec", fr: "Québec" }, hexagons: 623_556, calibrated: false },
  { slug: "quebec-city", name: { en: "Québec City", fr: "Québec" }, bbox: [-71.585, 46.702, -71.106, 47.007], province: { en: "Quebec", fr: "Québec" }, hexagons: 465_816, calibrated: false },
];

export function findCity(slug: string | null): City | null {
  return CITIES.find((city) => city.slug === slug) ?? null;
}

/** The middle of a city's bounding box, [longitude, latitude]: where the map opens on it. */
export function cityCenter(city: City): [number, number] {
  const [west, south, east, north] = city.bbox;
  return [(west + east) / 2, (south + north) / 2];
}

/** The covered city whose bounding box holds `at`, or null between and beyond them. */
export function cityAt(at: [number, number]): City | null {
  const [lng, lat] = at;
  return CITIES.find(({ bbox: [west, south, east, north] }) => lng >= west && lng <= east && lat >= south && lat <= north) ?? null;
}
