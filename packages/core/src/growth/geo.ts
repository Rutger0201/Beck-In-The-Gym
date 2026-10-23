// Client-safe geography helpers. Coordinates are town centres (WGS84), used only at "place" precision;
// exact locations come from the source itself (iCal GEO, schema.org geo) or from the PDOK Locatieserver.
export type Point = { lat: number; lon: number };
export type Place = Point & { name: string; region: "flevoland" | "gooi" | "amsterdam" | "veluwe" | "utrecht" | "overijssel" };
export const homeBase: Place = { name: "Almere", lat: 52.3508, lon: 5.2647, region: "flevoland" };
export const places: Place[] = [
  homeBase,
  { name: "Almere Haven", lat: 52.3337, lon: 5.2192, region: "flevoland" }, { name: "Almere Buiten", lat: 52.3861, lon: 5.2771, region: "flevoland" },
  { name: "Almere Poort", lat: 52.3444, lon: 5.1608, region: "flevoland" }, { name: "Almere Hout", lat: 52.3343, lon: 5.2971, region: "flevoland" },
  { name: "Almere Pampus", lat: 52.3693, lon: 5.1803, region: "flevoland" }, { name: "Almere Stad", lat: 52.3708, lon: 5.2216, region: "flevoland" },
  { name: "Lelystad", lat: 52.5185, lon: 5.4714, region: "flevoland" }, { name: "Zeewolde", lat: 52.3303, lon: 5.5414, region: "flevoland" },
  { name: "Dronten", lat: 52.5250, lon: 5.7181, region: "flevoland" }, { name: "Biddinghuizen", lat: 52.4553, lon: 5.6936, region: "flevoland" },
  { name: "Swifterbant", lat: 52.5675, lon: 5.6372, region: "flevoland" }, { name: "Urk", lat: 52.6620, lon: 5.6013, region: "flevoland" },
  { name: "Emmeloord", lat: 52.7105, lon: 5.7480, region: "flevoland" },
  { name: "Huizen", lat: 52.2993, lon: 5.2416, region: "gooi" }, { name: "Blaricum", lat: 52.2722, lon: 5.2417, region: "gooi" }, { name: "Laren", lat: 52.2567, lon: 5.2283, region: "gooi" },
  { name: "Naarden", lat: 52.2953, lon: 5.1622, region: "gooi" }, { name: "Bussum", lat: 52.2733, lon: 5.1611, region: "gooi" }, { name: "Hilversum", lat: 52.2292, lon: 5.1669, region: "gooi" },
  { name: "Weesp", lat: 52.3075, lon: 5.0417, region: "amsterdam" }, { name: "Muiden", lat: 52.3292, lon: 5.0697, region: "amsterdam" }, { name: "Diemen", lat: 52.3392, lon: 4.9625, region: "amsterdam" },
  { name: "Amsterdam", lat: 52.3728, lon: 4.8936, region: "amsterdam" },
  { name: "Harderwijk", lat: 52.3421, lon: 5.6331, region: "veluwe" }, { name: "Nijkerk", lat: 52.2200, lon: 5.4861, region: "veluwe" }, { name: "Ermelo", lat: 52.2989, lon: 5.6219, region: "veluwe" },
  { name: "Amersfoort", lat: 52.1561, lon: 5.3878, region: "utrecht" }, { name: "Utrecht", lat: 52.0907, lon: 5.1214, region: "utrecht" },
  { name: "Kampen", lat: 52.5550, lon: 5.9114, region: "overijssel" }, { name: "Zwolle", lat: 52.5168, lon: 6.0830, region: "overijssel" }
];
export const regionLabels: Record<Place["region"], string> = { flevoland: "Flevoland", gooi: "Gooi", amsterdam: "Amsterdam e.o.", veluwe: "Veluwe", utrecht: "Utrecht e.o.", overijssel: "Overijssel" };

export function distanceKm(a: Point, b: Point): number {
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Longest name first, so "Almere Haven" wins over "Almere".
const byLength = [...places].sort((a, b) => b.name.length - a.name.length);
export function detectPlace(text: string): Place | undefined {
  return byLength.find(place => new RegExp(`(^|[^\\p{L}])${escape(place.name)}([^\\p{L}]|$)`, "iu").test(text));
}
export function isInNetherlands(point: Point): boolean { return point.lat > 50.7 && point.lat < 53.7 && point.lon > 3.2 && point.lon < 7.3; }
// 5 = within 10 km of Almere, 1 = beyond the configured maximum. Unknown location stays neutral-low.
export function geographyFactor(distance: number | null, maxDistanceKm: number): number {
  if (distance === null) return 2;
  if (distance <= 10) return 5;
  if (distance <= maxDistanceKm * 0.5) return 4;
  if (distance <= maxDistanceKm) return 3;
  return distance <= maxDistanceKm * 2 ? 2 : 1;
}

// Web Mercator tile maths for the opportunity map (EPSG:3857, 256 px tiles).
export function project(point: Point, zoom: number): { x: number; y: number } {
  const scale = 256 * 2 ** zoom, sin = Math.sin((point.lat * Math.PI) / 180);
  return { x: ((point.lon + 180) / 360) * scale, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale };
}
export function unproject(pixel: { x: number; y: number }, zoom: number): Point {
  const scale = 256 * 2 ** zoom, n = Math.PI - (2 * Math.PI * pixel.y) / scale;
  return { lat: (180 / Math.PI) * Math.atan(Math.sinh(n)), lon: (pixel.x / scale) * 360 - 180 };
}
