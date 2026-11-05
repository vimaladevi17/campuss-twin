const express = require("express");
const Reservation = require("../models/Reservation");
const Room = require("../models/Room");
const { protect, authorize } = require("../middleware/authMiddleware");
const { sendError, validateId, pick } = require("../utils/helpers");
const { audit } = require("../utils/audit");
const realtime = require("../utils/realtime");
const { withLocks } = require("../services/locks");
const { loadContext, buildBusy, conflictsFor } = require("../services/availability");
const { slotToInterval, parseHHMM, isDateStr } = require("../utils/time");
const { notifyUsers, adminIds } = require("../services/notify");

const router = express.Router();
router.use(protect);

async function slotConflicts(roomId, date, s, e, ignoreId) {
  const ctx = await loadContext(date, date);
  ctx.reservations = ctx.reservations.filter((r) => String(r._id) !== String(ignoreId));
  return conflictsFor(buildBusy({ dateStr: date, ...ctx }).get(String(roomId)), slotToInterval(date, s, e));
}

// Faculty/admin see their own; admin sees all
router.get("/", authorize("faculty"), async (req, res) => {
  try {
    const q = req.user.role === "admin" ? {} : { requestedBy: req.user.id };
    if (req.query.status) q.status = req.query.status;
    if (req.query.room) q.room = req.query.room;
    res.json(await Reservation.find(q).sort({ date: -1 }).limit(200).populate("room", "roomNumber name building"));
  } catch (e) { sendError(res, e, "Failed to load reservations"); }
});

// Faculty requests (pending). Admin-created reservations are approved immediately. Time clashes are rejected up front.
router.post("/", authorize("faculty"), async (req, res) => {
  try {
    const b = req.body || {};
    const data = pick(b, ["room", "title", "date", "note"]);
    data.startMinutes = b.startMinutes ?? parseHHMM(b.startTime);
    data.endMinutes = b.endMinutes ?? parseHHMM(b.endTime);
    if (!data.room || !data.title || !isDateStr(data.date) || data.startMinutes == null || data.endMinutes == null)
      return res.status(400).json({ message: "room, title, date (YYYY-MM-DD), startTime and endTime are required" });
    if (data.endMinutes <= data.startMinutes) return res.status(400).json({ message: "End time must be after start time" });
    if (!(await Room.exists({ _id: data.room }))) return res.status(400).json({ message: "Room does not exist" });
    return await withLocks([`tt:${data.room}`], async () => {
      const hits = await slotConflicts(data.room, data.date, data.startMinutes, data.endMinutes);
      if (hits.length) return res.status(409).json({ message: "Room is not free in that time window", conflicts: hits.map((h) => ({ type: h.type, label: h.label })) });
      const isAdmin = req.user.role === "admin";
      const doc = await Reservation.create({ ...data, requestedBy: req.user.id, status: isAdmin ? "approved" : "pending", decidedBy: isAdmin ? req.user.id : undefined, decidedAt: isAdmin ? new Date() : undefined });
      await audit(req, "create", "reservation", doc._id);
      if (!isAdmin) await notifyUsers(await adminIds(), { type: "reservation_request", title: "Room reservation request", message: `${req.user.name} requested a room on ${data.date}.`, link: "/reservations" });
      realtime.emit("availability:changed", { rooms: [String(data.room)] });
      res.status(201).json(doc);
    });
  } catch (e) { sendError(res, e, "Failed to create reservation"); }
});

async function decide(req, res, status) {
  try {
    const doc = await Reservation.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Reservation not found" });
    if (doc.status !== "pending") return res.status(409).json({ message: `Reservation is already ${doc.status}` });
    return await withLocks([`tt:${doc.room}`], async () => {
      if (status === "approved") {
        const hits = await slotConflicts(doc.room, doc.date, doc.startMinutes, doc.endMinutes, doc._id);
        if (hits.length) return res.status(409).json({ message: "Room is no longer free in that window", conflicts: hits.map((h) => ({ type: h.type, label: h.label })) });
      }
      doc.status = status; doc.decidedBy = req.user.id; doc.decidedAt = new Date(); await doc.save();
      await audit(req, status === "approved" ? "approve" : "reject", "reservation", doc._id);
      if (doc.requestedBy) await notifyUsers([doc.requestedBy], { type: "reservation_" + status, title: `Reservation ${status}`, message: doc.title, link: "/reservations" });
      realtime.emit("availability:changed", { rooms: [String(doc.room)] });
      res.json(doc);
    });
  } catch (e) { sendError(res, e, "Failed to update reservation"); }
}
router.post("/:id/approve", authorize(), validateId, (req, res) => decide(req, res, "approved"));
router.post("/:id/reject", authorize(), validateId, (req, res) => decide(req, res, "rejected"));
router.post("/:id/cancel", authorize("faculty"), validateId, async (req, res) => {
  try {
    const doc = await Reservation.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Reservation not found" });
    if (req.user.role !== "admin" && String(doc.requestedBy) !== req.user.id) return res.status(403).json({ message: "You can only cancel your own reservations" });
    doc.status = "cancelled"; await doc.save();
    realtime.emit("availability:changed", { rooms: [String(doc.room)] });
    res.json(doc);
  } catch (e) { sendError(res, e, "Failed to cancel reservation"); }
});

module.exports = router;
