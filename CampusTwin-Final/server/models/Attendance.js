const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: [true, "student is required"] },
    subject: { type: String, required: [true, "subject is required"], trim: true },
    totalClasses: { type: Number, default: 0, min: [0, "totalClasses cannot be negative"] },
    attended: { type: Number, default: 0, min: [0, "attended cannot be negative"] },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

attendanceSchema.index({ student: 1, subject: 1 }, { unique: true });

attendanceSchema.virtual("percentage").get(function () {
  if (!this.totalClasses) {
    return 0;
  }
  return Math.round((this.attended / this.totalClasses) * 100);
});

module.exports = mongoose.model("Attendance", attendanceSchema);
