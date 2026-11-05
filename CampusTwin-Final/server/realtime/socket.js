// Socket.IO with JWT-authenticated connections and server-controlled rooms.
//
// Rooms a socket is placed in automatically (clients cannot choose them):
//   auth            every authenticated socket (non-sensitive "something changed" signals, ids only)
//   user:<id>       the user's own notifications
//   role:<role>     role-wide announcements (admin, faculty, student)
// Clients may only ask to join "building:<id>" style channels through `subscribe`, and the
// server rejects anything other than a short allow-list, so nobody can listen on another user's room.
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const realtime = require("../utils/realtime");
const Notification = require("../models/Notification");

const ROLES = ["student", "faculty", "admin"];
const SUBSCRIBABLE = /^(building|room):[a-f0-9]{24}$/;

function verifyToken(token) {
  if (!token || typeof token !== "string") throw new Error("Authentication token missing");
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (!payload.id || !ROLES.includes(payload.role)) throw new Error("Invalid token payload");
  return payload;
}

function authMiddleware(socket, next) {
  try {
    const raw = socket.handshake.auth && socket.handshake.auth.token;
    const header = socket.handshake.headers && socket.handshake.headers.authorization;
    socket.user = verifyToken(raw || (header && header.startsWith("Bearer ") ? header.slice(7) : null));
    next();
  } catch (e) {
    const err = new Error("Authentication failed");
    err.data = { code: "AUTH_FAILED" };
    next(err);
  }
}

function attach(httpServer, { corsOrigin } = {}) {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin || process.env.CLIENT_URL || "http://localhost:5173" },
    // Lets a briefly disconnected client resume without losing events (best effort; REST sync covers the rest).
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000, skipMiddlewares: false },
  });
  io.use(authMiddleware);

  io.on("connection", async (socket) => {
    const { id, role } = socket.user;
    socket.join(["auth", `user:${id}`, `role:${role}`]);

    // Tell the client how many unread items exist so it can sync after a reconnect.
    try {
      const unread = await Notification.countDocuments({ user: id, readAt: null });
      socket.emit("notification:sync", { unread, serverTime: new Date().toISOString() });
    } catch (_) { /* REST fallback still works */ }

    socket.on("subscribe", (channel, ack) => {
      const ok = typeof channel === "string" && SUBSCRIBABLE.test(channel);
      if (ok) socket.join(channel);
      if (typeof ack === "function") ack({ ok, error: ok ? undefined : "Channel not allowed" });
    });
    socket.on("unsubscribe", (channel) => { if (typeof channel === "string" && SUBSCRIBABLE.test(channel)) socket.leave(channel); });
    // Marking read over the socket is limited to the caller's own notifications.
    socket.on("notification:read", async (notificationId, ack) => {
      try {
        const n = await Notification.findOneAndUpdate({ _id: notificationId, user: id }, { readAt: new Date() }, { new: true });
        if (typeof ack === "function") ack({ ok: Boolean(n) });
        if (n) io.to(`user:${id}`).emit("notification:read", { id: String(n._id) });
      } catch (_) { if (typeof ack === "function") ack({ ok: false }); }
    });
  });

  realtime.setIO(io);
  return io;
}

module.exports = { attach, authMiddleware, verifyToken };
