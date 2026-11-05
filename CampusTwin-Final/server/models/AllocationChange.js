const mongoose = require("mongoose");
const { isDateStr } = require("../utils/time");
// One approved room change for ONE date of a weekly timetable entry.
// The Timetable entry itself is never modified, so the original allocation is preserved.
const schema = new mongoose.Schema(
  {
    timetable: { type: mongoose.Schema.Types.ObjectId, ref: "Timetable", required: true },
    date: { type: String, required: true, validate: { validator: isDateStr, message: "date must be YYYY-MM-DD" } },
    originalRoom: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    newRoom: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    replacementRequest: { type: mongoose.Schema.Types.ObjectId, ref: "ReplacementRequest" },
    reason: { type: String, default: "", trim: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
    status: { type: String, enum: ["active", "cancelled"], default: "active" },
  },
  { timestamps: true }
);
// At most one ACTIVE change per timetable entry per date (database-enforced).
schema.index({ timetable: 1, date: 1 }, { unique: true, partialFilterExpression: { status: "active" } });
schema.index({ newRoom: 1, date: 1 });
module.exports = mongoose.model("AllocationChange", schema);
