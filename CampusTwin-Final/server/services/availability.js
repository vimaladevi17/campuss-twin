// Room availability = timetable + approved reservations + maintenance + approved room changes.
// buildBusy / findVacantRooms / computeFreeSlots are pure functions (unit-tested without a DB).
const {
  overlaps, slotToInterval, weekdayOf, midnightMs, toCampusParts, eachDate,
} = require("../utils/time");

const id = (v) => (v == null ? "" : String(v._id || v));
const DAY_MS = 24 * 3600 * 1000;

// Timetable entries that actually run on `dateStr` (before applying room changes)
function entriesOnDate(dateStr, timetable) {
  const day = weekdayOf(dateStr);
  return timetable.filter(
    (e) =>
      e.status !== "cancelled" && e.day === day && e.roomRef &&
      e.startMinutes != null && e.endMinutes != null &&
      (!e.dateFrom || dateStr >= e.dateFrom) && (!e.dateTo || dateStr <= e.dateTo)
  );
}

// -> [{ entry, roomId, interval, changed, originalRoomId }]
function effectiveAllocations(dateStr, timetable, changes = []) {
  const active = new Map(
    changes.filter((c) => c.status !== "cancelled" && c.date === dateStr).map((c) => [id(c.timetable), c])
  );
  return entriesOnDate(dateStr, timetable).map((entry) => {
    const ch = active.get(id(entry));
    return {
      entry,
      roomId: ch ? id(ch.newRoom) : id(entry.roomRef),
      originalRoomId: id(entry.roomRef),
      changed: Boolean(ch),
      interval: slotToInterval(dateStr, entry.startMinutes, entry.endMinutes),
    };
  });
}

// -> Map<roomId, [{start,end,type,ref,label}]>   type: class | reservation | maintenance | unavailable
function buildBusy({ dateStr, rooms, timetable = [], changes = [], reservations = [], maintenance = [] }) {
  const busy = new Map(rooms.map((r) => [id(r), []]));
  const push = (roomId, item) => busy.has(roomId) && busy.get(roomId).push(item);
  const day = { start: midnightMs(dateStr), end: midnightMs(dateStr) + DAY_MS };

  for (const r of rooms) {
    if (r.operationalStatus === "inactive") push(id(r), { ...day, type: "unavailable", label: "Room is inactive" });
    if (r.maintenanceStatus === "under_maintenance") push(id(r), { ...day, type: "maintenance", label: "Room flagged under maintenance" });
  }
  for (const a of effectiveAllocations(dateStr, timetable, changes))
    push(a.roomId, { ...a.interval, type: "class", ref: id(a.entry), label: `${a.entry.subject}${a.changed ? " (moved here)" : ""}` });
  for (const rs of reservations)
    if (rs.status === "approved" && rs.date === dateStr)
      push(id(rs.room), { ...slotToInterval(dateStr, rs.startMinutes, rs.endMinutes), type: "reservation", ref: id(rs), label: rs.title });
  for (const m of maintenance) {
    if (m.status === "cancelled" || m.status === "completed") continue;
    const iv = { start: new Date(m.startAt).getTime(), end: new Date(m.endAt).getTime() };
    if (!overlaps(iv, day)) continue;
    if (m.room) push(id(m.room), { ...iv, type: "maintenance", ref: id(m), label: m.reason });
    else for (const r of rooms) if (id(r.building) === id(m.building)) push(id(r), { ...iv, type: "maintenance", ref: id(m), label: m.reason });
  }
  return busy;
}

const conflictsFor = (busyList, interval) => (busyList || []).filter((b) => overlaps(b, interval));

// Free gaps (minutes after midnight) inside [dayStart, dayEnd]
function computeFreeSlots(busyList, dateStr, dayStart = 480, dayEnd = 1080) {
  const base = midnightMs(dateStr);
  const taken = (busyList || [])
    .map((b) => [Math.max(dayStart, Math.round((b.start - base) / 60000)), Math.min(dayEnd, Math.round((b.end - base) / 60000))])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  const free = []; let cursor = dayStart;
  for (const [s, e] of taken) { if (s > cursor) free.push({ start: cursor, end: s }); cursor = Math.max(cursor, e); }
  if (cursor < dayEnd) free.push({ start: cursor, end: dayEnd });
  return free;
}

// Working equipment available vs requirements [{type, minQuantity}]
function equipmentCheck(room, requirements = []) {
  const missing = []; let surplusSum = 0;
  for (const req of requirements) {
    const need = req.minQuantity || 1;
    const have = (room.equipment || []).filter((e) => e.type === req.type)
      .reduce((n, e) => n + (e.workingQuantity ?? e.quantity ?? 0), 0);
    if (have < need) missing.push({ type: req.type, need, have });
    else surplusSum += Math.min(1, (have - need) / need);
  }
  return { ok: missing.length === 0, missing, surplusRatio: requirements.length ? surplusSum / requirements.length : 1 };
}

// Pure vacancy search for one date + time window.
function findVacantRooms({ dateStr, startMin, endMin, rooms, busy, filters = {}, dayStart = 480, dayEnd = 1080 }) {
  const window = slotToInterval(dateStr, startMin, endMin);
  const out = [];
  for (const r of rooms) {
    if (filters.building && id(r.building) !== String(filters.building)) continue;
    if (filters.type && r.type !== filters.type) continue;
    if (filters.minCapacity && r.capacity < filters.minCapacity) continue;
    if (filters.equipment?.length && !equipmentCheck(r, filters.equipment).ok) continue;
    const list = busy.get(id(r)) || [];
    if (conflictsFor(list, window).length) continue;
    out.push({ room: r, freeSlots: computeFreeSlots(list, dateStr, dayStart, dayEnd) });
  }
  return out;
}

// "Right now" status for the map: available | occupied | maintenance | unavailable
function statusAt(busyList, atMs) {
  const hits = conflictsFor(busyList, { start: atMs, end: atMs + 60000 });
  if (hits.some((h) => h.type === "maintenance")) return { status: "maintenance", current: hits.find((h) => h.type === "maintenance") };
  if (hits.some((h) => h.type === "unavailable")) return { status: "unavailable", current: hits.find((h) => h.type === "unavailable") };
  if (hits.length) return { status: "occupied", current: hits[0] };
  return { status: "available", current: null };
}

/* ---------- database loaders ---------- */
async function loadContext(fromDate, toDate, { roomFilter = {} } = {}) {
  const Room = require("../models/Room"), Timetable = require("../models/Timetable"),
    AllocationChange = require("../models/AllocationChange"), Reservation = require("../models/Reservation"),
    Maintenance = require("../models/MaintenanceRecord");
  const lo = new Date(midnightMs(fromDate)), hi = new Date(midnightMs(toDate) + DAY_MS);
  const [rooms, timetable, changes, reservations, maintenance] = await Promise.all([
    Room.find(roomFilter).lean(),
    Timetable.find({ status: { $ne: "cancelled" }, roomRef: { $ne: null } }).lean(),
    AllocationChange.find({ status: "active", date: { $gte: fromDate, $lte: toDate } }).lean(),
    Reservation.find({ status: "approved", date: { $gte: fromDate, $lte: toDate } }).lean(),
    Maintenance.find({ status: "scheduled", startAt: { $lt: hi }, endAt: { $gt: lo } }).lean(),
  ]);
  return { rooms, timetable, changes, reservations, maintenance };
}

async function getRoomStatuses(at = new Date()) {
  const { date } = toCampusParts(at);
  const ctx = await loadContext(date, date);
  const busy = buildBusy({ dateStr: date, ...ctx });
  const result = new Map();
  for (const r of ctx.rooms) result.set(id(r), statusAt(busy.get(id(r)), at.getTime()));
  return { statuses: result, rooms: ctx.rooms, date };
}

module.exports = {
  entriesOnDate, effectiveAllocations, buildBusy, conflictsFor, computeFreeSlots, equipmentCheck,
  findVacantRooms, statusAt, loadContext, getRoomStatuses, eachDate,
};
