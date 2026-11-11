# Features

What Quiet Streets does, which Unmap API does it, and what it deliberately does not do.

## Implemented

| Feature | How | Unmap |
| --- | --- | --- |
| City picker | the six covered cities, each with its province, its grid of 25 m hexagons and whether its traffic is counted (Calgary) or assumed; picking one opens the map there | none (makes no call) |
| Noise map | registry `urban-noise-map` block: the `muted` basemap with the `urban-noise` overlay once the key holds the add-on, and a legend with the WHO guideline drawn between its classes | Maps API (`/styles/muted.json?overlays=urban-noise`, `/tiles`, `/layers/urban-noise/{z}/{x}/{y}`) |
| Day / Night | the block's switch recolours the map from Lden to Lnight; kept in the link | none (both levels are in the tiles) |
| A spot or an address | a click, or a search result, gives the card: day and night levels against the WHO guideline (53 dB Lden, 45 dB Lnight), above or within, the score and its label, the main source and a bar per source | Urban Noise (`GET /noise/point`), Geocoding (`GET /geocode/autocomplete`) |
| Session cache | the same `/noise/point` request is answered once per session; pins and the comparison reuse it | none |
| Pin and compare | pin up to three places, numbered on the map and in the tray; the comparison draws every day and night level on one 30 to 80 dB scale with the WHO line across all of them, marks the quietest, and tabulates score, main source and city | none (the answers are already on the page) |
| Header city switch | flies to a city, and follows the camera when you pan to another | none |
| Modelled notice | "Modelled, not measured", above the map at all times, linked to the docs' coverage and limits | none |
| Credits | "© OpenStreetMap contributors (ODbL), noise model: PickYourPlace" on the card at all times and in the comparison | none |
| Outside coverage | says the place is not covered and lists the six cities; never a number | Urban Noise (`422 outside_coverage`) |
| No modelled source | says so; never 0 dB, never quiet, never the quietest | Urban Noise (null `lden`) |
| Add-on gate | a key without Urban Noise keeps the basemap, says what is missing and links pricing; dev-plan origin and allowance limits are told apart; the compare tray is not shown | Urban Noise (`403 addon_required`, `dev_only`, `usage_limit_reached`) |
| No-key state | says a key with the Urban Noise add-on is needed, links pricing; calls nothing | none |
| Shareable link | `?city=`, `?period=night` and `?lang=fr` | none |
| English and French | the header switch; map labels, city names and numbers follow | Maps `lang` |
| Built with Unmap | the services, calls, components and data sources behind the page | none |
| No tracking | no analytics, no cookies, nothing stored | none |

## Not yet

- Pins in the link, which would cost a lookup per pin to open.
- Naming a dropped pin by reverse geocoding, which would cost a call per click.

## Not goals

Measured levels, compliance or legal assessments, per-address values, neighbourhood or community
averages and rankings, and cities outside the six the release covers.
