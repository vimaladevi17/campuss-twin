const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Building = require("../../models/Building"), Room = require("../../models/Room"), Timetable = require("../../models/Timetable"),
  Facility = require("../../models/Facility"), Reservation = require("../../models/Reservation"), Maintenance = require("../../models/MaintenanceRecord"),
  CampusPath = require("../../models/CampusPath");
const oid = () => new mongoose.Types.ObjectId();
const errs = async (doc) => { try { await doc.validate(); return []; } catch (e) { return Object.keys(e.errors); } };

test("Building: footprint kept, centroid derived, height clearly marked as an estimate", async () => {
  const b = new Building({ code: "b8", name: "8th", floorsCount: 4, footprint: { type: "Polygon", coordinates: [[[77.675, 9.574], [77.676, 9.574], [77.676, 9.575], [77.675, 9.575], [77.675, 9.574]]] } });
  await b.validate();
  assert.equal(b.code, "B8");
  assert.equal(b.footprint.type, "Polygon");              // original geometry retained
  assert.equal(b.location.type, "Point");                 // marker point generated separately
  assert.equal(b.heightM, 14); assert.equal(b.heightSource, "estimated_from_floors");
  assert.ok((await errs(new Building({ code: "x", name: "y", location: { type: "Point", coordinates: [9.5, 177.6] } }))).includes("location"));
  assert.ok((await errs(new Building({ code: "x", name: "y", footprint: { type: "Polygon", coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0]]] } }))).includes("footprint"));
});
test("Room: capacity, equipment working<=quantity, required fields", async () => {
  assert.deepEqual((await errs(new Room({}))).sort(), ["building", "capacity", "roomNumber"]);
  const r = new Room({ roomNumber: "1", building: oid(), capacity: 30, equipment: [{ type: "desktop_computer", quantity: 30 }] });
  await r.validate(); assert.equal(r.equipment[0].workingQuantity, 30);
  assert.ok((await errs(new Room({ roomNumber: "1", building: oid(), capacity: 0 }))).includes("capacity"));
  assert.ok((await errs(new Room({ roomNumber: "1", building: oid(), capacity: 5, equipment: [{ type: "laser", quantity: 1 }] }))).some((k) => k.startsWith("equipment")));
  assert.ok((await errs(new Room({ roomNumber: "1", building: oid(), capacity: 5, equipment: [{ type: "projector", quantity: 1, workingQuantity: 3 }] }))).some((k) => k.includes("workingQuantity")));
});
test("Timetable: legacy rows still validate; structured rows derive the time text", async () => {
  const legacy = new Timetable({ day: "Monday", time: "10:00-11:00", subject: "Maths", faculty: "Dr X", room: "Hall 1" });
  await legacy.validate(); assert.equal(legacy.startMinutes, 600); assert.equal(legacy.endMinutes, 660);
  const modern = new Timetable({ day: "Tuesday", subject: "Net", roomRef: oid(), facultyRef: oid(), startMinutes: 540, endMinutes: 600 });
  await modern.validate(); assert.equal(modern.time, "09:00-10:00");
  assert.ok((await errs(new Timetable({ day: "Monday", subject: "x", faculty: "f", room: "r", startMinutes: 700, endMinutes: 600 }))).includes("endMinutes"));
  assert.ok((await errs(new Timetable({ day: "Sunday", subject: "x", faculty: "f", room: "r", time: "10:00-11:00" }))).includes("day"));
  assert.ok((await errs(new Timetable({ day: "Monday", subject: "x", faculty: "f", room: "r", time: "10:00-11:00", dateFrom: "2026-13-01" }))).includes("dateFrom"));
  assert.ok((await errs(new Timetable({ day: "Monday", subject: "x", faculty: "f", room: "r", time: "10:00-11:00", dateFrom: "2026-05-01", dateTo: "2026-04-01" }))).includes("dateTo"));
});
test("Facility, Reservation, Maintenance, Path validation", async () => {
  assert.ok((await errs(new Facility({ name: "x", category: "food" }))).includes("location"));
  assert.ok((await errs(new Facility({ name: "x", category: "nonsense", location: { type: "Point", coordinates: [77, 9] } }))).includes("category"));
  assert.deepEqual(await errs(new Facility({ name: "x", category: "food", location: { type: "Point", coordinates: [77, 9] } })), []);
  assert.ok((await errs(new Reservation({ room: oid(), title: "t", date: "2026-11-02", startMinutes: 600, endMinutes: 600 }))).includes("endMinutes"));
  assert.ok((await errs(new Maintenance({ reason: "x", startAt: new Date(), endAt: new Date(Date.now() + 1000) }))).includes("room"));
  assert.ok((await errs(new Maintenance({ room: oid(), reason: "x", startAt: new Date(), endAt: new Date(Date.now() - 1000) }))).includes("endAt"));
  assert.ok((await errs(new CampusPath({ geometry: { type: "Point", coordinates: [1, 1] } }))).includes("geometry"));
});
