const EARTH_R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;

const isLngLat = (c) =>
  Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]) &&
  c[0] >= -180 && c[0] <= 180 && c[1] >= -90 && c[1] <= 90;

// distance in metres between two [lng, lat] points
function haversine(a, b) {
  const dLat = rad(b[1] - a[1]), dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

const ringClosed = (r) => r.length >= 4 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1];

// Returns null when valid, otherwise a message.
function validateGeometry(g, allowed = ["Point", "Polygon", "MultiPolygon", "LineString"]) {
  if (!g || typeof g !== "object" || !allowed.includes(g.type)) return `geometry type must be one of ${allowed.join(", ")}`;
  const c = g.coordinates;
  if (g.type === "Point") return isLngLat(c) ? null : "invalid Point coordinates (expected [lng, lat])";
  if (g.type === "LineString")
    return Array.isArray(c) && c.length >= 2 && c.every(isLngLat) ? null : "LineString needs 2+ valid [lng, lat] positions";
  const polys = g.type === "Polygon" ? [c] : c;
  if (!Array.isArray(polys) || !polys.length) return "empty polygon coordinates";
  for (const poly of polys)
    for (const ring of poly || []) {
      if (!Array.isArray(ring) || !ring.every(isLngLat)) return "polygon ring has invalid coordinates";
      if (!ringClosed(ring)) return "polygon ring is not closed";
    }
  return null;
}

// Area-weighted centroid of the largest polygon's outer ring -> [lng, lat].
// Good enough for a map marker over building-sized shapes (not a survey result).
function representativePoint(g) {
  if (!g) return null;
  if (g.type === "Point") return g.coordinates;
  if (g.type === "LineString") return g.coordinates[Math.floor(g.coordinates.length / 2)];
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  let best = null, bestArea = -1;
  for (const poly of polys) {
    const ring = poly[0];
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i], [x2, y2] = ring[i + 1];
      const f = x1 * y2 - x2 * y1;
      a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f;
    }
    const area = Math.abs(a / 2);
    if (area > bestArea) {
      bestArea = area;
      best = area === 0 ? ring[0] : [cx / (3 * a), cy / (3 * a)];
    }
  }
  return best;
}

module.exports = { haversine, isLngLat, validateGeometry, representativePoint };
