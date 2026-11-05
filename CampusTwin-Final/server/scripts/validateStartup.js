// Startup validation. Run from /server:  npm run validate:startup
// Checks the environment, boots the HTTP + Socket.IO server on a free port, calls the API, tests a socket
// handshake, and pings MongoDB only when MONGO_URI is set. Exit code 1 if any check fails.
const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
require("dotenv").config();
const http = require("http");
const jwt = require("jsonwebtoken");
const { io: connect } = require("socket.io-client");

const results = [];
const check = (name, ok, note = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? "  (" + note + ")" : ""}`); };
const skip = (name, why) => console.log(`SKIP  ${name}  (${why})`);

(async () => {
  const secret = process.env.JWT_SECRET || "startup-check-secret";
  process.env.JWT_SECRET = secret;
  check("JWT_SECRET is set in .env", Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET !== "startup-check-secret"), process.env.MONGO_URI ? "" : "using a temporary secret for this check");
  const app = require("../app");
  const { attach } = require("../realtime/socket");
  const server = http.createServer(app);
  const io = attach(server);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const get = (p) => new Promise((res, rej) => http.get({ port, path: p }, (r) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => res({ status: r.statusCode, body: b })); }).on("error", rej));
  const root = await get("/");
  check("GET / answers", root.status === 200);
  check("protected route needs login (401)", (await get("/api/rooms")).status === 401);
  check("unknown API route returns 404", (await get("/api/nope")).status === 404);
  const bad = connect(`http://127.0.0.1:${port}`, { auth: { token: "bad" }, reconnection: false, transports: ["websocket"] });
  check("socket rejects a bad token", await new Promise((r) => { bad.on("connect_error", () => r(true)); bad.on("connect", () => r(false)); }));
  bad.close();
  const good = connect(`http://127.0.0.1:${port}`, { auth: { token: jwt.sign({ id: "a".repeat(24), role: "admin" }, secret) }, reconnection: false, transports: ["websocket"] });
  check("socket accepts a valid token", await new Promise((r) => { good.on("connect", () => r(true)); good.on("connect_error", () => r(false)); }));
  good.close(); io.close(); server.close();

  if (process.env.MONGO_URI) {
    const mongoose = require("mongoose");
    try { await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 }); await mongoose.connection.db.admin().ping(); check("MongoDB connection", true); await mongoose.disconnect(); }
    catch (e) { check("MongoDB connection", false, e.message); }
  } else skip("MongoDB connection", "MONGO_URI is not set");
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\n${failed} check(s) failed` : `\nAll ${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
