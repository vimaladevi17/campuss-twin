const Notification = require("../models/Notification");
const User = require("../models/User");
const Faculty = require("../models/Faculty");
const realtime = require("../utils/realtime");

// dedupeKey (optional): a second call with the same key for the same user is ignored.
async function notifyUsers(userIds, { type, title, message, link, meta, dedupeKey }) {
  const ids = [...new Set(userIds.map(String))];
  if (!ids.length) return [];
  let docs;
  try {
    docs = await Notification.insertMany(ids.map((user) => ({ user, type, title, message, link, meta, dedupeKey })), { ordered: false });
  } catch (e) {
    // Duplicate-key errors are expected when dedupeKey repeats; keep the rows that did insert.
    if (e.code === 11000 || (e.writeErrors && e.writeErrors.every((w) => w.code === 11000))) docs = e.insertedDocs || [];
    else throw e;
  }
  docs.forEach((d) => realtime.emit("notification:new", d.toJSON(), `user:${d.user}`));
  return docs;
}
async function adminIds() { return (await User.find({ role: "admin" }).select("_id").lean()).map((u) => u._id); }
// Faculty records link to login accounts by email.
async function userIdsForFaculty(facultyIds) {
  const f = await Faculty.find({ _id: { $in: facultyIds } }).select("email").lean();
  const emails = f.map((x) => String(x.email).toLowerCase());
  return (await User.find({ email: { $in: emails } }).select("_id").lean()).map((u) => u._id);
}
module.exports = { notifyUsers, adminIds, userIdsForFaculty };
