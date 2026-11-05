const express = require("express");
const Notification = require("../models/Notification");
const { protect } = require("../middleware/authMiddleware");
const { sendError, validateId } = require("../utils/helpers");
const router = express.Router();
router.use(protect);

// Users only ever see their OWN notifications.
router.get("/", async (req, res) => {
  try {
    const q = { user: req.user.id };
    if (req.query.unread === "true") q.readAt = null;
    const [items, unread] = await Promise.all([Notification.find(q).sort({ createdAt: -1 }).limit(100), Notification.countDocuments({ user: req.user.id, readAt: null })]);
    res.json({ unread, items });
  } catch (e) { sendError(res, e, "Failed to load notifications"); }
});
router.post("/read-all", async (req, res) => {
  try { await Notification.updateMany({ user: req.user.id, readAt: null }, { readAt: new Date() }); res.json({ message: "All notifications marked as read" }); }
  catch (e) { sendError(res, e, "Failed to update notifications"); }
});
router.patch("/:id/read", validateId, async (req, res) => {
  try {
    const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { readAt: new Date() }, { new: true });
    n ? res.json(n) : res.status(404).json({ message: "Notification not found" });
  } catch (e) { sendError(res, e, "Failed to update notification"); }
});
router.delete("/:id", validateId, async (req, res) => {
  try {
    const n = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    n ? res.json({ message: "Notification deleted" }) : res.status(404).json({ message: "Notification not found" });
  } catch (e) { sendError(res, e, "Failed to delete notification"); }
});
module.exports = router;
