const express = require("express");
const ReplacementRequest = require("../models/ReplacementRequest");
const Room = require("../models/Room");
const { protect, authorize } = require("../middleware/authMiddleware");
const { sendError, validateId } = require("../utils/helpers");
const svc = require("../services/replacementService");

const router = express.Router();
router.use(protect, authorize()); // decision support is admin-only

const handle = (res, e, msg) => (e.status ? res.status(e.status).json({ message: e.message, ...(e.details || {}) }) : sendError(res, e, msg));

// POST /api/replacements/analyze  { room, startAt, endAt, reason?, maintenanceId?, weights? }
// Finds affected classes and ranks alternatives. It NEVER changes the timetable.
router.post("/analyze", async (req, res) => {
  try {
    const { room, startAt, endAt, reason, maintenanceId, weights } = req.body || {};
    if (!room || !startAt || !endAt) return res.status(400).json({ message: "room, startAt and endAt are required" });
    if (isNaN(new Date(startAt)) || isNaN(new Date(endAt))) return res.status(400).json({ message: "startAt and endAt must be valid date-times" });
    if (!(await Room.exists({ _id: room }))) return res.status(404).json({ message: "Room not found" });
    const doc = await svc.analyzeAndSave({ roomId: room, startAt, endAt, reason, maintenanceId, weights, user: req.user });
    res.status(201).json(doc);
  } catch (e) { handle(res, e, "Failed to analyse outage"); }
});

router.get("/", async (req, res) => {
  try {
    const q = req.query.status ? { status: req.query.status } : {};
    res.json(await ReplacementRequest.find(q).sort({ createdAt: -1 }).limit(100).populate("room", "roomNumber name building"));
  } catch (e) { sendError(res, e, "Failed to list replacement requests"); }
});

router.get("/:id", validateId, async (req, res) => {
  try {
    const doc = await ReplacementRequest.findById(req.params.id).populate("room", "roomNumber name building").populate("decidedBy", "name email");
    doc ? res.json(doc) : res.status(404).json({ message: "Replacement request not found" });
  } catch (e) { sendError(res, e, "Failed to load replacement request"); }
});

// POST /api/replacements/:id/approve  { selections: [{ occurrenceId, roomId }] | useSuggested: true, note? }
router.post("/:id/approve", validateId, async (req, res) => {
  try {
    let { selections, useSuggested, note } = req.body || {};
    if (useSuggested === true) {
      const doc = await ReplacementRequest.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "Replacement request not found" });
      selections = doc.occurrences.filter((o) => o.decision === "pending" && o.suggestedRoom).map((o) => ({ occurrenceId: String(o._id), roomId: String(o.suggestedRoom) }));
    }
    if (!Array.isArray(selections) || !selections.every((s) => s && s.occurrenceId && s.roomId))
      return res.status(400).json({ message: "selections must be a list of { occurrenceId, roomId } (or send useSuggested: true)" });
    res.json(await svc.approve({ requestId: req.params.id, selections, note, req }));
  } catch (e) { handle(res, e, "Failed to approve replacement"); }
});

router.post("/:id/reject", validateId, async (req, res) => {
  try { res.json(await svc.reject({ requestId: req.params.id, note: (req.body || {}).note, req })); }
  catch (e) { handle(res, e, "Failed to reject replacement"); }
});

module.exports = router;
