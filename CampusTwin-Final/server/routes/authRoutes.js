const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");
const { sendError } = require("../utils/helpers");

const router = express.Router();

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createToken(user) {
  return jwt.sign(
    { id: user._id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role };
}

// POST /api/auth/register  (public sign-up always creates a STUDENT account)
// Faculty and admin accounts are created by an admin (see /api/users) or by the seed script.
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "name, email and password are required" });
    }
    if (!emailPattern.test(String(email))) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }
    if (String(password).length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const exists = await User.findOne({ email: String(email).toLowerCase() });
    if (exists) {
      return res.status(400).json({ message: "This email is already registered" });
    }

    const user = await User.create({
      name: String(name),
      email: String(email),
      password: String(password),
      role: "student",
    });

    res.status(201).json({
      message: "Registration successful",
      token: createToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    sendError(res, error, "Registration failed");
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({
      email: String(email).toLowerCase().trim(),
    }).select("+password");

    const passwordOk = user ? await user.matchPassword(String(password)) : false;

    if (!user || !passwordOk) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({
      message: "Login successful",
      token: createToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    sendError(res, error, "Login failed");
  }
});

// GET /api/auth/me  (checks the token and returns the current user)
router.get("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ message: "Account no longer exists" });
    }
    res.json({ user: publicUser(user) });
  } catch (error) {
    sendError(res, error, "Failed to load profile");
  }
});

module.exports = router;
