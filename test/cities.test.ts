// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { NOISE_CITIES } from "../components/ui/urban-noise-map";
import { CITIES, cityAt, cityCenter, findCity } from "../lib/cities";

describe("the six cities", () => {
  it("are the block's own, in its order, with the same names and bounding boxes", () => {
    expect(CITIES.map(({ slug, name, bbox }) => ({ slug, name, bbox }))).toEqual(NOISE_CITIES);
  });

  it("carry the docs' grid sizes, which add up to the release's resolution-11 hexagons", () => {
    expect(CITIES.reduce((sum, city) => sum + city.hexagons, 0)).toBe(3_113_322);
  });

  it("name Calgary as the one calibrated city", () => {
    expect(CITIES.filter((city) => city.calibrated).map((city) => city.slug)).toEqual(["calgary"]);
  });

  it("find the city a point is in, and none between them", () => {
    expect(cityAt([-114.0884, 51.054])?.slug).toBe("calgary");
    expect(cityAt([-73.57, 45.5])?.slug).toBe("montreal");
    expect(cityAt([-97.14, 49.9])).toBeNull();
    for (const city of CITIES) expect(cityAt(cityCenter(city))?.slug).toBe(city.slug);
  });

  it("look a slug up, and nothing else", () => {
    expect(findCity("toronto")?.name.fr).toBe("Toronto");
    expect(findCity("ottawa")).toBeNull();
    expect(findCity(null)).toBeNull();
  });
});
