// KARE_Campus_Facilities_Spatial_Data.xlsx  ->  Facility documents.
// parse() is pure (no DB). commit() is idempotent: re-running updates instead of duplicating,
// and never overwrites verified or administrator-corrected data unless overwrite=true.
const ExcelJS = require("exceljs");
const { isLngLat, haversine } = require("../../utils/geo");

const CATEGORY_MAP = {
  "canteen & food": "food", "academic & research": "academic", "amenity & landmark": "amenity",
  hostel: "hostel", "transit & parking": "transport_parking", "sports & recreation": "sports",
};
const slug = (s) => String(s).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const cell = (v) => (v && typeof v === "object" && "result" in v ? v.result : v && typeof v === "object" && v.text ? v.text : v);
const SOURCE_FILE = "KARE_Campus_Facilities_Spatial_Data.xlsx";
const REFERENCE = [77.6761, 9.5743];    // supplied approximate campus centre [lng, lat]
const FAR_FROM_CAMPUS_M = 3000;      // warn
const REJECT_FAR_M = 50000;          // reject (a different town / swapped lat-lng)

function inferTags(name) {
  const n = name.toLowerCase(), tags = [];
  if (/library/.test(n)) tags.push("library");
  if (/parking/.test(n)) tags.push("parking");
  if (/gate/.test(n)) tags.push("gate");
  if (/stationery|xerox|gift|courier/.test(n)) tags.push("shop");
  return tags; // keyword-derived only; administrators can edit tags
}

async function parse(filePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.getWorksheet("Campus Facilities") || wb.worksheets[0];
  if (!ws) return { records: [], errors: [{ row: 0, message: "Workbook has no worksheets" }], warnings: [], summary: {} };

  let headerRow = 0; const col = {};
  ws.eachRow((row, n) => {
    if (headerRow) return;
    row.eachCell((c, i) => { const t = String(cell(c.value) ?? "").trim().toLowerCase(); if (t === "facility name") { headerRow = n; } });
    if (headerRow === n) row.eachCell((c, i) => { col[String(cell(c.value)).trim().toLowerCase()] = i; });
  });
  const need = ["facility name", "category", "latitude", "longitude"];
  const missingCols = need.filter((c) => !col[c]);
  if (!headerRow || missingCols.length)
    return { records: [], errors: [{ row: headerRow || 0, message: `Missing required column(s): ${missingCols.join(", ") || "header row not found"}` }], warnings: [], summary: {} };

  const records = [], errors = [], warnings = [], seen = new Map();
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const name = String(cell(row.getCell(col["facility name"]).value) ?? "").trim();
    if (!name) continue;                       // blank / trailing rows
    const catRaw = String(cell(row.getCell(col["category"]).value) ?? "").trim();
    const num = (v) => (v === null || v === undefined || String(v).trim() === "" ? NaN : Number(v)); // blank must not become 0
    const lat = num(cell(row.getCell(col["latitude"]).value)), lng = num(cell(row.getCell(col["longitude"]).value));
    const desc = col["functional description"] ? String(cell(row.getCell(col["functional description"]).value) ?? "").trim() : "";
    const sno = col["s.no"] ? cell(row.getCell(col["s.no"]).value) : null;
    const category = CATEGORY_MAP[catRaw.toLowerCase()];

    if (!category) { errors.push({ row: r, name, message: `Unknown category "${catRaw}"` }); continue; }
    if (!isLngLat([lng, lat]) || !Number.isFinite(lat) || !Number.isFinite(lng)) { errors.push({ row: r, name, message: "Latitude/longitude missing or out of range" }); continue; }
    const coords = [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6]; // removes float noise like 9.575699999999999
    const away = haversine(coords, REFERENCE);
    if (away > REJECT_FAR_M) { errors.push({ row: r, name, message: `Coordinates are ${Math.round(away / 1000)} km from the campus: likely swapped latitude/longitude or a typo` }); continue; }
    if (away > FAR_FROM_CAMPUS_M)
      warnings.push({ row: r, name, message: `Located ${Math.round(haversine(coords, REFERENCE))} m from the campus reference point; check coordinates` });

    const importKey = `${slug(name)}|${category}`;
    if (seen.has(importKey)) { errors.push({ row: r, name, message: `Duplicate of row ${seen.get(importKey)} (same name and category)` }); continue; }
    seen.set(importKey, r);

    records.push({
      importKey, name, category, tags: inferTags(name), description: desc,
      location: { type: "Point", coordinates: coords }, layer: "general",
      source: `${SOURCE_FILE}`, sourceRef: { file: SOURCE_FILE, sheet: ws.name, row: r }, verification: "imported_excel",
      _serial: sno,
    });
  }
  // two different names at the identical coordinates are legitimate (stalls in one block) -> informational only
  const byCoord = new Map();
  records.forEach((x) => { const k = x.location.coordinates.join(","); byCoord.set(k, (byCoord.get(k) || 0) + 1); });
  const shared = [...byCoord.values()].filter((n) => n > 1).length;
  if (shared) warnings.push({ row: 0, message: `${shared} coordinate pair(s) are shared by several facilities (coordinates are only 4-decimal, ~11 m precision)` });

  const byCategory = records.reduce((m, x) => ((m[x.category] = (m[x.category] || 0) + 1), m), {});
  return { records, errors, warnings, summary: { total: records.length, rejected: errors.length, byCategory, sheet: ws.name } };
}

async function commit(records, { overwrite = false } = {}) {
  const Facility = require("../../models/Facility");
  const res = { created: 0, updated: 0, skippedProtected: 0, unchanged: 0 };
  for (const rec of records) {
    const { _serial, ...data } = rec;
    const existing = await Facility.findOne({ importKey: data.importKey });
    if (!existing) { await Facility.create(data); res.created++; continue; }
    const protectedFields = new Set(existing.adminEditedFields || []);
    const verified = existing.verification === "verified_college";
    const patch = {};
    for (const k of ["name", "category", "tags", "description", "location", "sourceRef", "source"]) {
      if (JSON.stringify(existing[k]) === JSON.stringify(data[k])) continue;
      if (!overwrite && (verified || protectedFields.has(k))) { res.skippedProtected++; continue; }
      patch[k] = data[k];
    }
    if (!Object.keys(patch).length) { res.unchanged++; continue; }
    existing.set(patch); await existing.save(); res.updated++;
  }
  return res;
}

module.exports = { parse, commit, CATEGORY_MAP };
