const express = require("express");
const Building = require("../models/Building");
const Floor = require("../models/Floor");
const Room = require("../models/Room");
const createCrudRouter = require("./crudRouter");
const { protect } = require("../middleware/authMiddleware");
const { sendError, validateId } = require("../utils/helpers");
const { getRoomStatuses } = require("../services/availability");

const router = express.Router();

// GET /api/buildings/:id/overview  floors -> rooms with LIVE status (login required: room data)
router.get("/:id/overview", protect, validateId, async (req, res) => {
  try {
    const building = await Building.findById(req.params.id);
    if (!building) return res.status(404).json({ message: "Building not found" });
    const [floors, rooms, live] = await Promise.all([
      Floor.find({ building: building._id }).sort({ number: 1 }).lean(),
      Room.find({ building: building._id }).sort({ roomNumber: 1 }).lean(),
      getRoomStatuses(new Date()),
    ]);
    const withStatus = rooms.map((r) => ({ ...r, liveStatus: live.statuses.get(String(r._id)) || { status: "available" } }));
    res.json({
      building, floors: floors.map((f) => ({ ...f, rooms: withStatus.filter((r) => String(r.floor) === String(f._id)) })),
      unassignedRooms: withStatus.filter((r) => !r.floor),
      counts: {
        classrooms: rooms.filter((r) => r.type === "classroom").length,
        laboratories: rooms.filter((r) => r.type === "laboratory").length,
        rooms: rooms.length,
      },
    });
  } catch (e) { sendError(res, e, "Failed to load building overview"); }
});

router.use("/", createCrudRouter(Building, {
  label: "Building", entity: "building",
  fields: ["code", "name", "category", "description", "location", "footprint", "floorsCount", "heightM", "heightSource",
    "facilities", "status", "imageUrl", "source", "verification", "osmId"],
  required: ["code", "name"],
  sort: { name: 1 },
  searchFields: ["name", "code", "description"],
  filters: { category: "category", status: "status", verification: "verification" },
  beforeSave: async (data, req, existing) => {
    if (existing) {
      const changed = Object.keys(data).filter((k) => JSON.stringify(data[k]) !== JSON.stringify(existing[k]) && !["source", "verification"].includes(k));
      data.adminEditedFields = [...new Set([...(existing.adminEditedFields || []), ...changed])];
      if (changed.length && !("verification" in data) && existing.verification !== "verified_college") data.verification = "manual";
    }
  },
  beforeDelete: async (doc) => {
    const [floors, rooms] = await Promise.all([Floor.countDocuments({ building: doc._id }), Room.countDocuments({ building: doc._id })]);
    return floors || rooms ? `Cannot delete: building still has ${floors} floor(s) and ${rooms} room(s). Remove or move them first.` : null;
  },
}));
module.exports = router;
