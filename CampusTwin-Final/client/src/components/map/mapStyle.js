// Shared map constants. Colours are by category; heights are never invented here.
export const CATEGORY_COLOR = {
  academic: "#1d4ed8", hostel: "#0d9488", food: "#d97706", sports: "#9333ea", transport_parking: "#475569",
  amenity: "#db2777", library: "#1d4ed8", healthcare: "#e11d48", shop: "#a16207", toilet: "#0891b2",
  accessibility: "#16a34a", other: "#64748b",
};
export const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const colorOfFacility = (f) => (f.layer === "accessibility" ? CATEGORY_COLOR.accessibility : CATEGORY_COLOR[f.category] || CATEGORY_COLOR.other);
export const colorOfBuilding = (p) => CATEGORY_COLOR[p.category] || CATEGORY_COLOR.other;

// Raster OpenStreetMap basemap. glyphs are only needed for the 2D building labels.
export const BASE_STYLE = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19, attribution: "&copy; OpenStreetMap contributors" } },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

// Extrusion rule: use the stored height when there is one. Unknown height = flat footprint (no extrusion).
export function extrusionOf(props) {
  const h = Number(props.heightM);
  if (!props.heightSource || props.heightSource === "unknown" || !Number.isFinite(h) || h <= 0) return { height: 0, label: "no height data (not extruded)" };
  return { height: h, label: props.heightSource === "estimated_from_floors" ? `${h} m (estimated from floor count, not measured)` : `${h} m (${props.heightSource === "osm" ? "from OpenStreetMap" : props.heightSource})` };
}

export function haversineM(a, b) {
  const R = 6371000, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]), dLng = rad(b[0] - a[0]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
// Accessibility facilities (ramps, accessible toilets...) within `radiusM` of a point, nearest first.
export function nearbyAccessibility(facilities, point, radiusM = 100) {
  if (!point) return [];
  return facilities.filter((f) => f.layer === "accessibility" && f.coordinates)
    .map((f) => ({ f, d: Math.round(haversineM(point, f.coordinates)) })).filter((x) => x.d <= radiusM).sort((a, b) => a.d - b.d);
}
