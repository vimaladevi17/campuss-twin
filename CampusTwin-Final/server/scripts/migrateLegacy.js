// Non-destructive migration of the ORIGINAL Lab and Timetable data into the digital-twin model.
//   node scripts/migrateLegacy.js --dry-run   shows what would happen
//   node scripts/migrateLegacy.js             applies it (safe to run repeatedly)
// Nothing is deleted. Original fields (lab.location, timetable.room/faculty/time ...) stay exactly as they were.
require("dotenv").config();
const mongoose = require("mongoose");
const Building = require("../models/Building");
const Room = require("../models/Room");
const Lab = require("../models/Lab");
const Timetable = require("../models/Timetable");
const Faculty = require("../models/Faculty");
const CampusSettings = require("../models/CampusSettings");
const { parseTimeRange } = require("../utils/time");

const dry = process.argv.includes("--dry-run");
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function run() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing in server/.env");
  await mongoose.connect(process.env.MONGO_URI);
  const out = { labsMigrated: 0, labsAlreadyLinked: 0, ttLinkedToRoom: 0, ttLinkedToFaculty: 0, ttTimeParsed: 0, ttNeedReview: 0 };

  // 1. Placeholder building for labs whose real building is unknown. Admins move rooms out of it.
  let holder = await Building.findOne({ code: "UNASSIGNED" });
  if (!holder && !dry) holder = await Building.create({ code: "UNASSIGNED", name: "Unassigned (migrated rooms)", category: "other", floorsCount: 0,
    description: "Placeholder for migrated rooms whose building has not been set yet. Move each room to its real building.", verification: "estimated_unverified", source: "legacy migration" });

  // 2. Labs -> Rooms
  for (const lab of await Lab.find()) {
    if (lab.room) { out.labsAlreadyLinked++; continue; }
    out.labsMigrated++;
    if (dry) continue;
    let number = lab.name, n = 1;
    while (await Room.exists({ building: holder._id, roomNumber: number })) number = `${lab.name} (${++n})`;
    const room = await Room.create({
      roomNumber: number, name: lab.name, building: holder._id, type: "laboratory", capacity: lab.capacity,
      maintenanceStatus: lab.status === "Maintenance" ? "under_maintenance" : "none", // "Occupied/Available" are calculated now, not stored
      notes: [lab.location && `Legacy location: ${lab.location}`, lab.department && `Department: ${lab.department}`, lab.description].filter(Boolean).join(" | "),
      verification: "manual", legacyLabId: lab._id,
    });
    lab.room = room._id; await lab.save();
  }

  // 3. Timetable rows: parse time, link room / faculty only on an exact, unambiguous name match
  const rooms = await Room.find().lean(), faculty = await Faculty.find().lean();
  for (const t of await Timetable.find({ $or: [{ roomRef: null }, { startMinutes: null }, { facultyRef: null }] })) {
    const patch = {};
    if (t.startMinutes == null && t.time) { const r = parseTimeRange(t.time); if (r) { patch.startMinutes = r.start; patch.endMinutes = r.end; out.ttTimeParsed++; } }
    if (!t.roomRef && t.room) {
      const hit = rooms.filter((r) => [r.roomNumber, r.name].some((x) => x && x.toLowerCase() === t.room.trim().toLowerCase()));
      if (hit.length === 1) { patch.roomRef = hit[0]._id; patch.building = hit[0].building; patch.needsReview = false; out.ttLinkedToRoom++; }
      else { patch.needsReview = true; out.ttNeedReview++; }
    }
    if (!t.facultyRef && t.faculty) {
      const hit = faculty.filter((f) => f.name.toLowerCase() === t.faculty.trim().toLowerCase());
      if (hit.length === 1) { patch.facultyRef = hit[0]._id; out.ttLinkedToFaculty++; }
    }
    if (!dry && Object.keys(patch).length) await Timetable.updateOne({ _id: t._id }, { $set: patch });
  }
  // 4. Scoring weights: earlier builds stored availability .4 / equipment .3 / capacity .2 / distance .1.
  //    Switch to the specified equipment .4 / capacity .3 / availability .2 / distance .1, but ONLY when the
  //    stored values are still the old defaults, so weights an admin edited are never touched.
  const st = await CampusSettings.findOne({ key: "campus" });
  const w = st && st.scoringWeights;
  const isOld = w && [["availability", 0.4], ["equipment", 0.3], ["capacity", 0.2], ["distance", 0.1]].every(([k, v]) => Math.abs((w[k] ?? -1) - v) < 1e-9);
  out.weightsUpdated = Boolean(isOld);
  if (isOld && !dry) { st.scoringWeights = { equipment: 0.4, capacity: 0.3, availability: 0.2, distance: 0.1 }; await st.save(); }
  console.log(dry ? "DRY RUN (nothing written):" : "Migration complete:", out);
  if (out.ttNeedReview) console.log(`${out.ttNeedReview} timetable row(s) could not be matched to a Room. They still display, but are excluded from conflict/vacancy checks until an admin links a room.`);
  await mongoose.disconnect();
}
run().catch((e) => { console.error(e.message); process.exit(1); });
