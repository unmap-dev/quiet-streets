import type { Text } from "@/lib/kit/i18n";

/**
 * The 41 census metropolitan areas Urban Noise covers, St. John's to Nanaimo, as the header's
 * switch lists them and `?city=` names them. Plain data, so the domain layer imports nothing from
 * the registry UI; test/cities.test.ts holds the names identical to the block's own
 * `NOISE_AREA_NAMES`. The slugs, names and bounding boxes are the national release manifest's;
 * the province is added so a reader can tell Kingston from London.
 *
 * No noise level is summarised per area: an area average would be interpretation, and the levels
 * are per hexagon.
 */
export interface City {
  slug: string;
  name: Text;
  /** [west, south, east, north]. */
  bbox: [number, number, number, number];
  province: Text;
}

const AB: Text = { en: "Alberta", fr: "Alberta" };
const BC: Text = { en: "British Columbia", fr: "Colombie-Britannique" };
const MB: Text = { en: "Manitoba", fr: "Manitoba" };
const NB: Text = { en: "New Brunswick", fr: "Nouveau-Brunswick" };
const NL: Text = { en: "Newfoundland and Labrador", fr: "Terre-Neuve-et-Labrador" };
const NS: Text = { en: "Nova Scotia", fr: "Nouvelle-Écosse" };
const ON: Text = { en: "Ontario", fr: "Ontario" };
const QC: Text = { en: "Quebec", fr: "Québec" };
const SK: Text = { en: "Saskatchewan", fr: "Saskatchewan" };
const ON_QC: Text = { en: "Ontario and Quebec", fr: "Ontario et Québec" };

/** One area: French name the same as the English one unless given. */
function area(slug: string, en: string, bbox: City["bbox"], province: Text, fr = en): City {
  return { slug, name: { en, fr }, bbox, province };
}

export const CITIES: readonly City[] = [
  area("st-johns", "St. John's", [-53.245914, 47.244098, -52.619366, 47.809927], NL),
  area("halifax", "Halifax", [-64.2372, 43.925137, -59.670724, 45.336321], NS),
  area("moncton", "Moncton", [-65.223834, 45.649235, -64.481432, 46.431661], NB),
  area("saint-john", "Saint John", [-66.593037, 45.057152, -65.082482, 45.692173], NB),
  area("fredericton", "Fredericton", [-67.295775, 45.501371, -65.976963, 46.656057], NB),
  area("saguenay", "Saguenay", [-71.577174, 47.999883, -70.430626, 48.780638], QC),
  area("quebec-city", "Québec City", [-71.814619, 46.528725, -70.711078, 47.307313], QC, "Québec"),
  area("sherbrooke", "Sherbrooke", [-72.253301, 45.159205, -71.626194, 45.650306], QC),
  area("trois-rivieres", "Trois-Rivières", [-72.921609, 46.193611, -72.160276, 46.535625], QC),
  area("drummondville", "Drummondville", [-72.753573, 45.65876, -72.186634, 46.058798], QC),
  area("montreal", "Montréal", [-74.327969, 45.217804, -73.128561, 45.96849], QC),
  area("ottawa-gatineau", "Ottawa–Gatineau", [-76.642778, 44.845648, -75.07954, 45.994787], ON_QC),
  area("kingston", "Kingston", [-76.90447, 44.095114, -76.165116, 44.740695], ON),
  area("belleville-quinte-west", "Belleville–Quinte West", [-77.754492, 44.017798, -77.044725, 44.479139], ON),
  area("peterborough", "Peterborough", [-78.584227, 44.081278, -77.926017, 44.583152], ON),
  area("oshawa", "Oshawa", [-79.047311, 43.833504, -78.436956, 44.098758], ON),
  area("toronto", "Toronto", [-80.171741, 43.371729, -78.970507, 44.459784], ON),
  area("hamilton", "Hamilton", [-80.248486, 43.050516, -79.511992, 43.476542], ON),
  area("st-catharines-niagara", "St. Catharines–Niagara", [-79.583817, 42.835574, -78.90813, 43.262118], ON),
  area("kitchener-cambridge-waterloo", "Kitchener–Cambridge–Waterloo", [-80.796366, 43.266802, -80.187603, 43.689596], ON),
  area("brantford", "Brantford", [-80.608745, 42.984863, -79.984323, 43.306534], ON),
  area("guelph", "Guelph", [-80.409749, 43.387191, -80.034339, 43.725302], ON),
  area("london", "London", [-81.795655, 42.648198, -80.898694, 43.231462], ON),
  area("windsor", "Windsor", [-83.133841, 41.909384, -82.429919, 42.349047], ON),
  area("barrie", "Barrie", [-79.984429, 44.164743, -79.505362, 44.648445], ON),
  area("greater-sudbury", "Greater Sudbury", [-81.597481, 46.195306, -80.290649, 46.973681], ON, "Grand Sudbury"),
  area("thunder-bay", "Thunder Bay", [-89.767906, 47.996343, -88.512277, 48.738558], ON),
  area("winnipeg", "Winnipeg", [-97.95036, 49.531128, -96.352955, 50.547882], MB),
  area("regina", "Regina", [-105.306055, 50.047078, -104.052705, 50.819266], SK),
  area("saskatoon", "Saskatoon", [-107.29954, 51.707015, -105.68766, 52.580216], SK),
  area("lethbridge", "Lethbridge", [-113.276809, 49.523212, -112.217764, 50.13606], AB),
  area("calgary", "Calgary", [-114.728161, 50.793983, -113.376705, 51.489715], AB),
  area("red-deer", "Red Deer", [-113.897393, 52.215708, -113.718724, 52.342857], AB),
  area("edmonton", "Edmonton", [-115.117973, 53.045137, -112.840684, 54.022999], AB),
  area("kelowna", "Kelowna", [-120.056808, 49.675275, -118.797557, 50.235325], BC),
  area("kamloops", "Kamloops", [-121.29694, 50.385504, -119.609961, 51.250702], BC),
  area("chilliwack", "Chilliwack", [-122.124791, 49.0, -121.268693, 49.362895], BC),
  area("abbotsford-mission", "Abbotsford–Mission", [-122.461478, 49.002174, -122.07256, 49.361001], BC),
  area("vancouver", "Vancouver", [-123.431934, 49.001919, -122.40864, 49.574275], BC),
  area("victoria", "Victoria", [-124.055297, 48.296809, -123.22389, 48.699431], BC),
  area("nanaimo", "Nanaimo", [-124.699245, 48.981267, -123.767102, 49.284922], BC),
];

/**
 * The zoom from which the camera is over one area rather than the country: the header switch
 * names an area only from here. Below every area's own framing (Halifax, the widest box, frames at
 * about 6) and above the national view on any screen (about 4 at 2560 px wide).
 */
export const AREA_ZOOM = 5;

/** Every area's box in one: what the app opens on when the link names no area. */
export const COVERAGE_BBOX: [number, number, number, number] = [-124.7, 41.91, -52.62, 54.03];

export function findCity(slug: string | null): City | null {
  return CITIES.find((city) => city.slug === slug) ?? null;
}

/** The areas sorted by name the way the page's language sorts: the header switch's order. */
export function citiesByName(lang: "en" | "fr"): City[] {
  const collator = new Intl.Collator(lang === "fr" ? "fr-CA" : "en-CA");
  return [...CITIES].sort((a, b) => collator.compare(a.name[lang], b.name[lang]));
}

/** The middle of an area's bounding box, [longitude, latitude]. */
export function cityCenter(city: City): [number, number] {
  const [west, south, east, north] = city.bbox;
  return [(west + east) / 2, (south + north) / 2];
}

/**
 * The covered area whose bounding box holds `at`, or null between and beyond them. The boxes
 * overlap (Oshawa and Hamilton sit inside Toronto's, Abbotsford beside Vancouver), so the
 * smallest box that holds the point wins: it is the area the point is most likely in.
 */
export function cityAt(at: [number, number]): City | null {
  const [lng, lat] = at;
  let best: City | null = null;
  let bestArea = Infinity;
  for (const city of CITIES) {
    const [west, south, east, north] = city.bbox;
    if (lng < west || lng > east || lat < south || lat > north) continue;
    const size = (east - west) * (north - south);
    if (size < bestArea) {
      best = city;
      bestArea = size;
    }
  }
  return best;
}

/** Camera padding in pixels. */
export interface ViewPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** The block's `sm` breakpoint: from here its card floats beside the map; below it, a sheet across the bottom. */
const WIDE = 640;
/** The block's floating card: its 24 px inset, its 23rem width, and the gutter kept beside it. */
const CARD_BESIDE = 24 + 368 + 24;
/** The most of the map the phone sheet covers when idle: its title, search, switch and credits. */
const SHEET_COVER = 300;

/** What the block's own panel covers on a map of this size, plus a gutter on the open sides. */
export function panelPadding(width: number, height: number): ViewPadding {
  if (width >= WIDE) return { top: 24, right: 24, bottom: 24, left: CARD_BESIDE };
  return { top: 16, right: 16, bottom: Math.min(Math.round(height * 0.55), SHEET_COVER) + 16, left: 16 };
}

const TILE = 512;
const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const latitudeOf = (y: number) => (360 / Math.PI) * Math.atan(Math.exp(y)) - 90;

/**
 * The opening camera that fits `bbox` into a `width` x `height` map clear of `padding`: the
 * centre and zoom the block takes as its first camera (it has no padding prop, so the centre is
 * moved off the box's middle by half the padding's imbalance). Web Mercator on MapLibre's 512 px
 * tiles, clamped to zoom 0 to 13.
 */
export function fitView(bbox: [number, number, number, number], width: number, height: number, padding: ViewPadding = panelPadding(width, height)): { center: [number, number]; zoom: number } {
  const [west, south, east, north] = bbox;
  const innerW = Math.max(1, width - padding.left - padding.right);
  const innerH = Math.max(1, height - padding.top - padding.bottom);
  const spanX = (east - west) / 360;
  const spanY = (mercatorY(north) - mercatorY(south)) / (2 * Math.PI);
  const zoomX = Math.log2(innerW / TILE / Math.max(spanX, 1e-9));
  const zoomY = Math.log2(innerH / TILE / Math.max(spanY, 1e-9));
  const zoom = Math.min(13, Math.max(0, Math.min(zoomX, zoomY)));
  // The box's middle in world pixels at that zoom, then the camera centre that puts it in the middle of the padded frame.
  const world = TILE * 2 ** zoom;
  const middleX = ((west + east) / 2 + 180) / 360;
  const middleY = (Math.PI - (mercatorY(north) + mercatorY(south)) / 2) / (2 * Math.PI);
  const cx = middleX * world - (padding.left - padding.right) / 2;
  const cy = middleY * world - (padding.top - padding.bottom) / 2;
  const lng = (cx / world) * 360 - 180;
  const lat = latitudeOf(Math.PI - (cy / world) * 2 * Math.PI);
  return { center: [Math.round(lng * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5], zoom: Math.floor(zoom * 100) / 100 };
}
