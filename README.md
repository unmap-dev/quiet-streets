# Quiet Streets, built with Unmap

How loud a street is, by day and at night, in Calgary, Edmonton, Vancouver, Toronto, Montréal and
Québec City. Pick a city, then click the map or search an address: the card gives the spot's day
level (Lden) and night level (Lnight) against the WHO guideline, its score, its main source and a
bar per source. Pin up to three places and compare them side by side. One of the
[Unmap apps](https://unmap.dev/apps); live at
[apps.unmap.dev/quiet-streets](https://apps.unmap.dev/quiet-streets/).

The levels are **real Unmap answers from a noise model**, not sample data: Unmap's Urban Noise
add-on, computed from OpenStreetMap roads, rail, barriers and places under the Open Database
Licence (ODbL), with the noise model by PickYourPlace (see [`DATA_SOURCES.md`](DATA_SOURCES.md)).
The app has no data of its own and invents none.

> **Modelled, not measured.** These are screening estimates, not sound-meter readings, and not
> for compliance or legal use. The app says so above the map at all times and links the docs'
> [coverage and limits](https://unmap.dev/docs/urban-noise#coverage-and-limits).

## The key it needs

A browser key **with the Urban Noise add-on**. The overlay and every lookup need it: a key without
it gets `403 addon_required` (`addon: "addon-urban-noise"`), and the app shows the basemap, says
what the key is missing and links [pricing](https://unmap.dev/pricing). On the dev plan the add-on
works from `localhost` only.

## Run it

You need Node 24 (22.18+ works), pnpm and an Unmap browser key from
[unmap.dev/dashboard](https://unmap.dev/dashboard).

```bash
cp .env.example .env.local      # then set NEXT_PUBLIC_UNMAP_KEY
pnpm install
pnpm dev                        # http://localhost:3204
```

Without a key the app says what it needs and calls nothing.

| Command | |
| --- | --- |
| `pnpm dev` | development server on port 3204 |
| `pnpm build` | static export in `out/` |
| `pnpm test` | unit and component tests (Vitest) |
| `pnpm lint` / `pnpm typecheck` | |
| `pnpm run deploy` | build, then `wrangler deploy` to your Cloudflare account (edit `wrangler.jsonc` first) |

The key ships in the browser bundle. Restrict it to your origins (`http://localhost:3204` and your
domain) in the dashboard. Any static host works: `out/` is plain files.

## What it asks Unmap, and when

| When | Call | Requests |
| --- | --- | --- |
| You open a city | the block's add-on check, `GET /layers/urban-noise/22/0/0` | 1 |
| The same | the map's style (`overlays=urban-noise`, only once the check passes) and its tiles | as the map loads them |
| You click a spot or choose a search result | `noise.point({ lat, lng })`, `GET /noise/point` | 1 per place, kept for the session |
| You type an address | the registry `geocoder`'s autocomplete, `GET /geocode/autocomplete` | 1 per pause in typing |
| You switch Day and Night, pin a place, or compare | nothing: both levels are in the tiles, and pins reuse the lookup's answer | 0 |

A spot asked for again (the same search result, or the same place pinned twice) is answered from
the session, not the network. A place outside the six cities is a `422 outside_coverage`, also
kept: the app says it is not covered, lists the cities, and never shows a number for it. A hexagon
with no modelled source has a null `lden`: the app says "no modelled source", never 0 dB and never
quiet.

## Shareable links

| Query | |
| --- | --- |
| `?city=montreal` | opens the map on that city instead of the picker (`calgary`, `edmonton`, `vancouver`, `toronto`, `montreal`, `quebec-city`) |
| `?period=night` | colours the map by the night level, Lnight |
| `?lang=fr` | French |

Pins are not in the link: each one is a lookup, and opening a link should cost nothing.

## How it is built

```
app/page.tsx                      the one page; renders the app in the browser
components/quiet/                 the app: city picker, notice, header city switch, compare tray, comparison, pin markers
components/ui/  lib/map-*         Unmap registry items and shadcn primitives, copied in unmodified
lib/kit/                          the Unmap app kit (header, Built with Unmap panel, errors, en/fr), copied in
hooks/                            the session, the URL state, what the app reads off the block's map
lib/session.ts                    the session cache under the block's /noise/point calls (no React)
lib/pins.ts                       pinning and comparing (no React, no fetch)
lib/cities.ts  lib/url.ts         the six cities, the shareable link
lib/manifest.ts  lib/text.ts      what the Built with Unmap panel lists; this app's words in English and French
```

The whole map, the card, the legend, the Day / Night switch and the search are the
`urban-noise-map` block, unchanged. The app composes around it:

- An outer `MapProvider` with no map of its own lets the header's city switch, the pin markers
  (the registry `Marker`) and the tray reach the map the block registers as `urban-noise-map`.
- The block owns its `/noise/point` call and exposes no callback with the answer, so
  `lib/session.ts` puts a `fetch` in front of the page's own and, for the block's three gateway
  paths only, keeps what goes past: the noise answers (cached for the session), the search
  suggestions' names, and the add-on check. Pinning reads the answer the block already has, so a
  pinned place costs no second call. Every other request goes straight through.

Layers run one way: components → hooks → `lib/` (plain TypeScript, unit-tested) → `@unmap/sdk`.
In the Unmap monorepo the copied files are kept in step by `pnpm sync` and `test/sync.test.ts`; in
your own copy they are ordinary source you can edit.

To use the block in an app you already have:

```bash
npx shadcn@latest registry add @unmap=https://registry.unmap.dev/r/{name}.json
npx shadcn@latest add @unmap/urban-noise-map
```

Guide: [unmap.dev/docs/urban-noise](https://unmap.dev/docs/urban-noise).

## Licence

The code is MIT. The noise data is © OpenStreetMap contributors under the ODbL, with the noise
model by PickYourPlace: keep the credit the card shows, and see [`DATA_SOURCES.md`](DATA_SOURCES.md)
for what that asks of you.
