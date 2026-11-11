import type { AppManifest } from "@/lib/kit/provenance";

/**
 * What the "Built with Unmap" panel and the header say about Quiet Streets. Lists only what the
 * app really calls; a service is added here in the same change that starts calling it.
 */
export const MANIFEST: AppManifest = {
  slug: "quiet-streets",
  name: { en: "Quiet Streets", fr: "Rues tranquilles" },
  tagline: {
    en: "How loud a street is, day and night, in six Canadian cities, and up to three places side by side.",
    fr: "Le niveau de bruit d'une rue, le jour et la nuit, dans six villes canadiennes, et jusqu'à trois lieux côte à côte.",
  },
  services: [
    {
      name: "Maps",
      role: {
        en: "The muted basemap, with the urban-noise overlay of 25 m hexagons once the key holds the Urban Noise add-on, coloured by the day or the night level, labels in the page's language.",
        fr: "Le fond de carte sobre, avec la superposition de bruit urbain en hexagones de 25 m quand la clé a le module complémentaire Bruit urbain, colorée selon le niveau de jour ou de nuit, étiquettes dans la langue de la page.",
      },
      calls: ['<Map apiKey={key} style="muted" overlays={["urban-noise"]} lang={lang} />'],
      docs: "https://unmap.dev/docs/urban-noise#the-noise-overlay",
    },
    {
      name: "Urban noise",
      role: {
        en: "The card for a spot you click or an address you search: day and night levels against the WHO guideline, the score, the main source and a bar per source. One call per place, kept for the session; pinning and comparing reuse it.",
        fr: "La fiche d'un point cliqué ou d'une adresse cherchée : niveaux de jour et de nuit par rapport à la ligne directrice de l'OMS, score, source principale et une barre par source. Un appel par lieu, gardé pour la session ; épingler et comparer le réutilisent.",
      },
      calls: ["new Noise({ key }).point({ lat, lng })  // GET /noise/point"],
      docs: "https://unmap.dev/docs/urban-noise#point-lookup",
    },
    {
      name: "Geocoding",
      role: {
        en: "The address search on the card, biased to the map's centre.",
        fr: "La recherche d'adresse de la fiche, orientée vers le centre de la carte.",
      },
      calls: ['<Geocoder apiKey={key} proximity="map" />  // GET /geocode/autocomplete'],
      docs: "https://unmap.dev/docs/apis/geocoding",
    },
  ],
  items: ["urban-noise-map", "map", "geocoder", "marker-popup"],
  provenance: [
    {
      kind: "live",
      label: {
        en: "Modelled road, rail, aircraft and commercial noise levels, computed from OpenStreetMap",
        fr: "Niveaux de bruit routier, ferroviaire, aérien et commercial modélisés, calculés à partir d'OpenStreetMap",
      },
      source: "Unmap Urban Noise add-on, noise model by PickYourPlace",
      licence: "Open Database Licence (ODbL) 1.0",
      attribution: "© OpenStreetMap contributors; noise model: PickYourPlace. Modelled, not measured: a screening estimate, not a compliance assessment.",
      url: "https://unmap.dev/docs/urban-noise#attribution-and-licence",
    },
    {
      kind: "live",
      label: { en: "Basemap and address search", fr: "Carte de base et recherche d'adresse" },
      source: "Unmap",
      attribution: "© unmap © OpenStreetMap contributors",
    },
  ],
  source: "https://github.com/unmap-dev/quiet-streets",
};
