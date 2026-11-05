// Usage (from /server):
//   node scripts/importFacilities.js <file.xlsx>                 dry run: validate and print a report, saves nothing
//   node scripts/importFacilities.js <file.xlsx> --commit        save (idempotent: re-running does not duplicate)
//   node scripts/importFacilities.js <file.xlsx> --commit --overwrite   also overwrite verified / admin-corrected fields
require("dotenv").config();
const path = require("path");
const mongoose = require("mongoose");
const { parse, commit } = require("../services/importers/facilitiesExcel");

(async () => {
  const file = process.argv[2];
  if (!file || file.startsWith("--")) { console.error("Give the .xlsx path as the first argument"); process.exit(1); }
  const report = await parse(path.resolve(file));
  console.log(`Parsed ${report.summary.total} valid row(s), ${report.errors.length} rejected, ${report.warnings.length} warning(s)`);
  console.log("By category:", report.summary.byCategory);
  report.errors.forEach((e) => console.log(`  ERROR row ${e.row} ${e.name || ""}: ${e.message}`));
  report.warnings.forEach((w) => console.log(`  WARN  row ${w.row} ${w.name || ""}: ${w.message}`));
  if (!process.argv.includes("--commit")) { console.log("\nDry run only. Add --commit to save."); return; }
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing in server/.env");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Import result:", await commit(report.records, { overwrite: process.argv.includes("--overwrite") }));
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
