const express = require("express");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/authMiddleware");
const { sendError, validateId, pick } = require("../utils/helpers");

const router = express.Router();

// Everything here is admin only
router.use(protect, authorize());

const roles = ["student", "faculty", "admin"];

router.get("/", async (req, res) => {
  try {
    res.json(await User.find().sort({ createdAt: -1 }));
  } catch (error) {
    sendError(res, error, "Failed to fetch users");
  }
});

router.post("/", async (req, res) => {
  try {
    const data = pick(req.body, ["name", "email", "password", "role"]);
    if (!data.name || !data.email || !data.password) {
      return res
        .status(400)
        .json({ message: "name, email and password are required" });
    }
    if (data.role && !roles.includes(data.role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    const user = await User.create(data);
    res.status(201).json(user);
  } catch (error) {
    sendError(res, error, "Failed to create user");
  }
});

router.put("/:id", validateId, async (req, res) => {
  try {
    const data = pick(req.body, ["name", "email", "password", "role"]);
    if (data.role && !roles.includes(data.role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    if (data.password !== undefined && String(data.password).trim() === "") {
      delete data.password; // blank password means "keep the old one"
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (String(user._id) === req.user.id && data.role && data.role !== "admin") {
      return res
        .status(400)
        .json({ message: "You cannot remove your own admin role" });
    }
    Object.assign(user, data);
    await user.save();
    res.json(user);
  } catch (error) {
    sendError(res, error, "Failed to update user");
  }
});

router.delete("/:id", validateId, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    sendError(res, error, "Failed to delete user");
  }
});

module.exports = router;
