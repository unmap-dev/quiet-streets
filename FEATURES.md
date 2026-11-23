# Features

What Quiet Streets does, which Unmap API does it, and what it deliberately does not do.

## Implemented

| Feature | How | Unmap |
| --- | --- | --- |
| National noise map | opens straight on the registry `urban-noise-map` block, framed on all 41 census metropolitan areas and fitted to the screen (phone or desktop, clear of the block's card): the `muted` basemap with the `urban-noise` overlay once the key holds the add-on, and a legend with the WHO guideline drawn between its classes | Maps API (`/styles/muted.json?overlays=urban-noise`, `/tiles`, `/layers/urban-noise/{z}/{x}/{y}`) |
| Day / Night | the block's switch recolours the map from Lden to Lnight; kept in the link | none (both levels are in the tiles) |
| A spot or an address | a click, or a search result, gives the card: day and night levels against the WHO guideline (53 dB Lden, 45 dB Lnight), above or within, the score and its label, the main source, a bar per source, and a line on the model's inputs there (counted traffic and measured building heights, counted traffic, trains or aircraft contours, or traffic estimated from road class) | Urban Noise (`GET /noise/point`), Geocoding (`GET /geocode/autocomplete`) |
| Session cache | the same `/noise/point` request is answered once per session; pins and the comparison reuse it | none |
| Pin and compare | pin up to three places, numbered on the map and in the tray; the comparison draws every day and night level on one 30 to 80 dB scale with the WHO line across all of them, marks the quietest, and tabulates score, main source and metropolitan area | none (the answers are already on the page) |
| Header area switch | jumps to any of the 41 metropolitan areas, sorted by name in the page's language, and follows the camera when you pan to another; at the national view it reads "Jump to an area" | none |
| Modelled notice | "Modelled, not measured", above the map at all times, linked to the docs' coverage and limits | none |
| Credits | "© OpenStreetMap contributors (ODbL), noise model: PickYourPlace" on the card at all times and in the comparison | none |
| Outside coverage | says Urban Noise covers Canada's 41 census metropolitan areas and the place is outside them, and offers the three nearest covered areas to jump to; never a number | Urban Noise (`422 outside_coverage`) |
| No modelled source | says so; never 0 dB, never quiet, never the quietest | Urban Noise (null `lden`) |
| Add-on gate | a key without Urban Noise keeps the basemap, says what is missing and links pricing; dev-plan origin and allowance limits are told apart; the compare tray is not shown | Urban Noise (`403 addon_required`, `dev_only`, `usage_limit_reached`) |
| No-key state | says a key with the Urban Noise add-on is needed, links pricing; calls nothing | none |
| Shareable link | `?city=` (any of the 41 areas; none for the national view), `?period=night` and `?lang=fr` | none |
| English and French | the header switch; map labels, area names and numbers follow | Maps `lang` |
| Built with Unmap | the services, calls, components and data sources behind the page | none |
| No tracking | no analytics, no cookies, nothing stored | none |

## Not yet

- Pins in the link, which would cost a lookup per pin to open.
- Naming a dropped pin by reverse geocoding, which would cost a call per click.

## Not goals

Measured levels, compliance or legal assessments, per-address values, neighbourhood or community
averages and rankings, and places outside the 41 census metropolitan areas the release covers.
