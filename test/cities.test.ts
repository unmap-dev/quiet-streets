// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { NOISE_AREA_NAMES } from "../components/ui/urban-noise-map";
import { AREA_ZOOM, CITIES, COVERAGE_BBOX, cityAt, cityCenter, citiesByName, findCity, fitView, panelPadding } from "../lib/cities";

describe("the 41 metropolitan areas", () => {
  it("are the block's own, by slug and name", () => {
    expect(CITIES).toHaveLength(41);
    expect(Object.fromEntries(CITIES.map(({ slug, name }) => [slug, name]))).toEqual(NOISE_AREA_NAMES);
  });

  it("fit inside the coverage bounds, which their boxes make up", () => {
    const [west, south, east, north] = COVERAGE_BBOX;
    for (const { bbox } of CITIES) {
      expect(bbox[0]).toBeGreaterThanOrEqual(west - 0.01);
      expect(bbox[1]).toBeGreaterThanOrEqual(south - 0.01);
      expect(bbox[2]).toBeLessThanOrEqual(east + 0.01);
      expect(bbox[3]).toBeLessThanOrEqual(north + 0.01);
    }
    expect(Math.min(...CITIES.map(({ bbox }) => bbox[0]))).toBeCloseTo(west, 1);
    expect(Math.max(...CITIES.map(({ bbox }) => bbox[3]))).toBeCloseTo(north, 1);
  });

  it("find the area a point is in, the smallest box winning where boxes overlap, and none between them", () => {
    expect(cityAt([-114.0884, 51.054])?.slug).toBe("calgary");
    expect(cityAt([-73.57, 45.5])?.slug).toBe("montreal");
    expect(cityAt([-97.14, 49.9])?.slug).toBe("winnipeg");
    // Oshawa and Hamilton sit inside Toronto's box; downtown Toronto is only Toronto's.
    expect(cityAt([-78.86, 43.9])?.slug).toBe("oshawa");
    expect(cityAt([-79.87, 43.25])?.slug).toBe("hamilton");
    expect(cityAt([-79.38, 43.65])?.slug).toBe("toronto");
    expect(cityAt([-97.85, 55.74])).toBeNull();
    for (const city of CITIES) expect(cityAt(cityCenter(city))).not.toBeNull();
  });

  it("look a slug up, and nothing else", () => {
    expect(findCity("ottawa-gatineau")?.name.fr).toBe("Ottawa–Gatineau");
    expect(findCity("greater-sudbury")?.name.fr).toBe("Grand Sudbury");
    expect(findCity("ottawa")).toBeNull();
    expect(findCity(null)).toBeNull();
  });

  it("sort by name the way each language does", () => {
    const en = citiesByName("en").map((city) => city.name.en);
    expect(en[0]).toBe("Abbotsford–Mission");
    expect(en.at(-1)).toBe("Winnipeg");
    expect(en.indexOf("Québec City")).toBeLessThan(en.indexOf("Red Deer"));
    const fr = citiesByName("fr").map((city) => city.name.fr);
    expect(fr.indexOf("Grand Sudbury")).toBeLessThan(fr.indexOf("Guelph"));
    expect(fr).toHaveLength(41);
  });
});

describe("the opening view", () => {
  /** The box a camera shows on a `width` x `height` map, inside its padding. */
  function shown(center: [number, number], zoom: number, width: number, height: number, padding = panelPadding(width, height)) {
    const world = 512 * 2 ** zoom;
    const x = ((center[0] + 180) / 360) * world;
    const y = ((Math.PI - Math.log(Math.tan(Math.PI / 4 + (center[1] * Math.PI) / 360))) / (2 * Math.PI)) * world;
    const lng = (px: number) => ((x + px - width / 2) / world) * 360 - 180;
    const lat = (py: number) => (360 / Math.PI) * Math.atan(Math.exp(Math.PI - ((y + py - height / 2) / world) * 2 * Math.PI)) - 90;
    return [lng(padding.left), lat(height - padding.bottom), lng(width - padding.right), lat(padding.top)];
  }

  it("fits the national bounds on a desktop, clear of the card on the left", () => {
    const { center, zoom } = fitView(COVERAGE_BBOX, 1440, 760);
    expect(zoom).toBeGreaterThan(2.5);
    expect(zoom).toBeLessThan(AREA_ZOOM);
    const [west, south, east, north] = shown(center, zoom, 1440, 760);
    expect(west).toBeLessThanOrEqual(COVERAGE_BBOX[0] + 0.05);
    expect(east).toBeGreaterThanOrEqual(COVERAGE_BBOX[2] - 0.05);
    expect(south).toBeLessThanOrEqual(COVERAGE_BBOX[1] + 0.05);
    expect(north).toBeGreaterThanOrEqual(COVERAGE_BBOX[3] - 0.05);
    // Width is the tight side: the frame touches west and east.
    expect(west).toBeCloseTo(COVERAGE_BBOX[0], 0);
    expect(east).toBeCloseTo(COVERAGE_BBOX[2], 0);
  });

  it("fits the national bounds on a phone, above the sheet", () => {
    const { center, zoom } = fitView(COVERAGE_BBOX, 375, 640);
    expect(zoom).toBeGreaterThan(1);
    expect(zoom).toBeLessThan(fitView(COVERAGE_BBOX, 1440, 760).zoom);
    const [west, south, east, north] = shown(center, zoom, 375, 640);
    expect(west).toBeLessThanOrEqual(COVERAGE_BBOX[0] + 0.05);
    expect(east).toBeGreaterThanOrEqual(COVERAGE_BBOX[2] - 0.05);
    expect(south).toBeLessThanOrEqual(COVERAGE_BBOX[1] + 0.05);
    expect(north).toBeGreaterThanOrEqual(COVERAGE_BBOX[3] - 0.05);
  });

  it("frames one area at a street-reading zoom, never past 13", () => {
    const winnipeg = findCity("winnipeg")!;
    const { center, zoom } = fitView(winnipeg.bbox, 1440, 760);
    expect(zoom).toBeGreaterThan(AREA_ZOOM);
    expect(zoom).toBeLessThanOrEqual(13);
    const [west, south, east, north] = shown(center, zoom, 1440, 760);
    expect(west).toBeLessThanOrEqual(winnipeg.bbox[0] + 0.001);
    expect(east).toBeGreaterThanOrEqual(winnipeg.bbox[2] - 0.001);
    expect(south).toBeLessThanOrEqual(winnipeg.bbox[1] + 0.001);
    expect(north).toBeGreaterThanOrEqual(winnipeg.bbox[3] - 0.001);
    expect(fitView(findCity("red-deer")!.bbox, 1440, 760).zoom).toBeLessThanOrEqual(13);
    // Every area frames past AREA_ZOOM, on a phone too, so the header switch names it after a jump.
    for (const city of CITIES) expect(fitView(city.bbox, 375, 640).zoom, city.slug).toBeGreaterThanOrEqual(AREA_ZOOM);
    expect(fitView(COVERAGE_BBOX, 2560, 1400).zoom).toBeLessThan(AREA_ZOOM);
  });
});
