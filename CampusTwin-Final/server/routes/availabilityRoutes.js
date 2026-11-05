const express = require("express");
const Room = require("../models/Room");
const Settings = require("../models/CampusSettings");
const { protect } = require("../middleware/authMiddleware");
const { sendError, validateId } = require("../utils/helpers");
const A = require("../services/availability");
const T = require("../utils/time");

const router = express.Router();
router.use(protect); // every role may check availability

const parseEquip = (s) => {
  if (!s) return [];
  // equipment=desktop_computer:30,projector  -> [{type, minQuantity}]
  return String(s).split(",").map((p) => { const [type, n] = p.split(":"); return { type: type.trim(), minQuantity: Math.max(1, parseInt(n, 10) || 1) }; });
};

// GET /api/availability?at=ISO  -> live status of every room (available | occupied | maintenance | unavailable)
router.get("/", async (req, res) => {
  try {
    const at = req.query.at ? new Date(req.query.at) : new Date();
    if (isNaN(at)) return res.status(400).json({ message: "at must be an ISO date-time" });
    const { statuses, rooms, date } = await A.getRoomStatuses(at);
    const out = rooms.map((r) => ({ roomId: r._id, roomNumber: r.roomNumber, name: r.name, building: r.building, type: r.type, capacity: r.capacity, ...statuses.get(String(r._id)) }));
    const counts = out.reduce((c, r) => ((c[r.status] = (c[r.status] || 0) + 1), c), {});
    res.json({ at, date, counts, rooms: req.query.type ? out.filter((r) => r.type === req.query.type) : out });
  } catch (e) { sendError(res, e, "Failed to load availability"); }
});

// GET /api/availability/vacant?date=&startTime=&endTime=&building=&type=&capacity=&equipment=desktop_computer:30
router.get("/vacant", async (req, res) => {
  try {
    const { date, startTime, endTime, building, type, capacity, equipment } = req.query;
    if (!T.isDateStr(date)) return res.status(400).json({ message: "date must be YYYY-MM-DD" });
    const s = T.parseHHMM(startTime), e = T.parseHHMM(endTime);
    if (s === null || e === null || e <= s) return res.status(400).json({ message: "startTime and endTime are required (HH:MM) and end must be after start" });
    const settings = await Settings.get();
    const ctx = await A.loadContext(date, date);
    const busy = A.buildBusy({ dateStr: date, ...ctx });
    const found = A.findVacantRooms({ dateStr: date, startMin: s, endMin: e, rooms: ctx.rooms, busy, dayStart: settings.dayStartMinutes, dayEnd: settings.dayEndMinutes,
      filters: { building, type, minCapacity: capacity ? Number(capacity) : 0, equipment: parseEquip(equipment) } });
    const Building = require("../models/Building"), Floor = require("../models/Floor");
    const [bs, fs] = await Promise.all([Building.find({ _id: { $in: found.map((f) => f.room.building) } }).select("name code").lean(), Floor.find({ _id: { $in: found.map((f) => f.room.floor).filter(Boolean) } }).select("number name").lean()]);
    const bm = new Map(bs.map((b) => [String(b._id), b])), fm = new Map(fs.map((f) => [String(f._id), f]));
    res.json({ date, window: { start: startTime, end: endTime }, count: found.length,
      rooms: found.map(({ room, freeSlots }) => ({
        roomId: room._id, roomNumber: room.roomNumber, name: room.name, type: room.type, capacity: room.capacity,
        building: bm.get(String(room.building)) || null, floor: fm.get(String(room.floor)) || null,
        equipment: room.equipment, specialFacilities: room.specialFacilities, status: "available",
        freeSlots: freeSlots.map((f) => ({ start: T.formatHHMM(f.start), end: T.formatHHMM(f.end) })) })) });
  } catch (e) { sendError(res, e, "Failed to find vacant rooms"); }
});

// GET /api/availability/room/:id?date=YYYY-MM-DD -> that room's busy blocks + free slots for the day
router.get("/room/:id", validateId, async (req, res) => {
  try {
    const date = req.query.date || T.toCampusParts(new Date()).date;
    if (!T.isDateStr(date)) return res.status(400).json({ message: "date must be YYYY-MM-DD" });
    const room = await Room.findById(req.params.id).lean();
    if (!room) return res.status(404).json({ message: "Room not found" });
    const settings = await Settings.get();
    const ctx = await A.loadContext(date, date, { roomFilter: { _id: room._id } });
    ctx.timetable = ctx.timetable.filter(Boolean);
    const all = await A.loadContext(date, date); // timetable/changes may move classes INTO this room
    const busy = A.buildBusy({ dateStr: date, rooms: [room], timetable: all.timetable, changes: all.changes, reservations: all.reservations.filter((r) => String(r.room) === String(room._id)), maintenance: all.maintenance });
    const list = busy.get(String(room._id));
    const base = T.midnightMs(date);
    res.json({ room, date,
      busy: list.map((b) => ({ type: b.type, label: b.label, start: T.formatHHMM(Math.max(0, Math.round((b.start - base) / 60000))), end: T.formatHHMM(Math.min(1440, Math.round((b.end - base) / 60000))) })),
      freeSlots: A.computeFreeSlots(list, date, settings.dayStartMinutes, settings.dayEndMinutes).map((f) => ({ start: T.formatHHMM(f.start), end: T.formatHHMM(f.end) })),
      currentStatus: A.statusAt(list, Date.now()).status });
  } catch (e) { sendError(res, e, "Failed to load room availability"); }
});

module.exports = router;
