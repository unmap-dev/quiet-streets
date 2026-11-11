import type { NoisePoint } from "@unmap/sdk";

/**
 * The session's noise lookups: a cache and a read-only view under the urban-noise-map block's own
 * requests.
 *
 * The block is copied in unmodified, and it owns its `/noise/point` call: it builds its own SDK
 * client and exposes no callback with the answer. Pinning and comparing need that answer, and
 * asking for it a second time would bill the reader twice for one place. So the app hands the
 * page a `fetch` that sits in front of the real one and, for three gateway paths only, keeps what
 * goes past:
 *
 * - `GET /noise/point`: an answer (200, or 422 outside the six cities) is kept for the session,
 *   keyed by the exact request, and served from memory if the same request is made again. Every
 *   lookup is published, so the app knows the place on the block's card and its levels.
 * - `GET /geocode/autocomplete`: the suggestions' names, by coordinate, so a place chosen from
 *   the search box is pinned under its name rather than as "Dropped pin".
 * - `GET /layers/urban-noise/22/0/0`, the block's add-on probe: whether the key holds Urban Noise,
 *   so the compare tray shows only when the block can look anything up.
 *
 * Everything else, including every request to another origin, goes straight through untouched.
 * Plain TypeScript with an injected `fetch`, unit-tested in test/session.test.ts.
 */

export type GateState = "unknown" | "granted" | "refused";

export interface Lookup {
  /** One per request the block makes; the newest wins. */
  seq: number;
  /** [longitude, latitude], exactly as the block asked for it. */
  at: [number, number];
  /** The search result's name when the place came from the search box, else null. */
  name: string | null;
  status: "pending" | "ready" | "outside" | "failed";
  /** The hexagon's noise, once `ready`. */
  point: NoisePoint | null;
}

export interface SessionSnapshot {
  gate: GateState;
  /** The block's newest lookup, or null before the first and after one is cancelled. */
  lookup: Lookup | null;
  /** `/noise/point` requests that reached the network. */
  requests: number;
  /** `/noise/point` requests answered from the session cache instead. */
  cacheHits: number;
}

export interface NoiseSession {
  fetch: typeof fetch;
  subscribe(listener: () => void): () => void;
  getSnapshot(): SessionSnapshot;
}

/** An answer kept for the session: the body and status, replayed as a fresh Response each time. */
interface Kept {
  status: number;
  body: string;
}

/** Search suggestions remembered by coordinate, newest kept; a session never needs more. */
const MAX_NAMES = 500;

const PROBE_PATH = "/layers/urban-noise/22/0/0";

function urlOf(input: RequestInfo | URL): URL | null {
  try {
    return new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  } catch {
    return null;
  }
}

function methodOf(input: RequestInfo | URL, init?: RequestInit): string {
  return (init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")).toUpperCase();
}

function isAbort(caught: unknown): boolean {
  return (caught as { name?: unknown } | null)?.name === "AbortError";
}

/** The coordinate key the search box and the lookup share: the numbers as the URL carries them. */
const coordKey = (lat: string, lng: string) => `${lat},${lng}`;

export function createNoiseSession({ gateway, fetch: base }: { gateway: string; fetch: typeof fetch }): NoiseSession {
  const origin = new URL(gateway).origin;
  const kept = new Map<string, Kept>();
  const names = new Map<string, string>();
  const listeners = new Set<() => void>();
  let seq = 0;
  let snapshot: SessionSnapshot = { gate: "unknown", lookup: null, requests: 0, cacheHits: 0 };

  function publish(next: Partial<SessionSnapshot>) {
    snapshot = { ...snapshot, ...next };
    for (const listener of listeners) listener();
  }

  /** Set the lookup `mine` stands for, unless a newer one has started since. */
  function settle(mine: number, next: Lookup | null) {
    if (snapshot.lookup?.seq === mine) publish({ lookup: next });
  }

  function replay({ status, body }: Kept): Response {
    return new Response(body, { status, headers: { "content-type": "application/json" } });
  }

  function answer(mine: number, lookup: Lookup, { status, body }: Kept) {
    if (status === 200) {
      let point: NoisePoint | null = null;
      try {
        point = (JSON.parse(body) as { data?: NoisePoint }).data ?? null;
      } catch {
        point = null;
      }
      settle(mine, point ? { ...lookup, status: "ready", point } : { ...lookup, status: "failed" });
    } else if (status === 422) settle(mine, { ...lookup, status: "outside" });
    else settle(mine, { ...lookup, status: "failed" });
  }

  async function noisePoint(url: URL, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const lat = url.searchParams.get("lat") ?? "";
    const lng = url.searchParams.get("lng") ?? "";
    const mine = ++seq;
    const lookup: Lookup = { seq: mine, at: [Number(lng), Number(lat)], name: names.get(coordKey(lat, lng)) ?? null, status: "pending", point: null };
    publish({ lookup });

    const hit = kept.get(url.href);
    if (hit) {
      publish({ cacheHits: snapshot.cacheHits + 1 });
      answer(mine, lookup, hit);
      return replay(hit);
    }

    publish({ requests: snapshot.requests + 1 });
    let response: Response;
    try {
      response = await base(input, init);
    } catch (caught) {
      // Cancelled by the block: a newer spot or Clear owns the card now.
      settle(mine, isAbort(caught) ? null : { ...lookup, status: "failed" });
      throw caught;
    }
    if (response.status === 403) publish({ gate: "refused" });
    let body: string;
    try {
      body = await response.clone().text();
    } catch {
      settle(mine, null);
      return response;
    }
    const answered = { status: response.status, body };
    // Only a definite answer is kept: a refusal, a rate limit or an outage may differ next time.
    if (response.status === 200 || response.status === 422) kept.set(url.href, answered);
    answer(mine, lookup, answered);
    return response;
  }

  async function autocomplete(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const response = await base(input, init);
    if (response.ok) {
      response
        .clone()
        .json()
        .then((body: unknown) => {
          const results = Array.isArray(body) ? body : ((body as { results?: unknown } | null)?.results ?? []);
          if (!Array.isArray(results)) return;
          for (const result of results as Array<{ name?: unknown; lat?: unknown; lng?: unknown }>) {
            if (typeof result.name !== "string" || typeof result.lat !== "number" || typeof result.lng !== "number") continue;
            const key = coordKey(String(result.lat), String(result.lng));
            names.delete(key);
            names.set(key, result.name);
            if (names.size > MAX_NAMES) names.delete(names.keys().next().value as string);
          }
        })
        .catch(() => {
          // A suggestion list that did not parse just leaves the place unnamed.
        });
    }
    return response;
  }

  async function probe(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const response = await base(input, init);
    publish({ gate: response.ok ? "granted" : response.status === 403 ? "refused" : "unknown" });
    return response;
  }

  const wrapped: typeof fetch = (input, init) => {
    const url = urlOf(input);
    if (!url || url.origin !== origin || methodOf(input, init) !== "GET") return base(input, init);
    if (url.pathname === "/noise/point") return noisePoint(url, input, init);
    if (url.pathname === "/geocode/autocomplete") return autocomplete(input, init);
    if (url.pathname === PROBE_PATH) return probe(input, init);
    return base(input, init);
  };

  return {
    fetch: wrapped,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
  };
}

const INSTALLED = Symbol.for("quiet-streets.noise-session");

/**
 * Put the session in front of the page's `fetch`, once. It has to run before the block builds its
 * SDK client, which binds `fetch` when it is constructed: client-entry.tsx calls it at import.
 */
export function installNoiseSession(gateway: string, target: typeof globalThis = globalThis): NoiseSession {
  const holder = target as typeof globalThis & { [INSTALLED]?: NoiseSession };
  const existing = holder[INSTALLED];
  if (existing) return existing;
  const session = createNoiseSession({ gateway, fetch: target.fetch.bind(target) });
  target.fetch = session.fetch;
  holder[INSTALLED] = session;
  return session;
}
