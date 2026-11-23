# Data sources

Everything on screen is a live Unmap response. The app ships no data file and no sample data: the
41 census metropolitan areas, their names and bounding boxes in `lib/cities.ts` are the Urban
Noise release's own coverage, from its national manifest. The province beside each is added so a
reader can tell the areas apart.

| What | Where it comes from | Licence | Credit shown |
| --- | --- | --- | --- |
| Noise levels per 25 m hexagon: Lden, Lnight, the WHO-anchored score and label, above or within the WHO guideline, the main source, each source's level and the input tier | Unmap's Urban Noise add-on (`/noise/point`, and the `urban-noise` overlay on the map), from PickYourPlace's national release (v2.1, Canada's 41 census metropolitan areas). Computed from OpenStreetMap roads, rail, barriers and points of interest with the PickYourPlace noise model; see the docs' [how the levels are modelled](https://unmap.dev/docs/urban-noise#how-the-levels-are-modelled) | Open Database Licence (ODbL) 1.0: the computed levels are part of the same ODbL database | "© OpenStreetMap contributors (ODbL), noise model: PickYourPlace" on the card at all times, and in the comparison |
| Inputs to the model that are not OpenStreetMap | Statistics Canada 2021 census boundary files and Geographic Attribute File, table 23-10-0296-01 (itinerant aircraft movements) and the National Address Register (Statistics Canada Open Licence); Natural Resources Canada Automatically Extracted Buildings and Transport Canada's Grade Crossings Inventory (Open Government Licence - Canada); Microsoft Canadian Building Footprints (ODbL 1.0); City of Calgary 3D buildings, traffic volumes and hourly counts, noise exposure forecast contours and rail tracks (Open Government Licence - City of Calgary); Alberta Transportation traffic volumes (Open Government Licence - Alberta); Edmonton International Airport's noise exposure forecast contours from Schedule 2 of Alta Reg 55/2006 (© Alberta King's Printer); Copernicus GLO-30 DEM for road gradients (© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA) | Each under its own licence, listed in full in the docs' [attribution and licence](https://unmap.dev/docs/urban-noise#attribution-and-licence) section | the docs; the Built with Unmap panel links them |
| The search box's suggestions | Unmap's geocoder (`/geocode/autocomplete`) | as the basemap | MapLibre's attribution control on the map |
| Basemap | Unmap's `muted` style and vector tiles | © unmap © OpenStreetMap contributors | MapLibre's attribution control on the map |

## What the ODbL asks of you

The noise data is a derived database of OpenStreetMap. If you show it, keep "© OpenStreetMap
contributors" visible where it is seen (the block does). If you publish a database derived from
it, it has to be under the ODbL too. Anyone can have the derived noise database itself under the
ODbL: write to hello@unmap.dev for a copy of the release you are using.

## What is not here

- **No measurements.** Nothing has calibrated the model against measured levels; against Toronto
  Public Health's measurements it reads 3 to 6 dB low by road type. It is screening data, not a
  compliance, legal or regulatory assessment.
- **Traffic is mostly a default.** Only a few hundred Calgary hexagons have counted traffic and
  measured building heights (input tier 1). About 93 % of the modelled hexagons, Calgary's
  included, have traffic defaulted by road class (tier 3), and about 7 % have a counted highway or
  train or open aircraft contours (tier 2), so most road levels read low. The card says which tier
  answered.
- **Aircraft noise is thin outside Calgary and Edmonton.** Those two use published contours. 26
  areas use synthetic airport contours, which are a low estimate. Saguenay, Sherbrooke,
  Belleville-Quinte West and Greater Sudbury have an airport but no aircraft noise in the model,
  and 9 areas have no airport.
- **About half the grid has a level.** 48.2 % of the 25 m hexagons have a modelled source; the
  rest say "no modelled source", never a number.
- **Per hexagon, not per address.** A level is for the 25 m hexagon a point falls in.
- **The 41 census metropolitan areas only.** Elsewhere the app says the place is not covered and
  offers the nearest covered areas.
- **No neighbourhood averages.** Places are compared one hexagon at a time.

Gaps are shown as gaps: a missing level says so, and the app never fills one in.
