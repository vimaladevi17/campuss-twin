// GeoJSON from the Python pipeline (gis/) -> Building, Facility, CampusPath, WalkingDistance.
//   parse(dir)  pure: reads and validates files, returns records + problems. Touches no database.
//   commit(records, {overwrite, models})  idempotent: stable keys (OSM ids) mean reruns update, never duplicate.
//     Admin-edited fields and verified_college records are protected unless overwrite = true.
//     Nothing is ever deleted.
const fs = require("fs");
const path = require("path");
const { validateGeometry } = require("../../utils/geo");

const read = (dir, name) => {
  const f = path.join(dir, name);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
};
const num = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? undefined : Number(v));
const codeFor = (osmId) => `OSM-${String(osmId).replace(/[^A-Za-z0-9]+/g, "-")}`.toUpperCase();
const HEIGHT_SOURCES = ["osm", "estimated_from_floors", "unknown"];

function parse(dir) {
  const problems = [], warnings = [];
  const manifest = read(dir, "gis_import_manifest.json");
  if (!manifest) problems.push({ file: "gis_import_manifest.json", message: "manifest not found. Run the Python pipeline first (see docs/GIS_PIPELINE.md)." });
  const src = manifest ? `${manifest.provenance_label || "OSM-derived"} (${manifest.generated_at || "undated"})` : "OSM-derived";

  const need = (name, kind) => {
    const fc = read(dir, name);
    if (!fc) { problems.push({ file: name, message: "file not found" }); return []; }
    return (fc.features || []).filter((f) => {
      const err = validateGeometry(f.geometry, kind);
      if (err) { problems.push({ file: name, id: f.properties && f.properties.osm_id, message: err }); return false; }
      return true;
    });
  };

  // Building footprints keep their polygon. The representative point comes from the separate centroid file.
  const cent = new Map(need("building_centroids.geojson", ["Point"]).map((f) => [f.properties.osm_id, f.geometry]));
  const buildings = [];
  for (const f of need("buildings.geojson", ["Polygon", "MultiPolygon"])) {
    const p = f.properties || {};
    if (!p.osm_id) { problems.push({ file: "buildings.geojson", message: "feature without osm_id skipped" }); continue; }
    const hs = HEIGHT_SOURCES.includes(p.height_source) ? p.height_source : "unknown";
    const height = hs === "unknown" ? undefined : num(p.height_m);
    buildings.push({
      osmId: p.osm_id, code: codeFor(p.osm_id), name: p.name, category: p.db_category || "other",
      footprint: f.geometry, location: cent.get(p.osm_id),
      floorsCount: num(p.levels) ?? 1,
      ...(height != null ? { heightM: height, heightSource: hs } : { heightSource: "unknown" }),
      source: src, verification: "extracted_osm", isDemo: false,
    });
  }
  const facilities = need("facilities.geojson", ["Point"]).filter((f) => f.properties && f.properties.osm_id).map((f) => {
    const p = f.properties;
    return { importKey: `osm:${p.osm_id}`, name: p.name, category: p.db_category || "other", location: f.geometry,
      tags: [p.category].filter(Boolean), description: [p.operator && `Operator: ${p.operator}`, p.has_real_name === false && "Unnamed in OpenStreetMap"].filter(Boolean).join(". "),
      source: src, verification: "extracted_osm", isDemo: false };
  });
  const seg = new Set();
  const paths = need("pedestrian_network.geojson", ["LineString"]).map((f) => {
    const p = f.properties || {}, key = p.segment_id || p.osm_id;
    if (!key) return null;
    if (seg.has(key)) { warnings.push({ file: "pedestrian_network.geojson", id: key, message: "duplicate segment id skipped" }); return null; }
    seg.add(key);
    return { osmId: key, name: p.name || "", pathType: ["footpath", "road", "stairs", "ramp", "crossing", "other"].includes(p.path_type) ? p.path_type : "footpath",
      geometry: f.geometry, accessible: p.accessible !== false, walkable: p.walkable !== false, source: src, verification: "extracted_osm" };
  }).filter(Boolean);

  const dist = read(dir, "walking_distances.json");
  const walking = ((dist && dist.pairs) || []).map((x) => ({ a: x.from, b: x.to, meters: x.meters == null ? null : Number(x.meters), route: x.route === "network" ? "network" : "no_connected_route" }));

  const dupName = new Map();
  for (const b of buildings) dupName.set(b.code, (dupName.get(b.code) || 0) + 1);
  for (const [c, n] of dupName) if (n > 1) problems.push({ file: "buildings.geojson", id: c, message: `${n} buildings map to the same code` });

  return { manifest, records: { buildings, facilities, paths, walking }, problems, warnings,
    summary: { buildings: buildings.length, facilities: facilities.length, paths: paths.length, walkingPairs: walking.length } };
}

async function upsertSet(Model, records, keyField, fields, { overwrite, isVerifiedProtected = true }) {
  const res = { created: 0, updated: 0, unchanged: 0, skippedProtected: 0 };
  for (const data of records) {
    const existing = await Model.findOne({ [keyField]: data[keyField] });
    if (!existing) { await Model.create(data); res.created++; continue; }
    const guarded = new Set(existing.adminEditedFields || []);
    const verified = isVerifiedProtected && ["verified_college", "manual"].includes(existing.verification);
    const patch = {};
    for (const k of fields) {
      if (data[k] === undefined || JSON.stringify(existing[k]) === JSON.stringify(data[k])) continue;
      if (!overwrite && (verified || guarded.has(k))) { res.skippedProtected++; continue; }
      patch[k] = data[k];
    }
    if (!Object.keys(patch).length) { res.unchanged++; continue; }
    existing.set(patch); await existing.save(); res.updated++;
  }
  return res;
}

async function commit(records, { overwrite = false, models } = {}) {
  const M = models || {
    Building: require("../../models/Building"), Facility: require("../../models/Facility"),
    CampusPath: require("../../models/CampusPath"), WalkingDistance: require("../../models/WalkingDistance"),
  };
  const out = {};
  out.buildings = await upsertSet(M.Building, records.buildings, "osmId", ["name", "category", "footprint", "location", "floorsCount", "heightM", "heightSource", "source"], { overwrite });
  out.facilities = await upsertSet(M.Facility, records.facilities, "importKey", ["name", "category", "location", "tags", "description", "source"], { overwrite });
  out.paths = await upsertSet(M.CampusPath, records.paths, "osmId", ["name", "pathType", "geometry", "accessible", "walkable", "source"], { overwrite });
  // Distances are derived data, not edited by admins: always refreshed.
  const w = { created: 0, updated: 0, unchanged: 0 };
  for (const d of records.walking) {
    const a = d.a < d.b ? d.a : d.b, b = d.a < d.b ? d.b : d.a;
    const ex = await M.WalkingDistance.findOne({ a, b });
    if (!ex) { await M.WalkingDistance.create({ ...d, a, b }); w.created++; }
    else if (ex.meters !== d.meters || ex.route !== d.route) { ex.set({ meters: d.meters, route: d.route, computedAt: new Date() }); await ex.save(); w.updated++; }
    else w.unchanged++;
  }
  out.walking = w;
  return out;
}

module.exports = { parse, commit, codeFor };
