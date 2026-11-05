const mongoose = require("mongoose");
const { isDateStr } = require("../utils/time");
const schema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: [true, "room is required"] },
    title: { type: String, required: [true, "title is required"], trim: true },
    date: { type: String, required: [true, "date is required"], validate: { validator: isDateStr, message: "date must be YYYY-MM-DD" } },
    startMinutes: { type: Number, required: [true, "startMinutes is required"], min: 0, max: 1440 },
    endMinutes: { type: Number, required: [true, "endMinutes is required"], min: 0, max: 1440 },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["pending", "approved", "rejected", "cancelled"], default: "pending" },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    decidedAt: Date,
    note: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);
schema.pre("validate", function () {
  if (this.endMinutes <= this.startMinutes) this.invalidate("endMinutes", "end time must be after start time");
});
schema.index({ room: 1, date: 1 });
module.exports = mongoose.model("Reservation", schema);
