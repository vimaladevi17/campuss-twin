// Socket.IO authentication and room-isolation tests (no database needed).
process.env.JWT_SECRET = "test-secret-socket";
process.env.NODE_ENV = "test";
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const jwt = require("jsonwebtoken");
const { io: connect } = require("socket.io-client");
const { attach } = require("../realtime/socket");
const realtime = require("../utils/realtime");
const Notification = require("../models/Notification");

// The sync message reads the DB; stub it so the suite runs offline.
Notification.countDocuments = async () => 3;

let server, io, port;
const sign = (p, secret = process.env.JWT_SECRET, opt = {}) => jwt.sign(p, secret, opt);
const client = (auth) => connect(`http://127.0.0.1:${port}`, { auth, transports: ["websocket"], reconnection: false, forceNew: true });
const once = (s, ev) => new Promise((res) => s.once(ev, res));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test.before(async () => {
  server = http.createServer();
  io = attach(server, { corsOrigin: "*" });
  await new Promise((r) => server.listen(0, r));
  port = server.address().port;
});
test.after(async () => { io.close(); server.close(); });

test("rejects a connection with no token", async () => {
  const s = client({});
  const err = await once(s, "connect_error");
  assert.equal(err.message, "Authentication failed");
  s.close();
});
test("rejects a forged token (wrong secret)", async () => {
  const s = client({ token: sign({ id: "a".repeat(24), role: "admin" }, "wrong-secret") });
  assert.equal((await once(s, "connect_error")).message, "Authentication failed");
  s.close();
});
test("rejects an expired token", async () => {
  const s = client({ token: sign({ id: "a".repeat(24), role: "admin" }, process.env.JWT_SECRET, { expiresIn: -10 }) });
  assert.equal((await once(s, "connect_error")).message, "Authentication failed");
  s.close();
});
test("rejects a token with an unknown role", async () => {
  const s = client({ token: sign({ id: "a".repeat(24), role: "superuser" }) });
  assert.equal((await once(s, "connect_error")).message, "Authentication failed");
  s.close();
});
test("accepts a valid token and sends the unread count for reconnect sync", async () => {
  const s = client({ token: sign({ id: "a".repeat(24), role: "faculty" }) });
  const sync = await once(s, "notification:sync");
  assert.equal(sync.unread, 3);
  s.close();
});
test("a user receives only their own notifications", async () => {
  const idA = "a".repeat(24), idB = "b".repeat(24);
  const a = client({ token: sign({ id: idA, role: "faculty" }) });
  const b = client({ token: sign({ id: idB, role: "faculty" }) });
  await Promise.all([once(a, "notification:sync"), once(b, "notification:sync")]);
  let bGot = 0; b.on("notification:new", () => bGot++);
  const aGot = once(a, "notification:new");
  realtime.emit("notification:new", { title: "for A" }, `user:${idA}`);
  assert.equal((await aGot).title, "for A");
  await wait(150);
  assert.equal(bGot, 0);
  a.close(); b.close();
});
test("a client cannot join another user's room or an arbitrary room", async () => {
  const s = client({ token: sign({ id: "c".repeat(24), role: "student" }) });
  await once(s, "notification:sync");
  const bad = await new Promise((r) => s.emit("subscribe", `user:${"a".repeat(24)}`, r));
  assert.equal(bad.ok, false);
  const bad2 = await new Promise((r) => s.emit("subscribe", "role:admin", r));
  assert.equal(bad2.ok, false);
  const good = await new Promise((r) => s.emit("subscribe", `building:${"d".repeat(24)}`, r));
  assert.equal(good.ok, true);
  let leaked = 0; s.on("notification:new", () => leaked++);
  realtime.emit("notification:new", { title: "secret" }, `user:${"a".repeat(24)}`);
  await wait(150);
  assert.equal(leaked, 0);
  s.close();
});
test("role rooms reach only that role", async () => {
  const admin = client({ token: sign({ id: "e".repeat(24), role: "admin" }) });
  const stu = client({ token: sign({ id: "f".repeat(24), role: "student" }) });
  await Promise.all([once(admin, "notification:sync"), once(stu, "notification:sync")]);
  let stuGot = 0; stu.on("admin:alert", () => stuGot++);
  const adminGot = once(admin, "admin:alert");
  realtime.emit("admin:alert", { x: 1 }, "role:admin");
  await adminGot; await wait(150);
  assert.equal(stuGot, 0);
  admin.close(); stu.close();
});
