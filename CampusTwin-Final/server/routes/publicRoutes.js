// Public, read-only summaries for the website (no login). Counts and live lab status only: no timetable or personal data.
const express = require("express");
const Faculty = require("../models/Faculty");
const Student = require("../models/Student");
const Building = require("../models/Building");
const Facility = require("../models/Facility");
const Room = require("../models/Room");
const { sendError } = require("../utils/helpers");
const { getRoomStatuses } = require("../services/availability");
const router = express.Router();

router.get("/stats", async (req, res) => {
  try {
    const [faculty, students, buildings, facilities, rooms] = await Promise.all([
      Faculty.countDocuments(), Student.countDocuments(), Building.countDocuments({ code: { $ne: "UNASSIGNED" } }), Facility.countDocuments(), Room.find().select("type").lean(),
    ]);
    res.json({ faculty, students, buildings, facilities, classrooms: rooms.filter((r) => r.type === "classroom").length, labs: rooms.filter((r) => r.type === "laboratory").length });
  } catch (e) { sendError(res, e, "Failed to load statistics"); }
});

// Laboratories with LIVE status (calculated, not a typed-in field)
router.get("/labs", async (req, res) => {
  try {
    const [labs, live] = await Promise.all([Room.find({ type: "laboratory" }).populate("building", "name code").sort({ roomNumber: 1 }).lean(), getRoomStatuses(new Date())]);
    res.json(labs.map((l) => ({
      _id: l._id, name: l.name || l.roomNumber, roomNumber: l.roomNumber, building: l.building, capacity: l.capacity, labCategory: l.labCategory,
      equipment: (l.equipment || []).map((e) => ({ type: e.type, name: e.name, quantity: e.quantity })), status: live.statuses.get(String(l._id))?.status || "available", isDemo: l.isDemo,
    })));
  } catch (e) { sendError(res, e, "Failed to load laboratories"); }
});
module.exports = router;
