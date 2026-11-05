// DEMO data for trying the digital-twin features. Everything created here has isDemo=true and "[DEMO]" in its name.
//   Building NAMES and COORDINATES come from the KARE Excel workbook (real).
//   Building CODES, floors, rooms, capacities, equipment and the timetable are INVENTED samples (not KARE records).
//   node scripts/seedTwinDemo.js <KARE_xlsx> [--reset]      (--reset deletes only isDemo records)
require("dotenv").config();
const path = require("path");
const mongoose = require("mongoose");
const Building = require("../models/Building"), Floor = require("../models/Floor"), Room = require("../models/Room"),
  Timetable = require("../models/Timetable"), Faculty = require("../models/Faculty"), Course = require("../models/Course"),
  AllocationChange = require("../models/AllocationChange");
const { parse } = require("../services/importers/facilitiesExcel");

const WANT = { B8: "8th Block (School of Computing)", B11: "11th Block", B5: "5th Block (Mech Block)" };
const pc = (n) => [{ type: "desktop_computer", name: "Desktop PC", quantity: n }, { type: "projector", quantity: 1 }];

async function reset() {
  const demoRooms = (await Room.find({ isDemo: true }).select("_id")).map((r) => r._id);
  await AllocationChange.deleteMany({ $or: [{ newRoom: { $in: demoRooms } }, { originalRoom: { $in: demoRooms } }] });
  await Timetable.deleteMany({ isDemo: true }); await Room.deleteMany({ isDemo: true }); await Floor.deleteMany({ isDemo: true });
  await Building.deleteMany({ isDemo: true }); await Course.deleteMany({ isDemo: true }); await Faculty.deleteMany({ email: /@demo\.invalid$/ });
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  if (process.argv.includes("--reset")) { await reset(); console.log("Demo records removed."); return mongoose.disconnect(); }
  const file = process.argv[2]; if (!file) throw new Error("Pass the KARE .xlsx path (coordinates are read from it)");
  const { records } = await parse(path.resolve(file));
  const b = {};
  for (const [code, name] of Object.entries(WANT)) {
    const rec = records.find((r) => r.name === name); if (!rec) throw new Error(`"${name}" not found in the workbook`);
    b[code] = await Building.findOneAndUpdate({ code }, { code, name: `${name} [DEMO]`, category: "academic", location: rec.location, floorsCount: 3, verification: "estimated_unverified",
      source: `Coordinates: ${rec.source} row ${rec.sourceRef.row}. Code/floors are DEMO values.`, isDemo: true }, { upsert: true, new: true, setDefaultsOnInsert: true });
  }
  const fl = {};
  for (const code of Object.keys(b)) for (const n of [0, 1, 2]) fl[code + n] = await Floor.findOneAndUpdate({ building: b[code]._id, number: n }, { name: n ? `Floor ${n}` : "Ground", isDemo: true }, { upsert: true, new: true });
  const mk = async (code, floor, roomNumber, type, capacity, extra = {}) => Room.findOneAndUpdate({ building: b[code]._id, roomNumber },
    { building: b[code]._id, floor: fl[code + floor]._id, roomNumber, name: `${roomNumber} [DEMO]`, type, capacity, isDemo: true, verification: "estimated_unverified", ...extra }, { upsert: true, new: true, setDefaultsOnInsert: true });
  const CL1 = await mk("B8", 1, "CL-1", "laboratory", 60, { labCategory: "computing", equipment: pc(60), specialFacilities: ["air_conditioned"] });
  const CL2 = await mk("B8", 1, "CL-2", "laboratory", 60, { labCategory: "computing", equipment: pc(60), specialFacilities: ["air_conditioned"] });
  const CL3 = await mk("B8", 2, "CL-3", "laboratory", 40, { labCategory: "computing", equipment: pc(40) });
  await mk("B8", 2, "NL-1", "laboratory", 50, { labCategory: "networking", equipment: [{ type: "networking", name: "Routers & switches", quantity: 20 }] });
  const CL4 = await mk("B11", 1, "CL-4", "laboratory", 70, { labCategory: "computing", equipment: pc(70), specialFacilities: ["air_conditioned"] });
  await mk("B5", 0, "EL-1", "laboratory", 60, { labCategory: "electronics", equipment: [{ type: "electronics", name: "Oscilloscopes", quantity: 30 }] });
  await mk("B8", 1, "C-101", "classroom", 70, { facilities: ["projector"] });
  await mk("B8", 1, "C-102", "classroom", 70, { facilities: ["projector"] });

  const fac = [];
  for (const [i, n] of ["Faculty One", "Faculty Two", "Faculty Three"].entries())
    fac.push(await Faculty.findOneAndUpdate({ email: `demo.faculty${i + 1}@demo.invalid` }, { name: `${n} [DEMO]`, department: "DEMO", designation: "Demo", email: `demo.faculty${i + 1}@demo.invalid` }, { upsert: true, new: true }));
  const course = await Course.findOneAndUpdate({ code: "DEMO-NET" }, { code: "DEMO-NET", name: "[DEMO] Networks", isDemo: true }, { upsert: true, new: true });
  const need = (n) => [{ type: "desktop_computer", minQuantity: n }];
  const slot = (day, s, e, room, f, subject, section, count, req) => ({ day, startMinutes: s, endMinutes: e, roomRef: room._id, building: room.building, facultyRef: f._id, faculty: f.name,
    room: room.name, subject: `[DEMO] ${subject}`, course: "DEMO-NET", courseRef: course._id, section, studentCount: count, classType: "lab", requiredEquipment: req, isDemo: true, semester: "DEMO" });
  await Timetable.deleteMany({ isDemo: true });
  await Timetable.insertMany([
    slot("Monday", 600, 720, CL1, fac[0], "Networks Lab", "A", 50, need(50)),     // the class affected in the demo outage (10:00-12:00)
    slot("Monday", 600, 660, CL2, fac[1], "DBMS Lab", "B", 55, need(55)),          // CL-2 busy -> rejected as alternative
    slot("Monday", 540, 720, CL3, fac[2], "OS Lab", "C", 35, need(35)),
  ]);
  console.log("Demo data ready. Try: POST /api/maintenance { room: <CL-1 id>, reason, startAt: <Monday 10:00 IST>, endAt: <Monday 12:00 IST>, analyze: true }");
  console.log("Expected: CL-4 (11th Block) recommended; CL-2 busy; CL-3 too small; NL-1 and EL-1 lack the required equipment.");
  void CL4; await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
