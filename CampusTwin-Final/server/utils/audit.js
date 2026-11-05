const AuditLog = require("../models/AuditLog");
// Best-effort: an audit failure must never break the user's request.
async function audit(req, action, entity, entityId, details) {
  try {
    await AuditLog.create({
      actor: req.user && req.user.id, actorName: req.user && req.user.name,
      action, entity, entityId: entityId ? String(entityId) : undefined, details, ip: req.ip,
    });
  } catch (e) { console.error("audit log failed:", e.message); }
}
module.exports = { audit };
