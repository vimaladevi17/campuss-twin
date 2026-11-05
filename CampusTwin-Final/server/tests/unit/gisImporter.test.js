const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { parse, commit, codeFor } = require("../../services/importers/gisGeojson");
const DIR = path.join(__dirname, "..", "fixtures", "gis");

// Tiny in-memory stand-in for a Mongoose model (findOne/create + set/save on documents).
function fakeModel() {
  const rows = [];
  return {
    rows,
    async findOne(q) {
      const hit = rows.find((r) => Object.entries(q).every(([k, v]) => r[k] === v));
      return hit && Object.assign(hit, { set(p) { Object.assign(hit, p); }, async save() {} });
    },
    async create(d) { rows.push({ ...d }); return d; },
  };
}
const models = () => ({ Building: fakeModel(), Facility: fakeModel(), CampusPath: fakeModel(), WalkingDistance: fakeModel() });

test("parse reads the pipeline output and keeps polygons and centroids separate", () => {
  const r = parse(DIR);
  assert.deepEqual(r.problems, []);
  assert.equal(r.summary.buildings, 4);
  for (const b of r.records.buildings) {
    assert.ok(["Polygon", "MultiPolygon"].includes(b.footprint.type), "footprint stays a polygon");
    assert.equal(b.location.type, "Point", "representative point stored separately");
    assert.equal(b.verification, "extracted_osm");
    assert.match(b.source, /OSM-derived/);
  }
});
test("heights: OSM and estimated values keep their labels, unknown stays unknown", () => {
  const by = Object.fromEntries(parse(DIR).records.buildings.map((b) => [b.osmId, b]));
  assert.equal(by["way/2"].heightSource, "osm");
  assert.equal(by["way/1"].heightSource, "estimated_from_floors");
  assert.equal(by["way/3"].heightSource, "unknown");
  assert.equal(by["way/3"].heightM, undefined);
});
test("building codes are stable and derived from the OSM id", () => {
  assert.equal(codeFor("way/123"), "OSM-WAY-123");
});
test("dry run touches nothing; commit is idempotent and creates no duplicates", async () => {
  const r = parse(DIR), m = models();
  const first = await commit(r.records, { models: m });
  assert.equal(first.buildings.created, 4);
  assert.equal(first.facilities.created, r.records.facilities.length);
  const counts = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.rows.length]));
  const second = await commit(r.records, { models: m });
  assert.equal(second.buildings.created, 0); assert.equal(second.buildings.unchanged, 4);
  assert.equal(second.facilities.created, 0); assert.equal(second.paths.created, 0);
  assert.deepEqual(Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.rows.length])), counts);
});
test("admin-edited and verified records are protected unless overwrite is set", async () => {
  const r = parse(DIR), m = models();
  await commit(r.records, { models: m });
  const b = m.Building.rows.find((x) => x.osmId === "way/1");
  b.name = "Block 8 (corrected by admin)"; b.adminEditedFields = ["name"]; b.verification = "manual";
  const keep = await commit(r.records, { models: m });
  assert.equal(m.Building.rows.find((x) => x.osmId === "way/1").name, "Block 8 (corrected by admin)");
  assert.ok(keep.buildings.skippedProtected >= 1);
  await commit(r.records, { models: m, overwrite: true });
  assert.equal(m.Building.rows.find((x) => x.osmId === "way/1").name, "Academic Block 8");
});
test("walking distances are stored once per unordered pair and refreshed when they change", async () => {
  const r = parse(DIR), m = models();
  await commit(r.records, { models: m });
  const n = m.WalkingDistance.rows.length;
  assert.equal(n, r.records.walking.length);
  r.records.walking[0].meters += 10;
  const again = await commit(r.records, { models: m });
  assert.equal(again.walking.updated, 1); assert.equal(m.WalkingDistance.rows.length, n);
});
test("invalid geometry and missing manifest are reported, not imported", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gis-"));
  fs.writeFileSync(path.join(tmp, "buildings.geojson"), JSON.stringify({ type: "FeatureCollection", features: [
    { type: "Feature", geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 1]]] }, properties: { osm_id: "way/9" } }] }));
  const r = parse(tmp);
  assert.equal(r.summary.buildings, 0);
  assert.ok(r.problems.some((p) => p.file === "gis_import_manifest.json"));
  assert.ok(r.problems.some((p) => p.file === "buildings.geojson"));
});
