const express = require("express");
const Timetable = require("../models/Timetable");
const Room = require("../models/Room");
const Faculty = require("../models/Faculty");
const AllocationChange = require("../models/AllocationChange");
const Maintenance = require("../models/MaintenanceRecord");
const Reservation = require("../models/Reservation");
const { protect, authorize } = require("../middleware/authMiddleware");
const { sendError, validateId, pick } = require("../utils/helpers");
const { audit } = require("../utils/audit");
const realtime = require("../utils/realtime");
const { notifyUsers, userIdsForFaculty } = require("../services/notify");
const { withLocks } = require("../services/locks");
const { checkEntryConflicts } = require("../services/conflicts");
const { effectiveAllocations } = require("../services/availability");
const T = require("../utils/time");

const router = express.Router();
const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const FIELDS = ["day", "time", "subject", "faculty", "room", "className", "startMinutes", "endMinutes", "startTime", "endTime",
  "roomRef", "facultyRef", "courseRef", "course", "semester", "section", "studentCount", "classType", "dateFrom", "dateTo",
  "requiredEquipment", "specialRequirements", "status", "isDemo"];
const bad = (message, status = 400, details) => Object.assign(new Error(message), { status, details });
const POPULATE = [{ path: "roomRef", select: "roomNumber name building capacity type" }, { path: "facultyRef", select: "name email department" }];

// Turns request data into a normalised timetable payload (and checks references exist)
async function normalise(body, existing) {
  const data = pick(body, FIELDS);
  for (const [k, minKey] of [["startTime", "startMinutes"], ["endTime", "endMinutes"]]) {
    if (data[k] !== undefined) {
      const m = T.parseHHMM(data[k]);
      if (m === null) throw bad(`${k} must look like 09:30`);
      data[minKey] = m;
    }
    delete data[k];
  }
  if (data.time && data.startMinutes === undefined && data.endMinutes === undefined) {
    const r = T.parseTimeRange(data.time);
    if (!r) throw bad("time must look like 10:00-11:00 (end after start)");
    data.startMinutes = r.start; data.endMinutes = r.end;
  }
  if (data.roomRef) {
    const room = await Room.findById(data.roomRef);
    if (!room) throw bad("Room does not exist");
    data.building = room.building;
    data.room = room.name ? `${room.roomNumber} - ${room.name}` : room.roomNumber;
    data.needsReview = false;
  }
  if (data.facultyRef) {
    const f = await Faculty.findById(data.facultyRef);
    if (!f) throw bad("Faculty member does not exist");
    data.faculty = f.name;
  }
  if (data.day && !dayOrder.includes(data.day)) throw bad("day must be Monday to Saturday");
  if (!existing && !data.roomRef && data.room) data.needsReview = true; // legacy-style entry: text room only
  return data;
}

async function validateEntry(data, existing) {
  const merged = { ...(existing ? existing.toObject() : {}), ...data };
  const room = merged.roomRef ? await Room.findById(merged.roomRef) : null;
  if (!room || merged.startMinutes == null || merged.endMinutes == null)
    return { errors: [], warnings: room ? [] : [{ code: "unlinked_room", message: "Room is not linked to a Room record, so conflicts cannot be checked" }], room };
  if (merged.endMinutes <= merged.startMinutes) return { errors: [{ code: "bad_time", message: "End time must be after start time" }], warnings: [], room };
  const sameDay = await Timetable.find({ day: merged.day, status: { $ne: "cancelled" } }).lean();
  // one-off blockers on this room
  const oneOffs = [];
  if (merged.dateFrom && merged.dateTo) {
    const lo = new Date(T.midnightMs(merged.dateFrom)), hi = new Date(T.midnightMs(merged.dateTo) + 86400000);
    (await Maintenance.find({ status: "scheduled", $or: [{ room: room._id }, { building: room.building }], startAt: { $lt: hi }, endAt: { $gt: lo } }).lean())
      .forEach((m) => oneOffs.push({ start: +new Date(m.startAt), end: +new Date(m.endAt) }));
    (await Reservation.find({ room: room._id, status: "approved", date: { $gte: merged.dateFrom, $lte: merged.dateTo } }).lean())
      .forEach((r) => oneOffs.push(T.slotToInterval(r.date, r.startMinutes, r.endMinutes)));
  }
  return { ...checkEntryConflicts(merged, sameDay, room, oneOffs), room };
}

async function saveWithChecks(req, res, existing) {
  const data = await normalise(req.body, existing);
  const keys = [data.roomRef || (existing && existing.roomRef), data.facultyRef || (existing && existing.facultyRef) || data.faculty]
    .filter(Boolean).map((k) => `tt:${k}`);
  return withLocks(keys, async () => {
    const { errors, warnings } = await validateEntry(data, existing);
    if (errors.length) return res.status(409).json({ message: errors[0].message, conflicts: errors, warnings });
    let doc = existing;
    if (existing) { existing.set(data); await existing.save(); } else doc = await Timetable.create(data);
    await audit(req, existing ? "update" : "create", "timetable", doc._id, { subject: doc.subject, day: doc.day, time: doc.time });
    realtime.emit("timetable:changed", { id: String(doc._id) });
    realtime.emit("availability:changed", { rooms: [String(doc.roomRef || "")] });
    try {
      if (doc.facultyRef) {
        const users = (await userIdsForFaculty([doc.facultyRef])).filter((u) => String(u) !== String(req.user.id));
        await notifyUsers(users, { type: "timetable_changed", title: `Timetable ${existing ? "updated" : "added"}: ${doc.subject}`,
          message: `${doc.day} ${doc.time || ""}`.trim(), link: "/timetable", dedupeKey: `tt:${doc._id}:${new Date(doc.updatedAt || Date.now()).getTime()}` });
      }
    } catch (e) { console.error("timetable notification failed:", e.message); }
    return res.status(existing ? 200 : 201).json({ ...doc.toJSON(), warnings });
  });
}

// GET /api/timetable   filters: day, room, building, faculty, course, section, mine=true, date=YYYY-MM-DD
router.get("/", protect, async (req, res) => {
  try {
    const q = {}, { day, room, building, faculty, course, section, mine, date } = req.query;
    if (day) q.day = day;
    if (room) q.roomRef = room;
    if (building) q.building = building;
    if (course) q.course = course;
    if (section) q.section = section;
    if (faculty) q.$or = [{ facultyRef: /^[a-f\d]{24}$/i.test(faculty) ? faculty : undefined }, { faculty: { $regex: String(faculty).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }].filter((c) => Object.values(c)[0] !== undefined);
    if (mine === "true") {
      const f = await Faculty.findOne({ email: req.user.email }).collation({ locale: "en", strength: 2 }).lean();
      q.$and = [{ $or: [{ faculty: req.user.name }, ...(f ? [{ facultyRef: f._id }, { faculty: f.name }] : [])] }];
    }
    if (date) {
      if (!T.isDateStr(date)) return res.status(400).json({ message: "date must be YYYY-MM-DD" });
      q.day = T.weekdayOf(date);
    }
    let items = await Timetable.find(q).populate(POPULATE).collation({ locale: "en", strength: 2 }).lean({ virtuals: true });
    if (date) {
      const changes = await AllocationChange.find({ status: "active", date }).lean();
      const eff = new Map(effectiveAllocations(date, items.map((e) => ({ ...e, roomRef: e.roomRef && e.roomRef._id })), changes).map((a) => [String(a.entry._id), a]));
      const rooms = new Map((await Room.find({ _id: { $in: [...eff.values()].map((a) => a.roomId) } }).select("roomNumber name building").lean()).map((r) => [String(r._id), r]));
      items = items.filter((e) => eff.has(String(e._id)) || !e.roomRef).map((e) => {
        const a = eff.get(String(e._id));
        return a ? { ...e, effective: { date, changed: a.changed, room: rooms.get(a.roomId) || null } } : e;
      });
    }
    items.sort((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day) || (a.startMinutes ?? 0) - (b.startMinutes ?? 0) || String(a.time).localeCompare(String(b.time)));
    res.json(items);
  } catch (error) { sendError(res, error, "Failed to load timetable"); }
});

// POST /api/timetable/validate  (admin) dry run: returns conflicts without saving
router.post("/validate", protect, authorize(), async (req, res) => {
  try {
    let existing = null;
    if (req.body && req.body._id) { validateIdOrThrow(req.body._id); existing = await Timetable.findById(req.body._id); }
    const data = await normalise(req.body, existing);
    const { errors, warnings } = await validateEntry(data, existing);
    res.json({ valid: errors.length === 0, conflicts: errors, warnings });
  } catch (e) { e.status ? res.status(e.status).json({ message: e.message }) : sendError(res, e, "Validation failed"); }
});
function validateIdOrThrow(v) { if (!/^[a-f\d]{24}$/i.test(String(v))) throw bad("Invalid id"); }

router.get("/:id", protect, validateId, async (req, res) => {
  try {
    const item = await Timetable.findById(req.params.id).populate(POPULATE);
    item ? res.json(item) : res.status(404).json({ message: "Timetable entry not found" });
  } catch (e) { sendError(res, e, "Failed to fetch timetable entry"); }
});

router.post("/", protect, authorize(), async (req, res) => {
  try { await saveWithChecks(req, res, null); }
  catch (e) { e.status ? res.status(e.status).json({ message: e.message }) : sendError(res, e, "Failed to create timetable entry"); }
});
router.put("/:id", protect, authorize(), validateId, async (req, res) => {
  try {
    const existing = await Timetable.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Timetable entry not found" });
    await saveWithChecks(req, res, existing);
  } catch (e) { e.status ? res.status(e.status).json({ message: e.message }) : sendError(res, e, "Failed to update timetable entry"); }
});
router.delete("/:id", protect, authorize(), validateId, async (req, res) => {
  try {
    const doc = await Timetable.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Timetable entry not found" });
    await doc.deleteOne();
    await AllocationChange.updateMany({ timetable: doc._id, status: "active" }, { status: "cancelled" });
    await audit(req, "delete", "timetable", doc._id, { subject: doc.subject });
    realtime.emit("timetable:changed", { id: String(doc._id) });
    res.json({ message: "Timetable entry deleted successfully" });
  } catch (e) { sendError(res, e, "Failed to delete timetable entry"); }
});

module.exports = router;
