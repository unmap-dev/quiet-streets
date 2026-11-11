import { describe, expect, it, vi } from "vitest";
import { Noise } from "@unmap/sdk";
import { createNoiseSession, installNoiseSession } from "../lib/session";
import { CITIES_422, META, json, noisePoint } from "./fixtures";

const GATEWAY = "https://api.test";

/** A gateway that answers the three paths the session watches, counting what reaches it. */
function gateway(answer: (url: URL) => Response | Promise<Response> = () => json({ data: noisePoint(), meta: META })) {
  return vi.fn(async (input: RequestInfo | URL) => answer(new URL(String(input))));
}

describe("the noise session", () => {
  it("passes the answer through untouched and publishes the lookup, named by nothing", async () => {
    const base = gateway();
    const session = createNoiseSession({ gateway: GATEWAY, fetch: base });
    const noise = new Noise({ key: "k", gateway: GATEWAY, fetch: session.fetch });
    const { data } = await noise.point({ lat: 51.054, lng: -114.0884 });
    expect(data.lden).toBe(54.5);
    expect(session.getSnapshot().lookup).toMatchObject({ at: [-114.0884, 51.054], name: null, status: "ready", point: { h3: "8b12ab000000fff" } });
    expect(session.getSnapshot().requests).toBe(1);
  });

  it("answers the same request from memory: one call per place for the session", async () => {
    const base = gateway();
    const session = createNoiseSession({ gateway: GATEWAY, fetch: base });
    const noise = new Noise({ key: "k", gateway: GATEWAY, fetch: session.fetch });
    await noise.point({ lat: 51.054, lng: -114.0884 });
    const again = await noise.point({ lat: 51.054, lng: -114.0884 });
    expect(again.data.score).toBe(77);
    expect(base).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot()).toMatchObject({ requests: 1, cacheHits: 1, lookup: { status: "ready" } });
    await noise.point({ lat: 51.06, lng: -114.0884 });
    expect(base).toHaveBeenCalledTimes(2);
  });

  it("keeps a 422 outside the six cities, but never a refusal or an outage", async () => {
    let status = 422;
    const base = gateway(() => (status === 422 ? json(CITIES_422, 422) : json({ code: "service_unavailable" }, 503)));
    const session = createNoiseSession({ gateway: GATEWAY, fetch: base });
    const noise = new Noise({ key: "k", gateway: GATEWAY, fetch: session.fetch, retry: false });
    await expect(noise.point({ lat: 49.9, lng: -97.1 })).rejects.toMatchObject({ status: 422, code: "outside_coverage" });
    await expect(noise.point({ lat: 49.9, lng: -97.1 })).rejects.toMatchObject({ status: 422 });
    expect(base).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot().lookup?.status).toBe("outside");
    status = 503;
    await expect(noise.point({ lat: 45.5, lng: -73.6 })).rejects.toMatchObject({ status: 503 });
    await expect(noise.point({ lat: 45.5, lng: -73.6 })).rejects.toMatchObject({ status: 503 });
    expect(base).toHaveBeenCalledTimes(3);
    expect(session.getSnapshot().lookup?.status).toBe("failed");
  });

  it("names a place chosen from the search box by the suggestion's coordinates", async () => {
    const base = gateway((url) =>
      url.pathname === "/geocode/autocomplete"
        ? json({ results: [{ id: "a", name: "236 11 Street NW", layer: "address", lat: 51.054, lng: -114.0884 }] })
        : json({ data: noisePoint(), meta: META }),
    );
    const session = createNoiseSession({ gateway: GATEWAY, fetch: base });
    await (await session.fetch(`${GATEWAY}/geocode/autocomplete?text=236&key=k`)).json();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Noise({ key: "k", gateway: GATEWAY, fetch: session.fetch }).point({ lat: 51.054, lng: -114.0884 });
    expect(session.getSnapshot().lookup?.name).toBe("236 11 Street NW");
  });

  it("reads the block's add-on probe: granted, refused, or not known", async () => {
    for (const [response, gate] of [
      [new Response(null, { status: 204 }), "granted"],
      [json({ code: "addon_required", addon: "addon-urban-noise" }, 403), "refused"],
      [json({ code: "not_found" }, 404), "unknown"],
    ] as const) {
      const session = createNoiseSession({ gateway: GATEWAY, fetch: vi.fn(async () => response.clone()) });
      const res = await session.fetch(`${GATEWAY}/layers/urban-noise/22/0/0?key=k`);
      expect(res.status).toBe(response.status);
      expect(session.getSnapshot().gate).toBe(gate);
    }
  });

  it("clears the lookup when the block cancels it, and lets a newer one win", async () => {
    let release: (value: Response) => void = () => {};
    const base = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          release = resolve;
          init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
        }),
    );
    const session = createNoiseSession({ gateway: GATEWAY, fetch: base });
    const controller = new AbortController();
    const first = session.fetch(`${GATEWAY}/noise/point?key=k&lat=51&lng=-114`, { signal: controller.signal });
    expect(session.getSnapshot().lookup?.status).toBe("pending");
    controller.abort();
    await expect(first).rejects.toMatchObject({ name: "AbortError" });
    expect(session.getSnapshot().lookup).toBeNull();

    const older = session.fetch(`${GATEWAY}/noise/point?key=k&lat=51&lng=-114.1`);
    const releaseOlder = release;
    const newer = session.fetch(`${GATEWAY}/noise/point?key=k&lat=51&lng=-114.2`);
    release(json({ data: noisePoint({ h3: "newer" }), meta: META }));
    await newer;
    releaseOlder(json({ data: noisePoint({ h3: "older" }), meta: META }));
    await older;
    expect(session.getSnapshot().lookup?.point?.h3).toBe("newer");
  });

  it("leaves every other request alone: other paths, other origins, other methods", async () => {
    const base = vi.fn(async () => json({ ok: true }));
    const session = createNoiseSession({ gateway: GATEWAY, fetch: base });
    await session.fetch(`${GATEWAY}/styles/muted.json?key=k`);
    await session.fetch("https://elsewhere.test/noise/point?lat=1&lng=2");
    await session.fetch(`${GATEWAY}/noise/point?lat=1&lng=2`, { method: "POST" });
    expect(base).toHaveBeenCalledTimes(3);
    expect(session.getSnapshot()).toEqual({ gate: "unknown", lookup: null, requests: 0, cacheHits: 0 });
  });

  it("is installed once, in front of the page's own fetch", async () => {
    const page = { fetch: vi.fn(async () => json({ data: noisePoint(), meta: META })) } as unknown as typeof globalThis;
    const original = page.fetch;
    const session = installNoiseSession(GATEWAY, page);
    expect(page.fetch).toBe(session.fetch);
    expect(installNoiseSession(GATEWAY, page)).toBe(session);
    await page.fetch(`${GATEWAY}/noise/point?lat=51&lng=-114`);
    expect(original).toHaveBeenCalledTimes(1);
  });
});
