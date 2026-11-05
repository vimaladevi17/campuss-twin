// Usage (from /server):
//   node scripts/importGis.js <gis-output-dir>                 DRY RUN: validate and report, saves nothing
//   node scripts/importGis.js <gis-output-dir> --commit        save (safe to repeat; no duplicates, nothing deleted)
//   node scripts/importGis.js <gis-output-dir> --commit --overwrite   also replace admin-edited / verified fields
// Default directory: ../data/gis
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const { parse, commit } = require("../services/importers/gisGeojson");

(async () => {
  const arg = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "../data/gis";
  const dir = path.resolve(arg);
  const r = parse(dir);
  console.log("Reading", dir);
  console.log("Parsed:", r.summary);
  r.problems.forEach((p) => console.log("  PROBLEM", p.file, p.id || "", p.message));
  r.warnings.forEach((p) => console.log("  WARN   ", p.file, p.id || "", p.message));
  const report = { at: new Date().toISOString(), dir, mode: process.argv.includes("--commit") ? "commit" : "dry-run", summary: r.summary, problems: r.problems, warnings: r.warnings };
  if (!process.argv.includes("--commit")) {
    fs.writeFileSync(path.join(dir, "import_dry_run_report.json"), JSON.stringify(report, null, 2));
    console.log("\nDry run only. Nothing was saved. Add --commit to save.");
    return;
  }
  if (r.problems.some((p) => p.file === "gis_import_manifest.json")) throw new Error("Cannot import without the manifest.");
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing in server/.env");
  await mongoose.connect(process.env.MONGO_URI);
  report.result = await commit(r.records, { overwrite: process.argv.includes("--overwrite") });
  console.log("Import result:", JSON.stringify(report.result, null, 2));
  fs.writeFileSync(path.join(dir, "import_commit_report.json"), JSON.stringify(report, null, 2));
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
