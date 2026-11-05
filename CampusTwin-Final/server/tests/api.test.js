// API guard + validation tests. They need NO database: every case is rejected (or answered) before a query runs.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const app = require("../app");

const tok = (role) => jwt.sign({ id: "64b000000000000000000001", name: "T", email: "t@x.com", role }, process.env.JWT_SECRET);
const as = (role) => ({ Authorization: `Bearer ${tok(role)}` });
const ID = "64b0000000000000000000aa";

const expect = (name, make, status) => test(name, async () => { const r = await make(); assert.equal(r.status, status, JSON.stringify(r.body)); });

// authentication required
for (const [m, u] of [["get", "/api/rooms"], ["get", "/api/floors"], ["get", "/api/timetable"], ["get", "/api/availability"], ["get", "/api/availability/vacant"],
  ["get", "/api/notifications"], ["get", "/api/audit-logs"], ["get", "/api/replacements"], ["get", "/api/maintenance"], ["get", "/api/reservations"], ["post", "/api/buildings"], ["put", `/api/settings`]])
  expect(`401 without token: ${m.toUpperCase()} ${u}`, () => request(app)[m](u), 401);

// role enforcement happens on the server
expect("student cannot create a building", () => request(app).post("/api/buildings").set(as("student")).send({ code: "X", name: "X" }), 403);
expect("faculty cannot create a room", () => request(app).post("/api/rooms").set(as("faculty")).send({}), 403);
expect("faculty cannot write the timetable", () => request(app).post("/api/timetable").set(as("faculty")).send({}), 403);
expect("student cannot read audit log", () => request(app).get("/api/audit-logs").set(as("student")), 403);
expect("faculty cannot run replacement analysis", () => request(app).post("/api/replacements/analyze").set(as("faculty")).send({}), 403);
expect("student cannot read maintenance", () => request(app).get("/api/maintenance").set(as("student")), 403);
expect("student cannot create reservations", () => request(app).post("/api/reservations").set(as("student")).send({}), 403);
expect("student cannot approve reservations", () => request(app).post(`/api/reservations/${ID}/approve`).set(as("student")), 403);
expect("student cannot update settings", () => request(app).put("/api/settings").set(as("student")).send({}), 403);
expect("student cannot add facilities", () => request(app).post("/api/facilities").set(as("student")).send({}), 403);

// validation (admin)
expect("building requires code", () => request(app).post("/api/buildings").set(as("admin")).send({ name: "x" }), 400);
expect("room requires capacity", () => request(app).post("/api/rooms").set(as("admin")).send({ roomNumber: "1", building: ID }), 400);
expect("floor requires number", () => request(app).post("/api/floors").set(as("admin")).send({ building: ID }), 400);
expect("facility requires location", () => request(app).post("/api/facilities").set(as("admin")).send({ name: "x", category: "food" }), 400);
expect("facility rejects swapped lat/lng", () => request(app).post("/api/facilities").set(as("admin")).send({ name: "x", category: "food", location: { type: "Point", coordinates: [9.57, 177.6] } }), 400);
expect("invalid ids are rejected", () => request(app).get("/api/rooms/not-an-id").set(as("admin")), 400);
expect("invalid id on building overview", () => request(app).get("/api/buildings/zzz/overview").set(as("admin")), 400);
expect("timetable rejects bad start time", () => request(app).post("/api/timetable").set(as("admin")).send({ day: "Monday", subject: "x", startTime: "99:99", endTime: "10:00" }), 400);
expect("timetable rejects bad day", () => request(app).post("/api/timetable").set(as("admin")).send({ day: "Funday", subject: "x", time: "10:00-11:00" }), 400);
expect("timetable rejects end before start", () => request(app).post("/api/timetable").set(as("admin")).send({ day: "Monday", subject: "x", time: "11:00-10:00" }), 400);
expect("timetable date filter must be a date", () => request(app).get("/api/timetable?date=tomorrow").set(as("student")), 400);
expect("vacancy needs a valid date", () => request(app).get("/api/availability/vacant?date=nope&startTime=10:00&endTime=11:00").set(as("student")), 400);
expect("vacancy needs valid times", () => request(app).get("/api/availability/vacant?date=2026-11-02&startTime=11:00&endTime=10:00").set(as("student")), 400);
expect("replacement analyze needs room/startAt/endAt", () => request(app).post("/api/replacements/analyze").set(as("admin")).send({ room: ID }), 400);
expect("replacement analyze rejects invalid dates", () => request(app).post("/api/replacements/analyze").set(as("admin")).send({ room: ID, startAt: "x", endAt: "y" }), 400);
expect("approve needs selections or useSuggested", () => request(app).post(`/api/replacements/${ID}/approve`).set(as("admin")).send({ selections: [{ foo: 1 }] }), 400);
expect("maintenance needs a room or building", () => request(app).post("/api/maintenance").set(as("admin")).send({ reason: "x", startAt: "2026-11-02T04:30:00Z", endAt: "2026-11-02T06:30:00Z" }), 400);
expect("reservation validates fields", () => request(app).post("/api/reservations").set(as("faculty")).send({ title: "x" }), 400);
expect("reservation end must follow start", () => request(app).post("/api/reservations").set(as("faculty")).send({ room: ID, title: "x", date: "2026-11-02", startTime: "11:00", endTime: "10:00" }), 400);

// existing behaviour preserved
expect("legacy: /api/auth/me still guarded", () => request(app).get("/api/auth/me"), 401);
expect("legacy: unknown api route is 404", () => request(app).get("/api/nope"), 404);
test("helmet security headers are set", async () => { const r = await request(app).get("/"); assert.ok(r.headers["x-content-type-options"]); assert.equal(r.headers["x-powered-by"], undefined); });
test("malformed JSON gives 400", async () => { const r = await request(app).post("/api/auth/login").set("Content-Type", "application/json").send("{bad"); assert.equal(r.status, 400); });
