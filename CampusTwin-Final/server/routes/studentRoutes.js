const express = require("express");
const Student = require("../models/Student");
const createCrudRouter = require("./crudRouter");
const { protect, authorize } = require("../middleware/authMiddleware");
const { sendError } = require("../utils/helpers");

const router = express.Router();

// GET /api/students/me  -> the student record that matches the logged-in student email
router.get("/me", protect, authorize("student"), async (req, res) => {
  try {
    const record = await Student.findOne({ email: req.user.email }).collation({
      locale: "en",
      strength: 2,
    });
    if (!record) {
      return res
        .status(404)
        .json({ message: "No student profile is linked to this account yet" });
    }
    res.json(record);
  } catch (error) {
    sendError(res, error, "Failed to load student profile");
  }
});

// Faculty and admin can list students. Only admin can add, edit or delete.
router.use(
  "/",
  createCrudRouter(Student, {
    label: "Student",
    fields: ["name", "registerNumber", "email", "department", "year", "section", "attendance"],
    required: ["name", "registerNumber", "email", "department", "year", "section"],
    sort: { createdAt: 1 },
    readRoles: ["faculty"],
  })
);

module.exports = router;
