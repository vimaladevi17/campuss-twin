const mongoose = require("mongoose");
const { DAYS, CLASS_TYPES, EQUIPMENT_TYPES } = require("../utils/constants");
const { parseTimeRange, formatHHMM, isDateStr } = require("../utils/time");

const dateField = { type: String, validate: { validator: (v) => v == null || v === "" || isDateStr(v), message: "date must be YYYY-MM-DD" } };

// Original fields (day, time, subject, faculty, room, className) are kept so existing
// pages and data keep working. New structured fields enable conflict detection,
// vacancy search and lab replacement. A weekly entry repeats on `day` between dateFrom and dateTo.
const timetableSchema = new mongoose.Schema(
  {
    day: { type: String, required: [true, "day is required"], enum: DAYS },
    time: { type: String, trim: true },                    // "10:00-11:00", derived from start/end when those are set
    subject: { type: String, required: [true, "subject is required"], trim: true },
    faculty: { type: String, trim: true },                 // display name (legacy); kept in sync with facultyRef
    room: { type: String, trim: true },                    // display text (legacy); kept in sync with roomRef
    className: { type: String, default: "", trim: true },

    startMinutes: { type: Number, min: 0, max: 1440 },
    endMinutes: { type: Number, min: 0, max: 1440 },
    roomRef: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
    building: { type: mongoose.Schema.Types.ObjectId, ref: "Building" },
    facultyRef: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty" },
    courseRef: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
    course: { type: String, default: "", trim: true },
    semester: { type: String, default: "", trim: true },   // semester / academic year
    section: { type: String, default: "", trim: true },
    studentCount: { type: Number, min: [0, "studentCount cannot be negative"], default: 0 },
    classType: { type: String, enum: CLASS_TYPES, default: "lecture" },
    dateFrom: dateField,
    dateTo: dateField,
    requiredEquipment: [{ type: { type: String, enum: EQUIPMENT_TYPES }, minQuantity: { type: Number, min: 1, default: 1 }, _id: false }],
    specialRequirements: [{ type: String, trim: true }],
    status: { type: String, enum: ["active", "cancelled"], default: "active" },
    isDemo: { type: Boolean, default: false },             // generated sample data, NOT an official schedule
    needsReview: { type: Boolean, default: false },        // migrated legacy row that is not linked to a Room yet
  },
  { timestamps: true }
);

timetableSchema.pre("validate", function () {
  if (this.startMinutes == null && this.endMinutes == null && this.time) {
    const r = parseTimeRange(this.time);
    if (r) { this.startMinutes = r.start; this.endMinutes = r.end; }
  }
  if (this.startMinutes != null && this.endMinutes != null) {
    if (this.endMinutes <= this.startMinutes) this.invalidate("endMinutes", "end time must be after start time");
    this.time = `${formatHHMM(this.startMinutes)}-${formatHHMM(this.endMinutes)}`;
  }
  if (!this.time) this.invalidate("time", "time is required");
  if (!this.faculty && !this.facultyRef) this.invalidate("faculty", "faculty is required");
  if (!this.room && !this.roomRef) this.invalidate("room", "room is required");
  if (this.dateFrom && this.dateTo && this.dateFrom > this.dateTo) this.invalidate("dateTo", "dateTo cannot be before dateFrom");
});

timetableSchema.index({ roomRef: 1, day: 1 });
timetableSchema.index({ facultyRef: 1, day: 1 });
module.exports = mongoose.model("Timetable", timetableSchema);
