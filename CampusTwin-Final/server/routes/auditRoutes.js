const express = require("express");
const AuditLog = require("../models/AuditLog");
const { protect, authorize } = require("../middleware/authMiddleware");
const { sendError } = require("../utils/helpers");
const router = express.Router();
router.get("/", protect, authorize(), async (req, res) => {
  try {
    const q = {};
    if (req.query.entity) q.entity = req.query.entity;
    if (req.query.action) q.action = req.query.action;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1), limit = Math.min(200, parseInt(req.query.limit, 10) || 50);
    const [items, total] = await Promise.all([AuditLog.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), AuditLog.countDocuments(q)]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (e) { sendError(res, e, "Failed to load audit log"); }
});
module.exports = router;
