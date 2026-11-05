const express = require("express");
const Room = require("../models/Room");
const Building = require("../models/Building");
const Floor = require("../models/Floor");
const Timetable = require("../models/Timetable");
const Reservation = require("../models/Reservation");
const createCrudRouter = require("./crudRouter");
const { protect, authorize } = require("../middleware/authMiddleware");
const { sendError, validateId, pick } = require("../utils/helpers");
const { audit } = require("../utils/audit");
const realtime = require("../utils/realtime");

const router = express.Router();
const EQ_FIELDS = ["type", "name", "quantity", "workingQuantity", "notes"];

// Equipment is managed per item so it can be updated individually.
router.post("/:id/equipment", protect, authorize(), validateId, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found" });
    room.equipment.push(pick(req.body, EQ_FIELDS));
    await room.save();
    await audit(req, "update", "room", room._id, { equipment: "added" });
    realtime.emit("room:updated", { id: String(room._id) });
    res.status(201).json(room);
  } catch (e) { sendError(res, e, "Failed to add equipment"); }
});
router.put("/:id/equipment/:eid", protect, authorize(), validateId, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    const item = room && room.equipment.id(req.params.eid);
    if (!item) return res.status(404).json({ message: "Equipment not found" });
    item.set(pick(req.body, EQ_FIELDS));
    await room.save();
    await audit(req, "update", "room", room._id, { equipment: req.params.eid });
    realtime.emit("room:updated", { id: String(room._id) });
    res.json(room);
  } catch (e) { sendError(res, e, "Failed to update equipment"); }
});
router.delete("/:id/equipment/:eid", protect, authorize(), validateId, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    const item = room && room.equipment.id(req.params.eid);
    if (!item) return res.status(404).json({ message: "Equipment not found" });
    item.deleteOne();
    await room.save();
    await audit(req, "update", "room", room._id, { equipment: "removed" });
    res.json(room);
  } catch (e) { sendError(res, e, "Failed to remove equipment"); }
});

router.use("/", createCrudRouter(Room, {
  label: "Room", entity: "room",
  fields: ["roomNumber", "name", "building", "floor", "type", "labCategory", "capacity", "equipment", "specialFacilities",
    "facilities", "notes", "operationalStatus", "maintenanceStatus", "verification"],
  required: ["roomNumber", "building", "capacity"],
  sort: { roomNumber: 1 },
  searchFields: ["roomNumber", "name"],
  filters: { building: "building", floor: "floor", type: "type", operationalStatus: "operationalStatus", maintenanceStatus: "maintenanceStatus" },
  populate: [{ path: "building", select: "name code" }, { path: "floor", select: "number name" }],
  readRoles: ["student", "faculty"],
  beforeSave: async (data, req, existing) => {
    const bId = data.building || (existing && existing.building);
    if (data.building && !(await Building.exists({ _id: data.building })))
      throw Object.assign(new Error("Building does not exist"), { status: 400 });
    if (data.floor) {
      const f = await Floor.findById(data.floor).select("building");
      if (!f) throw Object.assign(new Error("Floor does not exist"), { status: 400 });
      if (String(f.building) !== String(bId)) throw Object.assign(new Error("Floor belongs to a different building"), { status: 400 });
    }
    if (data.capacity !== undefined && existing && data.capacity < existing.capacity) {
      const tooBig = await Timetable.countDocuments({ roomRef: existing._id, status: { $ne: "cancelled" }, studentCount: { $gt: data.capacity } });
      if (tooBig) throw Object.assign(new Error(`Capacity ${data.capacity} is below the student count of ${tooBig} scheduled class(es)`), { status: 409 });
    }
  },
  beforeDelete: async (doc) => {
    const [tt, rs] = await Promise.all([Timetable.countDocuments({ roomRef: doc._id }), Reservation.countDocuments({ room: doc._id, status: { $in: ["pending", "approved"] } })]);
    return tt || rs ? `Cannot delete: room is used by ${tt} timetable entr${tt === 1 ? "y" : "ies"} and ${rs} reservation(s).` : null;
  },
}));
module.exports = router;
