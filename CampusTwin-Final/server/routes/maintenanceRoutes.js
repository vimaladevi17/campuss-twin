const express = require("express");
const Maintenance = require("../models/MaintenanceRecord");
const Room = require("../models/Room");
const Building = require("../models/Building");
const { protect, authorize } = require("../middleware/authMiddleware");
const { sendError, validateId, pick } = require("../utils/helpers");
const { audit } = require("../utils/audit");
const realtime = require("../utils/realtime");
const { notifyUsers, adminIds } = require("../services/notify");
const svc = require("../services/replacementService");

const router = express.Router();
const FIELDS = ["room", "building", "reason", "startAt", "endAt", "status"];

router.get("/", protect, authorize("faculty"), async (req, res) => {
  try {
    const q = {};
    if (req.query.room) q.room = req.query.room;
    if (req.query.status) q.status = req.query.status;
    res.json(await Maintenance.find(q).sort({ startAt: -1 }).limit(200).populate("room", "roomNumber name building").populate("building", "name code"));
  } catch (e) { sendError(res, e, "Failed to load maintenance records"); }
});

// POST /api/maintenance  { room | building, reason, startAt, endAt, analyze?: true }
// "Mark a lab unavailable". With analyze:true the affected classes + alternatives are computed at once.
router.post("/", protect, authorize(), async (req, res) => {
  try {
    const data = pick(req.body, FIELDS);
    if (data.room && !(await Room.exists({ _id: data.room }))) return res.status(400).json({ message: "Room does not exist" });
    if (data.building && !(await Building.exists({ _id: data.building }))) return res.status(400).json({ message: "Building does not exist" });
    const record = await Maintenance.create({ ...data, createdBy: req.user.id });
    await audit(req, "create", "maintenance", record._id, { reason: record.reason, room: record.room, building: record.building });
    realtime.emit("maintenance:created", { id: String(record._id), room: record.room && String(record.room) });
    try {
      await notifyUsers((await adminIds()).filter((u) => String(u) !== String(req.user.id)), { type: "maintenance_update", title: "Maintenance recorded",
        message: record.reason || "A room or building was marked for maintenance", link: "/admin/maintenance", dedupeKey: `mt:${record._id}:created` });
    } catch (e) { console.error("maintenance notification failed:", e.message); }
    realtime.emit("availability:changed", { rooms: record.room ? [String(record.room)] : [], building: record.building && String(record.building) });
    let replacement = null;
    if ((req.body || {}).analyze === true && record.room)
      replacement = await svc.analyzeAndSave({ roomId: record.room, startAt: record.startAt, endAt: record.endAt, reason: record.reason, maintenanceId: record._id, user: req.user });
    res.status(201).json({ record, replacement });
  } catch (e) { sendError(res, e, "Failed to create maintenance record"); }
});

router.put("/:id", protect, authorize(), validateId, async (req, res) => {
  try {
    const doc = await Maintenance.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Maintenance record not found" });
    doc.set(pick(req.body, FIELDS)); await doc.save();
    await audit(req, "update", "maintenance", doc._id);
    realtime.emit("availability:changed", { rooms: doc.room ? [String(doc.room)] : [] });
    res.json(doc);
  } catch (e) { sendError(res, e, "Failed to update maintenance record"); }
});

router.delete("/:id", protect, authorize(), validateId, async (req, res) => {
  try {
    const doc = await Maintenance.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: "Maintenance record not found" });
    await audit(req, "delete", "maintenance", doc._id);
    realtime.emit("availability:changed", { rooms: doc.room ? [String(doc.room)] : [] });
    res.json({ message: "Maintenance record deleted successfully" });
  } catch (e) { sendError(res, e, "Failed to delete maintenance record"); }
});

module.exports = router;
