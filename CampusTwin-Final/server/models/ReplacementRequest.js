const mongoose = require("mongoose");
const occurrence = new mongoose.Schema({
  timetable: { type: mongoose.Schema.Types.ObjectId, ref: "Timetable" },
  date: String,
  startMinutes: Number,
  endMinutes: Number,
  summary: Object,        // snapshot: subject, faculty, course, section, studentCount, original room
  requirements: Object,   // equipment / special needs / capacity used for matching
  candidates: [Object],   // eligible rooms, ranked, with scores + reasons
  rejected: [Object],     // ineligible rooms with the hard constraint(s) they violate
  suggestedRoom: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
  selectedRoom: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
  decision: { type: String, enum: ["pending", "approved", "rejected", "no_alternative"], default: "pending" },
  explanation: String,
});
const schema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    maintenance: { type: mongoose.Schema.Types.ObjectId, ref: "MaintenanceRecord" },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    reason: { type: String, default: "", trim: true },
    weights: Object,
    occurrences: [occurrence],
    status: { type: String, enum: ["pending", "approved", "partially_approved", "rejected", "no_affected_classes"], default: "pending" },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    decidedAt: Date,
    decisionNote: { type: String, default: "" },
  },
  { timestamps: true }
);
schema.index({ status: 1, createdAt: -1 });
module.exports = mongoose.model("ReplacementRequest", schema);
