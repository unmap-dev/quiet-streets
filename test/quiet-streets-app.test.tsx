// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { CITIES_422, META, json, noisePoint, silentPoint } from "./fixtures";

type Props = Record<string, unknown>;
type Handler = (event?: unknown) => void;

const GATEWAY = "https://api.test";

/** The block's MapLibre map, as far as the block and the app touch it. */
function fakeMap() {
  const handlers: Record<string, Set<Handler>> = {};
  const map = {
    pick: false,
    center: { lng: -114.07, lat: 51.04 },
    on: (type: string, fn: Handler) => void (handlers[type] ??= new Set()).add(fn),
    off: (type: string, fn: Handler) => void handlers[type]?.delete(fn),
    fire: (type: string, event?: unknown) => handlers[type]?.forEach((fn) => fn(event)),
    getSource: (id: string) => (id === "urban-noise-map-pick" && map.pick ? {} : undefined),
    getCenter: () => map.center,
    getLayer: () => undefined,
    getStyle: () => null,
    getCanvas: () => undefined,
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, right: 1000, bottom: 700, width: 1000, height: 700 }) }),
    getZoom: () => 12,
    flyTo: vi.fn(),
    jumpTo: vi.fn(),
    fitBounds: vi.fn(),
  };
  return map;
}

const mocks = vi.hoisted(() => ({
  key: "um_test_quiet",
  map: null as ReturnType<typeof fakeMap> | null,
  props: {} as Record<string, Props | undefined>,
  markers: [] as Props[],
}));

vi.mock("@/lib/kit/config", async (orig) => ({
  ...(await orig<typeof import("@/lib/kit/config")>()),
  get API_KEY() {
    return mocks.key;
  },
  GATEWAY: "https://api.test",
}));
// The map item, the marker and the map context are tested in apps/registry; here they only record what they get.
vi.mock("@/components/ui/map", () => ({
  Map: (props: Props) => {
    mocks.props.map = props;
    return <div data-testid="map">{props.children as ReactNode}</div>;
  },
}));
vi.mock("@/components/ui/marker-popup", () => ({
  Marker: (props: Props) => {
    mocks.markers.push(props);
    return <div data-testid="pin-marker">{props.markerContent as ReactNode}</div>;
  },
}));
vi.mock("@/lib/map-context", () => ({
  MapProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useMap: () => mocks.map,
  useMapReady: () => true,
  useMapGeneration: () => 1,
}));

import { QuietStreetsApp } from "../components/quiet/quiet-streets-app";
import { createNoiseSession, type NoiseSession } from "../lib/session";

let gateway: ReturnType<typeof vi.fn>;
let session: NoiseSession;
let pageFetch: typeof fetch;
let answers: { probe: () => Response; point: (url: URL) => Response };

function calls(path: string) {
  return gateway.mock.calls.filter(([input]) => new URL(String(input)).pathname === path).length;
}

async function open(search = "") {
  window.history.replaceState(null, "", `/${search}`);
  await act(async () => {
    render(<QuietStreetsApp session={session} />);
  });
  await act(async () => {});
}

/** A click on the block's map, as MapLibre reports it, then the block's marker appearing. */
async function clickMap(lng: number, lat: number) {
  await act(async () => {
    mocks.map!.fire("click", { lngLat: { lng, lat } });
  });
  await act(async () => {
    mocks.map!.pick = true;
    mocks.map!.fire("sourcedata");
  });
}

beforeEach(() => {
  // A wide screen with a mouse and no motion preference: jsdom has no matchMedia of its own.
  window.matchMedia = ((query: string) => ({
    matches: query.includes("min-width"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  mocks.key = "um_test_quiet";
  mocks.map = fakeMap();
  mocks.props = {};
  mocks.markers = [];
  answers = {
    probe: () => new Response(null, { status: 204 }),
    point: () => json({ data: noisePoint(), meta: META }),
  };
  gateway = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname === "/layers/urban-noise/22/0/0") return answers.probe();
    if (url.pathname === "/noise/point") return answers.point(url);
    return json({ results: [] });
  });
  session = createNoiseSession({ gateway: GATEWAY, fetch: gateway as unknown as typeof fetch });
  pageFetch = globalThis.fetch;
  // As client-entry.tsx does: the block's clients bind the page's fetch when they are built.
  globalThis.fetch = session.fetch;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = pageFetch;
});

describe("without a key", () => {
  it("says what is needed, links pricing, and calls nothing", async () => {
    mocks.key = "";
    await open("?city=calgary");
    expect(document.querySelector("[data-missing-key]")).not.toBeNull();
    const addon = document.querySelector("[data-needs-addon]") as HTMLElement;
    expect(addon.textContent).toContain("Urban Noise add-on");
    expect(within(addon).getByRole("link", { name: "Plans and add-ons" }).getAttribute("href")).toBe("https://unmap.dev/pricing");
    expect(gateway).not.toHaveBeenCalled();
    expect(screen.queryByTestId("map")).toBeNull();
  });
});

describe("the city picker", () => {
  it("opens first, lists the six cities, and calls nothing", async () => {
    await open();
    const picker = document.querySelector("[data-city-picker]") as HTMLElement;
    expect([...picker.querySelectorAll("[data-city]")].map((el) => el.getAttribute("data-city"))).toEqual(["calgary", "edmonton", "vancouver", "toronto", "montreal", "quebec-city"]);
    expect(picker.textContent).toContain("631,986 hexagons");
    expect(picker.textContent).toContain("Traffic from the city's own counts");
    expect(within(picker).getByRole("link", { name: "Coverage and limits" }).getAttribute("href")).toBe("https://unmap.dev/docs/urban-noise#coverage-and-limits");
    expect(gateway).not.toHaveBeenCalled();
  });

  it("opens the map on the picked city and puts it in the link", async () => {
    await open();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open the noise map of Toronto" }));
    });
    await act(async () => {});
    expect(window.location.search).toBe("?city=toronto");
    expect(mocks.props.map?.center).toEqual([(-79.663 + -79.107) / 2, (43.571 + 43.869) / 2]);
    expect(mocks.props.map?.overlays).toEqual(["urban-noise"]);
    expect(calls("/layers/urban-noise/22/0/0")).toBe(1);
  });

  it("is in French with ?lang=fr, docs link included", async () => {
    await open("?lang=fr");
    expect(screen.getByRole("heading", { name: "Quelle ville?" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Couverture et limites" }).getAttribute("href")).toBe("https://unmap.dev/fr/docs/urban-noise#couverture-et-limites");
  });
});

describe("the noise map", () => {
  it("keeps the modelled banner and both credits in view", async () => {
    await open("?city=calgary");
    expect(document.querySelector("[data-modelled-notice]")?.textContent).toContain("Modelled, not measured.");
    const credits = screen.getByTestId("noise-credits").textContent ?? "";
    expect(credits).toContain("© OpenStreetMap contributors");
    expect(credits).toContain("noise model: PickYourPlace");
  });

  it("pins a clicked place without asking for it again, and caches the session's answers", async () => {
    await open("?city=calgary");
    const tray = () => document.querySelector("[data-compare-tray=card]") as HTMLElement;
    expect(tray().textContent).toContain("Pin up to three");

    await clickMap(-114.0884, 51.054);
    expect(calls("/noise/point")).toBe(1);
    await act(async () => {
      fireEvent.click(within(tray()).getByRole("button", { name: "Pin this place" }));
    });
    expect(within(tray()).getByRole("button", { name: "Pinned as 1" })).toBeTruthy();
    expect(tray().textContent).toContain("Day 55 dB, night 45 dB");
    expect(mocks.markers.at(-1)?.lngLat).toEqual([-114.0884, 51.054]);
    expect(mocks.markers.at(-1)?.mapId).toBe("urban-noise-map");

    // The same spot again is the session's, not the network's.
    await clickMap(-114.0884, 51.054);
    expect(calls("/noise/point")).toBe(1);
    expect(session.getSnapshot().cacheHits).toBe(1);
  });

  it("compares up to three places side by side, from the answers it already has", async () => {
    answers.point = (url) => {
      const lng = Number(url.searchParams.get("lng"));
      if (lng === -114.1) return json({ data: noisePoint({ h3: "quiet", lden: 47.6, lnight: 39.2, score: 88, label: "Quiet", exceeds_who: { day: false, night: false } }), meta: META });
      if (lng === -114.2) return json({ data: silentPoint(), meta: META });
      return json({ data: noisePoint({ h3: `hex${lng}` }), meta: META });
    };
    await open("?city=calgary&period=night");
    const tray = () => document.querySelector("[data-compare-tray=card]") as HTMLElement;
    for (const lng of [-114.0884, -114.1, -114.2]) {
      await clickMap(lng, 51.05);
      await act(async () => {
        fireEvent.click(within(tray()).getByRole("button", { name: "Pin this place" }));
      });
    }
    await clickMap(-114.3, 51.05);
    expect(within(tray()).getByRole("button", { name: "Pin this place" }).hasAttribute("disabled")).toBe(true);
    expect(tray().textContent).toContain("Three places are pinned");
    const before = calls("/noise/point");

    await act(async () => {
      fireEvent.click(within(tray()).getByRole("button", { name: "Compare side by side" }));
    });
    const sheet = document.querySelector("[data-compare-sheet]") as HTMLElement;
    expect(calls("/noise/point")).toBe(before);
    const day = sheet.querySelector("[data-period-section=day]") as HTMLElement;
    const night = sheet.querySelector("[data-period-section=night]") as HTMLElement;
    expect(night.getAttribute("data-active")).toBe("true");
    expect(day.textContent).toContain("WHO guideline, 53 dB");
    expect(night.textContent).toContain("WHO guideline, 45 dB");
    expect(day.textContent).toContain("55 dB");
    expect(day.textContent).toContain("48 dB");
    expect(day.textContent).toContain("Quietest");
    // The silent hexagon says so and is never a number, never quiet.
    expect(day.textContent).toContain("No modelled source");
    expect(day.textContent).not.toMatch(/\b0 dB/);
    expect(sheet.textContent).toContain("© OpenStreetMap contributors");
    expect(sheet.textContent).toContain("noise model: PickYourPlace");
  });

  it("offers no pin for a place outside the six cities, and the block says it is not covered", async () => {
    answers.point = () => json(CITIES_422, 422);
    await open("?city=calgary");
    await clickMap(-97.14, 49.9);
    const tray = document.querySelector("[data-compare-tray=card]") as HTMLElement;
    expect(within(tray).queryByRole("button", { name: "Pin this place" })).toBeNull();
    expect(screen.getByText("This place is not covered")).toBeTruthy();
  });

  it("shows no compare tray to a key without the add-on, and the block links pricing", async () => {
    answers.probe = () => json({ error: "needs the Urban Noise add-on", code: "addon_required", addon: "addon-urban-noise" }, 403);
    await open("?city=calgary");
    expect(document.querySelector("[data-compare-tray]")).toBeNull();
    expect(document.querySelector("[data-unmap-addon-gate=addon_required]")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Plans and add-ons" }).getAttribute("href")).toBe("https://unmap.dev/pricing");
    expect(calls("/noise/point")).toBe(0);
  });

  it("shows the city the camera is over in the header's switch", async () => {
    await open("?city=calgary");
    await act(async () => {
      mocks.map!.center = { lng: -73.57, lat: 45.5 };
      mocks.map!.fire("moveend");
    });
    expect(document.querySelector("[data-city-select]")?.textContent).toContain("Montréal");
  });
});
