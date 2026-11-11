import type { NoisePoint, NoiseSource } from "@unmap/sdk";
import type { Lookup } from "@/lib/session";

/**
 * The places pinned for comparison: at most three, one per hexagon, in the order they were
 * pinned. Each keeps the answer the block was given, so comparing makes no call. Plain
 * functions, unit-tested in test/pins.test.ts.
 */

export const MAX_PINS = 3;

/** The WHO 2018 road-traffic guideline: 53 dB Lden by day, 45 dB Lnight at night. */
export const WHO_DB = { day: 53, night: 45 } as const;

/** The range the comparison bars are drawn on, in dB, as the block's card draws its own. */
export const SCALE_DB = { min: 30, max: 80 } as const;

export interface Pin {
  /** The hexagon's H3 index: two spots in one hexagon have one answer, so they are one pin. */
  id: string;
  at: [number, number];
  name: string | null;
  point: NoisePoint;
}

/** The pin a finished lookup makes, or null while it is pending, outside coverage or failed. */
export function pinOf(lookup: Lookup | null): Pin | null {
  if (!lookup || lookup.status !== "ready" || !lookup.point) return null;
  return { id: lookup.point.h3, at: lookup.at, name: lookup.name, point: lookup.point };
}

export type PinResult = { pins: Pin[]; added: true } | { pins: Pin[]; added: false; reason: "full" | "duplicate" };

export function addPin(pins: readonly Pin[], pin: Pin): PinResult {
  if (pins.some((p) => p.id === pin.id)) return { pins: [...pins], added: false, reason: "duplicate" };
  if (pins.length >= MAX_PINS) return { pins: [...pins], added: false, reason: "full" };
  return { pins: [...pins, pin], added: true };
}

export function removePin(pins: readonly Pin[], id: string): Pin[] {
  return pins.filter((p) => p.id !== id);
}

/** Where a pin sits in the list, 1-based, as its map marker is numbered; 0 when it is not pinned. */
export function pinNumber(pins: readonly Pin[], id: string): number {
  return pins.findIndex((p) => p.id === id) + 1;
}

export type Measure = "score" | "lden" | "lnight";

/** A level as the reader sees it: whole decibels. Comparisons use this, so a tie on screen is a tie. */
const shown = (value: number) => Math.round(value);

function valueOf(pin: Pin, measure: Measure): number | null {
  const value = pin.point[measure];
  return typeof value === "number" && Number.isFinite(value) ? shown(value) : null;
}

/**
 * The pins that are quietest on `measure`: the highest score, or the lowest level. Only pins with
 * a value take part (a place with no modelled source is never "quiet"), and there is no winner
 * with fewer than two values or when every value is the same.
 */
export function quietest(pins: readonly Pin[], measure: Measure): string[] {
  const valued = pins.flatMap((pin) => {
    const value = valueOf(pin, measure);
    return value === null ? [] : [{ id: pin.id, value }];
  });
  if (valued.length < 2) return [];
  const values = valued.map((v) => v.value);
  const best = measure === "score" ? Math.max(...values) : Math.min(...values);
  if (values.every((v) => v === best)) return [];
  return valued.filter((v) => v.value === best).map((v) => v.id);
}

/** Where a level falls on the comparison scale, 0 to 1. */
export function scaleShare(db: number): number {
  return Math.min(1, Math.max(0, (db - SCALE_DB.min) / (SCALE_DB.max - SCALE_DB.min)));
}

/** A pin's level for a period against the guideline; null `db` when nothing is modelled there. */
export function reading(pin: Pin, period: "day" | "night"): { db: number | null; above: boolean | null } {
  const db = period === "day" ? pin.point.lden : pin.point.lnight;
  if (db === null || !Number.isFinite(db)) return { db: null, above: null };
  const flagged = pin.point.exceeds_who[period];
  return { db, above: typeof flagged === "boolean" ? flagged : db > WHO_DB[period] };
}

/** The pin's main source, only when that source has a level: the gateway never names one it did not model. */
export function mainSource(pin: Pin): NoiseSource | null {
  const source = pin.point.dominant_source;
  return source && typeof pin.point.sources_db[source] === "number" ? source : null;
}
