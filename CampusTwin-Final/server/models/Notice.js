const mongoose = require("mongoose");

const noticeSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, "title is required"], trim: true },
    description: { type: String, required: [true, "description is required"], trim: true },
    category: {
      type: String,
      enum: ["General", "Academic", "Exam", "Event", "Placement", "Urgent"],
      default: "General",
    },
    date: { type: String, default: () => new Date().toISOString().slice(0, 10) },
    priority: { type: String, enum: ["Low", "Normal", "High"], default: "Normal" },
    createdBy: { type: String, default: "Admin", trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notice", noticeSchema);
