import { describe, expect, it } from "vitest";
import { MAX_PINS, addPin, mainSource, pinNumber, pinOf, quietest, reading, removePin, scaleShare, type Pin } from "../lib/pins";
import type { Lookup } from "../lib/session";
import { noisePoint, silentPoint } from "./fixtures";

const pin = (id: string, overrides: Parameters<typeof noisePoint>[0] = {}): Pin => ({ id, at: [-114, 51], name: id, point: noisePoint({ h3: id, ...overrides }) });

describe("pins", () => {
  it("come only from a finished lookup", () => {
    const base: Lookup = { seq: 1, at: [-114, 51], name: "Here", status: "pending", point: null };
    expect(pinOf(null)).toBeNull();
    expect(pinOf(base)).toBeNull();
    expect(pinOf({ ...base, status: "outside" })).toBeNull();
    expect(pinOf({ ...base, status: "ready", point: noisePoint() })).toEqual({ id: "8b12ab000000fff", at: [-114, 51], name: "Here", point: noisePoint() });
  });

  it("hold at most three, one per hexagon, in the order they were pinned", () => {
    let pins: Pin[] = [];
    for (const id of ["a", "b", "c"]) pins = addPin(pins, pin(id)).pins;
    expect(MAX_PINS).toBe(3);
    expect(addPin(pins, pin("d"))).toMatchObject({ added: false, reason: "full" });
    expect(addPin(pins.slice(0, 2), pin("a"))).toMatchObject({ added: false, reason: "duplicate" });
    expect(pinNumber(pins, "b")).toBe(2);
    expect(pinNumber(pins, "z")).toBe(0);
    pins = removePin(pins, "a");
    expect(pins.map((p) => p.id)).toEqual(["b", "c"]);
    expect(addPin(pins, pin("d"))).toMatchObject({ added: true });
  });
});

describe("the quietest place", () => {
  it("is the lowest level or the highest score", () => {
    const pins = [pin("a", { lden: 61.2, lnight: 50, score: 40 }), pin("b", { lden: 48.6, lnight: 52, score: 81 }), pin("c", { lden: 55, lnight: 41, score: 70 })];
    expect(quietest(pins, "lden")).toEqual(["b"]);
    expect(quietest(pins, "lnight")).toEqual(["c"]);
    expect(quietest(pins, "score")).toEqual(["b"]);
  });

  it("goes by whole decibels, as the reader sees them, so a tie on screen is a tie", () => {
    expect(quietest([pin("a", { lden: 54.2 }), pin("b", { lden: 53.8 })], "lden")).toEqual([]);
    expect(quietest([pin("a", { lden: 50.2 }), pin("b", { lden: 50.4 }), pin("c", { lden: 58 })], "lden")).toEqual(["a", "b"]);
  });

  it("never counts a place with no modelled source as quiet, and needs two values to compare", () => {
    const silent: Pin = { id: "s", at: [-114, 51], name: null, point: silentPoint() };
    expect(quietest([silent, pin("a", { lden: 70 })], "lden")).toEqual([]);
    expect(quietest([silent, pin("a", { lden: 70 }), pin("b", { lden: 60 })], "lden")).toEqual(["b"]);
    expect(quietest([silent, pin("a", { score: 30 })], "score")).toEqual([]);
  });
});

describe("a pin's reading", () => {
  it("is the gateway's own WHO verdict, and null with no number where nothing is modelled", () => {
    expect(reading(pin("a"), "day")).toEqual({ db: 54.5, above: true });
    expect(reading(pin("a", { lnight: 44, exceeds_who: { day: true, night: false } }), "night")).toEqual({ db: 44, above: false });
    expect(reading({ id: "s", at: [0, 0], name: null, point: silentPoint() }, "day")).toEqual({ db: null, above: null });
  });

  it("names a main source only when that source has a level", () => {
    expect(mainSource(pin("a"))).toBe("road");
    expect(mainSource(pin("a", { dominant_source: "aircraft" }))).toBeNull();
    expect(mainSource({ id: "s", at: [0, 0], name: null, point: silentPoint() })).toBeNull();
  });

  it("sits on the 30 to 80 dB scale, clamped", () => {
    expect(scaleShare(55)).toBe(0.5);
    expect(scaleShare(20)).toBe(0);
    expect(scaleShare(95)).toBe(1);
  });
});
