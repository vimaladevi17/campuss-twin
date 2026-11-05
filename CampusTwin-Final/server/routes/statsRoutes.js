const express = require("express");
const Student = require("../models/Student");
const Faculty = require("../models/Faculty");
const Lab = require("../models/Lab");
const Event = require("../models/Event");
const Notice = require("../models/Notice");
const User = require("../models/User");
const Building = require("../models/Building");
const Floor = require("../models/Floor");
const Room = require("../models/Room");
const Facility = require("../models/Facility");
const Timetable = require("../models/Timetable");
const Maintenance = require("../models/MaintenanceRecord");
const ReplacementRequest = require("../models/ReplacementRequest");
const AuditLog = require("../models/AuditLog");
const Settings = require("../models/CampusSettings");
const { protect, authorize } = require("../middleware/authMiddleware");
const { sendError } = require("../utils/helpers");
const { getRoomStatuses, effectiveAllocations } = require("../services/availability");
const AllocationChange = require("../models/AllocationChange");
const { toCampusParts } = require("../utils/time");

const router = express.Router();

// GET /api/stats  (admin dashboard). Original keys are unchanged; `twin` is new.
// Every figure is calculated from MongoDB, except the two supplied campus reference statistics (stored in CampusSettings).
router.get("/", protect, authorize(), async (req, res) => {
  try {
    const now = new Date(), today = toCampusParts(now);
    const [students, faculty, labs, availableLabs, events, notices, users,
      buildings, floors, rooms, facilities, pendingReplacements, pendingMaintenance, settings, live, timetable, changes, unlinked, recent] =
      await Promise.all([
        Student.countDocuments(), Faculty.countDocuments(), Lab.countDocuments(), Lab.countDocuments({ status: "Available" }),
        Event.countDocuments(), Notice.countDocuments(), User.countDocuments(),
        Building.countDocuments(), Floor.countDocuments(), Room.find().select("type").lean(), Facility.aggregate([{ $group: { _id: "$category", n: { $sum: 1 } } }]),
        ReplacementRequest.countDocuments({ status: { $in: ["pending", "partially_approved"] } }),
        Maintenance.countDocuments({ status: "scheduled", endAt: { $gt: now } }),
        Settings.get(), getRoomStatuses(now),
        Timetable.find({ status: { $ne: "cancelled" } }).lean(), AllocationChange.find({ status: "active", date: today.date }).lean(),
        Timetable.countDocuments({ roomRef: null }), AuditLog.find().sort({ createdAt: -1 }).limit(8).lean(),
      ]);
    const statusCounts = { available: 0, occupied: 0, maintenance: 0, unavailable: 0 };
    live.statuses.forEach((v) => { statusCounts[v.status]++; });
    const labsStatus = { available: 0, occupied: 0, maintenance: 0, unavailable: 0 };
    rooms.filter((r) => r.type === "laboratory").forEach((r) => { labsStatus[live.statuses.get(String(r._id))?.status || "available"]++; });
    const todaysClasses = effectiveAllocations(today.date, timetable, changes).length;

    res.json({
      students, faculty, labs, availableLabs, events, notices, users,
      twin: {
        campus: { name: settings.name, totalAreaSqm: settings.totalAreaSqm, openSpaceRatioPct: settings.openSpaceRatioPct, referenceNote: "Supplied campus reference statistics" },
        buildings, floors, rooms: rooms.length,
        classrooms: rooms.filter((r) => r.type === "classroom").length,
        laboratories: rooms.filter((r) => r.type === "laboratory").length,
        facilities: facilities.reduce((n, f) => n + f.n, 0),
        facilitiesByCategory: Object.fromEntries(facilities.map((f) => [f._id, f.n])),
        roomStatus: statusCounts, labStatus: labsStatus,
        todaysClasses, pendingReplacements, pendingMaintenance,
        timetableEntriesNeedingRoomLink: unlinked,
        recentActivity: recent.map((a) => ({ at: a.createdAt, actor: a.actorName, action: a.action, entity: a.entity })),
        asOf: now,
      },
    });
  } catch (error) { sendError(res, error, "Failed to load statistics"); }
});

module.exports = router;
