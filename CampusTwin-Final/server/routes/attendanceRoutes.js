const express = require("express");
const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const { protect, authorize } = require("../middleware/authMiddleware");
const { sendError, validateId } = require("../utils/helpers");
const mongoose = require("mongoose");

const router = express.Router();

// GET /api/attendance/me  (student: own subject-wise attendance)
router.get("/me", protect, authorize("student"), async (req, res) => {
  try {
    const student = await Student.findOne({ email: req.user.email }).collation({
      locale: "en",
      strength: 2,
    });
    if (!student) {
      return res.json([]);
    }
    const records = await Attendance.find({ student: student._id }).sort({ subject: 1 });
    res.json(records);
  } catch (error) {
    sendError(res, error, "Failed to load attendance");
  }
});

// GET /api/attendance?student=<id>  (faculty/admin)
router.get("/", protect, authorize("faculty"), async (req, res) => {
  try {
    const filter = {};
    if (req.query.student) {
      if (!mongoose.isValidObjectId(req.query.student)) {
        return res.status(400).json({ message: "Invalid student id" });
      }
      filter.student = req.query.student;
    }
    const records = await Attendance.find(filter)
      .populate("student", "name registerNumber department section")
      .sort({ subject: 1 });
    res.json(records);
  } catch (error) {
    sendError(res, error, "Failed to load attendance");
  }
});

// POST /api/attendance/mark  (faculty/admin)
// Body: { student, subject, present: true | false }
// Adds one class for the subject, and one attended class when present is true.
router.post("/mark", protect, authorize("faculty"), async (req, res) => {
  try {
    const { student, subject, present } = req.body || {};

    if (!student || !mongoose.isValidObjectId(student)) {
      return res.status(400).json({ message: "A valid student is required" });
    }
    if (!subject || String(subject).trim() === "") {
      return res.status(400).json({ message: "subject is required" });
    }
    if (typeof present !== "boolean") {
      return res.status(400).json({ message: "present must be true or false" });
    }

    const exists = await Student.exists({ _id: student });
    if (!exists) {
      return res.status(404).json({ message: "Student not found" });
    }

    const record = await Attendance.findOneAndUpdate(
      { student, subject: String(subject).trim() },
      { $inc: { totalClasses: 1, attended: present ? 1 : 0 } },
      { new: true, upsert: true, runValidators: true }
    );
    res.status(201).json(record);
  } catch (error) {
    sendError(res, error, "Failed to mark attendance");
  }
});

// DELETE /api/attendance/:id  (admin only)
router.delete("/:id", protect, authorize(), validateId, async (req, res) => {
  try {
    const deleted = await Attendance.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Attendance record not found" });
    }
    res.json({ message: "Attendance record deleted successfully" });
  } catch (error) {
    sendError(res, error, "Failed to delete attendance");
  }
});

module.exports = router;
