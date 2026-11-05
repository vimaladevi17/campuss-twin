const express = require("express");
const Settings = require("../models/CampusSettings");
const { protect, authorize } = require("../middleware/authMiddleware");
const { sendError, pick } = require("../utils/helpers");
const realtime = require("../utils/realtime");
const { audit } = require("../utils/audit");
const router = express.Router();

router.get("/", async (req, res) => { try { res.json(await Settings.get()); } catch (e) { sendError(res, e, "Failed to load settings"); } }); // public: campus name/area/centre
router.put("/", protect, authorize(), async (req, res) => {
  try {
    const s = await Settings.get();
    const data = pick(req.body, ["name", "totalAreaSqm", "openSpaceRatioPct", "referencePoint", "scoringWeights", "maxRecommendedWalkM", "walkingSpeedMps", "dayStartMinutes", "dayEndMinutes", "turnoverBufferMin"]);
    if (data.scoringWeights) {
      const w = { ...s.scoringWeights.toObject(), ...data.scoringWeights };
      if (Object.values(w).some((v) => typeof v !== "number" || v < 0) || Object.values(w).reduce((a, b) => a + b, 0) <= 0)
        return res.status(400).json({ message: "Scoring weights must be non-negative numbers with a positive total" });
      data.scoringWeights = w;
    }
    s.set(data); await s.save();
    await audit(req, "update", "settings", s._id);
    realtime.emit("settings:updated", {});
    res.json(s);
  } catch (e) { sendError(res, e, "Failed to save settings"); }
});
module.exports = router;
