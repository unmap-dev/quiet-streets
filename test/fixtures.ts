import type { NoisePoint } from "@unmap/sdk";

/** A hexagon's answer, as `/noise/point` returns it. Hillhurst, Calgary, unless overridden. */
export function noisePoint(overrides: Partial<NoisePoint> = {}): NoisePoint {
  return {
    h3: "8b12ab000000fff",
    resolution: 11,
    city: "calgary",
    lden: 54.5,
    lnight: 45.4,
    score: 77,
    risk: 23,
    label: "Moderate",
    exceeds_who: { day: true, night: true },
    dominant_source: "road",
    sources_db: { road: 52.0, rail: 46.0, aircraft: null, commercial: 29.1 },
    ...overrides,
  };
}

/** A hexagon with no modelled source in range: null levels, never 0 dB. */
export function silentPoint(overrides: Partial<NoisePoint> = {}): NoisePoint {
  return noisePoint({
    h3: "8b12ab00000efff",
    lden: null,
    lnight: null,
    score: null,
    risk: null,
    label: null,
    exceeds_who: { day: null, night: null },
    dominant_source: null,
    sources_db: { road: null, rail: null, aircraft: null, commercial: null },
    note: "no modelled source within range",
    ...overrides,
  });
}

export const META = { attribution: "© OpenStreetMap contributors; noise model: PickYourPlace", licence: "ODbL-1.0", status: "current", unmap_updated_at: "2026-11-10" };

export const CITIES_422 = {
  code: "outside_coverage",
  error: "outside the covered cities",
  cities: [{ slug: "calgary", name: { en: "Calgary", fr: "Calgary" }, bbox: [-114.334, 50.832, -113.856, 51.219] }],
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
