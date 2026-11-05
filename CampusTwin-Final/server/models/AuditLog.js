const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actorName: String,
    action: { type: String, required: true }, // create | update | delete | approve | reject | import ...
    entity: { type: String, required: true },
    entityId: String,
    details: Object,
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
schema.index({ entity: 1, createdAt: -1 });
module.exports = mongoose.model("AuditLog", schema);
