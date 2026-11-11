import { findCity } from "@/lib/cities";

/**
 * The shareable link: `?city=<slug>` opens the map on that city instead of the picker, and
 * `?period=night` colours it by the night level. Other keys (such as `lang`) are kept. Pinned
 * places are not in the link: each one is a lookup, and a link should cost nothing to open. Pure
 * functions; the app owns history. Unit-tested in test/url.test.ts.
 */

export type Period = "day" | "night";

export interface QuietState {
  /** The covered city the map opened on, by slug, or null for the picker. */
  city: string | null;
  period: Period;
}

export function parseState(search: string): QuietState {
  const q = new URLSearchParams(search);
  const city = findCity(q.get("city"));
  return { city: city ? city.slug : null, period: q.get("period") === "night" ? "night" : "day" };
}

export function writeState(search: string, state: QuietState): string {
  const q = new URLSearchParams(search);
  if (state.city) q.set("city", state.city);
  else q.delete("city");
  if (state.period === "night") q.set("period", "night");
  else q.delete("period");
  const s = q.toString();
  return s ? `?${s}` : "";
}
