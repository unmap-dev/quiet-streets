import { describe, expect, it } from "vitest";
import { parseState, writeState } from "../lib/url";

describe("the shareable link", () => {
  it("opens on the picker, by day, with nothing in it", () => {
    expect(parseState("")).toEqual({ city: null, period: "day" });
    expect(writeState("", { city: null, period: "day" })).toBe("");
  });

  it("round-trips a covered city and the night colouring, and keeps other keys", () => {
    const search = writeState("?lang=fr", { city: "quebec-city", period: "night" });
    expect(search).toBe("?lang=fr&city=quebec-city&period=night");
    expect(parseState(search)).toEqual({ city: "quebec-city", period: "night" });
  });

  it("ignores a city that is not one of the six, and any period but night", () => {
    expect(parseState("?city=winnipeg&period=evening")).toEqual({ city: null, period: "day" });
    expect(parseState("?city=CALGARY")).toEqual({ city: null, period: "day" });
  });

  it("drops the keys again when they go back to their defaults", () => {
    expect(writeState("?city=calgary&period=night&lang=fr", { city: null, period: "day" })).toBe("?lang=fr");
  });
});
