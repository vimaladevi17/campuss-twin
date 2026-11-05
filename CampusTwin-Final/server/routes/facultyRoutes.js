const express = require("express");
const Faculty = require("../models/Faculty");
const createCrudRouter = require("./crudRouter");
const { protect, authorize } = require("../middleware/authMiddleware");
const { sendError } = require("../utils/helpers");

const router = express.Router();

// GET /api/faculty/me  -> the faculty record that matches the logged-in faculty email
router.get("/me", protect, authorize("faculty"), async (req, res) => {
  try {
    const record = await Faculty.findOne({ email: req.user.email }).collation({
      locale: "en",
      strength: 2,
    });
    if (!record) {
      return res
        .status(404)
        .json({ message: "No faculty profile is linked to this account yet" });
    }
    res.json(record);
  } catch (error) {
    sendError(res, error, "Failed to load faculty profile");
  }
});

router.use(
  "/",
  createCrudRouter(Faculty, {
    label: "Faculty member",
    fields: ["name", "department", "designation", "email", "phone", "cabin", "specialization", "image"],
    required: ["name", "department", "designation", "email"],
    sort: { name: 1 },
  })
);

module.exports = router;
