const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
    building: { type: mongoose.Schema.Types.ObjectId, ref: "Building" }, // whole-building closure when room is empty
    reason: { type: String, required: [true, "reason is required"], trim: true },
    startAt: { type: Date, required: [true, "startAt is required"] },
    endAt: { type: Date, required: [true, "endAt is required"] },
    status: { type: String, enum: ["scheduled", "completed", "cancelled"], default: "scheduled" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
schema.pre("validate", function () {
  if (!this.room && !this.building) this.invalidate("room", "room or building is required");
  if (this.startAt && this.endAt && this.endAt <= this.startAt) this.invalidate("endAt", "endAt must be after startAt");
});
schema.index({ room: 1, startAt: 1, endAt: 1 });
module.exports = mongoose.model("MaintenanceRecord", schema);
