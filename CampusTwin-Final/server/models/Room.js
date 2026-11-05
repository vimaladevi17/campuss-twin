const mongoose = require("mongoose");
const { ROOM_TYPES, EQUIPMENT_TYPES, VERIFICATION } = require("../utils/constants");

const equipmentSchema = new mongoose.Schema({
  type: { type: String, enum: EQUIPMENT_TYPES, required: [true, "equipment type is required"] },
  name: { type: String, trim: true, default: "" },
  quantity: { type: Number, min: [0, "quantity cannot be negative"], default: 1 },
  workingQuantity: { type: Number, min: [0, "workingQuantity cannot be negative"] }, // defaults to quantity
  notes: { type: String, trim: true, default: "" },
});
equipmentSchema.pre("validate", function () {
  if (this.workingQuantity == null) this.workingQuantity = this.quantity;
  if (this.workingQuantity > this.quantity) this.invalidate("workingQuantity", "workingQuantity cannot exceed quantity");
});

// Availability is NOT stored here. It is calculated from timetable, reservations,
// maintenance and approved changes (see services/availability.js).
const roomSchema = new mongoose.Schema(
  {
    roomNumber: { type: String, required: [true, "roomNumber is required"], trim: true },
    name: { type: String, trim: true, default: "" },
    building: { type: mongoose.Schema.Types.ObjectId, ref: "Building", required: [true, "building is required"] },
    floor: { type: mongoose.Schema.Types.ObjectId, ref: "Floor" },
    type: { type: String, enum: ROOM_TYPES, default: "classroom" },
    labCategory: { type: String, trim: true, default: "" }, // e.g. "computing", "electronics" (laboratories only)
    capacity: { type: Number, required: [true, "capacity is required"], min: [1, "capacity must be at least 1"] },
    equipment: [equipmentSchema],
    specialFacilities: [{ type: String, trim: true }], // e.g. "air_conditioned", "fume_hood"
    facilities: [{ type: String, trim: true }],        // classrooms: "projector", "smart_board"
    notes: { type: String, default: "", trim: true },
    operationalStatus: { type: String, enum: ["active", "inactive"], default: "active" },
    maintenanceStatus: { type: String, enum: ["none", "under_maintenance"], default: "none" },
    verification: { type: String, enum: VERIFICATION, default: "manual" },
    isDemo: { type: Boolean, default: false },
    legacyLabId: { type: mongoose.Schema.Types.ObjectId, ref: "Lab" },
  },
  { timestamps: true }
);
roomSchema.index({ building: 1, roomNumber: 1 }, { unique: true });
roomSchema.index({ type: 1 });
module.exports = mongoose.model("Room", roomSchema);
