const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path"), os = require("os");
const ExcelJS = require("exceljs");
const { parse } = require("../../services/importers/facilitiesExcel");

const REAL = process.env.KARE_XLSX || "/mnt/user-data/uploads/KARE_Campus_Facilities_Spatial_Data.xlsx";

test("real KARE workbook: 58 valid rows, counts match the Category Summary sheet", { skip: !fs.existsSync(REAL) }, async () => {
  const r = await parse(REAL);
  assert.equal(r.errors.length, 0);
  assert.equal(r.records.length, 58);
  assert.deepEqual(r.summary.byCategory, { food: 22, academic: 14, amenity: 9, hostel: 7, transport_parking: 4, sports: 2 });
  assert.equal(new Set(r.records.map((x) => x.importKey)).size, 58);                // stable unique keys -> repeat imports cannot duplicate
  const gate = r.records.find((x) => x.name.includes("Main Gate"));
  assert.deepEqual(gate.location.coordinates, [77.6833, 9.5763]);                    // float noise removed, order is [lng, lat]
  assert.equal(gate.verification, "imported_excel"); assert.equal(gate.sourceRef.row, 5);
  assert.ok(r.records.find((x) => x.name === "Central Library").tags.includes("library"));
});

async function book(rows) {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet("Campus Facilities");
  ws.addRow(["title"]); ws.addRow(["S.No", "Facility Name", "Category", "Latitude", "Longitude", "Functional Description"]); rows.forEach((r) => ws.addRow(r));
  const f = path.join(os.tmpdir(), `t${Date.now()}${Math.random()}.xlsx`); await wb.xlsx.writeFile(f); return f;
}
test("bad rows are rejected with reasons, good rows survive", async () => {
  const f = await book([
    [1, "Good", "Hostel", 9.5743, 77.6761, "ok"], [2, "Bad cat", "Zoo", 9.5, 77.6, ""], [3, "No coords", "Hostel", "", "", ""],
    [4, "Swapped", "Hostel", 77.6761, 9.5743, ""], [5, "Good", "Hostel", 9.5744, 77.6762, "dup"], [6, "Far", "Hostel", 9.62, 77.6761, ""],
  ]);
  const r = await parse(f);
  assert.deepEqual(r.records.map((x) => x.name), ["Good", "Far"]);
  assert.equal(r.errors.length, 4);
  assert.ok(r.errors.some((e) => /Unknown category/.test(e.message)));
  assert.ok(r.errors.some((e) => /Duplicate/.test(e.message)));
  assert.ok(r.warnings.some((w) => w.name === "Far" && /campus reference/.test(w.message)));
  fs.unlinkSync(f);
});
test("workbook without required columns is refused", async () => {
  const wb = new ExcelJS.Workbook(); wb.addWorksheet("Campus Facilities").addRow(["Name", "Lat"]);
  const f = path.join(os.tmpdir(), `m${Date.now()}.xlsx`); await wb.xlsx.writeFile(f);
  const r = await parse(f); assert.equal(r.records.length, 0); assert.match(r.errors[0].message, /Missing required column|header/); fs.unlinkSync(f);
});
