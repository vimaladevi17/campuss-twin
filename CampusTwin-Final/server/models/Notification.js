const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, default: "info", trim: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, default: "", trim: true },
    link: { type: String, default: "", trim: true },
    meta: Object,
    readAt: Date,
    // Same key for the same user = same notification. Prevents duplicates when an action is retried.
    dedupeKey: { type: String, trim: true },
  },
  { timestamps: true }
);
schema.index({ user: 1, readAt: 1, createdAt: -1 });
schema.index({ user: 1, dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } });
module.exports = mongoose.model("Notification", schema);
