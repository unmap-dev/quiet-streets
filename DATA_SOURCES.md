# Data sources

Everything on screen is a live Unmap response. The app ships no data file and no sample data: the
six cities, their bounding boxes and grid sizes in `lib/cities.ts` are the Urban Noise release's
own coverage, as the docs list it.

| What | Where it comes from | Licence | Credit shown |
| --- | --- | --- | --- |
| Noise levels per 25 m hexagon: Lden, Lnight, the WHO-anchored score and label, above or within the WHO guideline, the main source and each source's level | Unmap's Urban Noise add-on (`/noise/point`, and the `urban-noise` overlay on the map), release `2026-11-10.28f32d82e125`. Computed from OpenStreetMap roads, rail, barriers and points of interest with the PickYourPlace noise model (road noise by CRTN 1988; rail from OpenStreetMap track and Transport Canada train counts; aircraft from noise exposure forecast contours, published in Calgary and Edmonton and modelled from OpenStreetMap runways in the other four cities; see the docs' [how the levels are modelled](https://unmap.dev/docs/urban-noise#how-the-levels-are-modelled)) | Open Database Licence (ODbL) 1.0: the computed levels are part of the same ODbL database | "© OpenStreetMap contributors (ODbL), noise model: PickYourPlace" on the card at all times, and in the comparison |
| Inputs to the model that are not OpenStreetMap | City of Calgary open data (traffic volumes, 3D buildings with lidar heights, rail tracks, noise exposure forecast contours, business licences); Natural Resources Canada building footprints; Transport Canada railway grade crossings and train counts; Government of Alberta highway volumes and heavy-vehicle shares; the business licences of Edmonton, Vancouver and Toronto; Edmonton's noise exposure forecast contours from Schedule 2 of Alta Reg 55/2006 (© Alberta King's Printer); Copernicus DEM GLO-30 for road gradients | Each under its own licence, listed in full in the docs' [attribution and licence](https://unmap.dev/docs/urban-noise#attribution-and-licence) section | the docs; the Built with Unmap panel links them |
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
- **Calibration varies by city.** Calgary uses its own traffic counts and lidar building heights.
  The other five use road-class traffic defaults and a 6 m default building height, so screening
  behind tall buildings is under-stated there.
- **Per hexagon, not per address.** A level is for the 25 m hexagon a point falls in.
- **Six cities only.** Elsewhere the app says the place is not covered.
- **No neighbourhood averages.** Places are compared one hexagon at a time.

Gaps are shown as gaps: a missing level says so, and the app never fills one in.
