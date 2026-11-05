// Checks routing, JWT guards and validation. It does NOT need MongoDB.
process.env.JWT_SECRET = "test-secret";
const jwt = require("jsonwebtoken");
const request = require("supertest");
const app = require("../app");

const sign = (role) =>
  jwt.sign({ id: "64b000000000000000000001", name: "T", email: "t@x.com", role }, process.env.JWT_SECRET);

let failed = 0;
async function check(name, promise, expected) {
  const res = await promise;
  const ok = res.status === expected;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  (got ${res.status}, expected ${expected})`);
}

(async () => {
  const admin = sign("admin"), student = sign("student"), faculty = sign("faculty");
  const auth = (t) => ({ Authorization: `Bearer ${t}` });

  await check("root works", request(app).get("/"), 200);
  await check("unknown api route", request(app).get("/api/nothing"), 404);
  await check("bad JSON body", request(app).post("/api/auth/login").set("Content-Type", "application/json").send("{bad"), 400);
  await check("login without body", request(app).post("/api/auth/login").send({}), 400);
  await check("register missing fields", request(app).post("/api/auth/register").send({ email: "a@b.com" }), 400);
  await check("register bad email", request(app).post("/api/auth/register").send({ name: "A", email: "nope", password: "123456" }), 400);
  await check("register short password", request(app).post("/api/auth/register").send({ name: "A", email: "a@b.com", password: "123" }), 400);

  await check("events POST no token", request(app).post("/api/events").send({}), 401);
  await check("events POST student", request(app).post("/api/events").set(auth(student)).send({}), 403);
  await check("events POST faculty", request(app).post("/api/events").set(auth(faculty)).send({}), 403);
  await check("events POST admin empty", request(app).post("/api/events").set(auth(admin)).send({}), 400);
  await check("events PUT bad id", request(app).put("/api/events/abc").set(auth(admin)).send({}), 400);
  await check("events DELETE bad id", request(app).delete("/api/events/abc").set(auth(admin)), 400);
  await check("events DELETE student", request(app).delete("/api/events/64b000000000000000000001").set(auth(student)), 403);
  await check("fake token", request(app).post("/api/events").set(auth("garbage")).send({}), 401);

  await check("faculty POST student", request(app).post("/api/faculty").set(auth(student)).send({}), 403);
  await check("labs POST faculty", request(app).post("/api/labs").set(auth(faculty)).send({}), 403);
  await check("notices POST student", request(app).post("/api/notices").set(auth(student)).send({}), 403);
  await check("labs POST admin empty", request(app).post("/api/labs").set(auth(admin)).send({}), 400);

  await check("students list no token", request(app).get("/api/students"), 401);
  await check("students list student", request(app).get("/api/students").set(auth(student)), 403);
  await check("students /me faculty", request(app).get("/api/students/me").set(auth(faculty)), 403);
  await check("students POST faculty", request(app).post("/api/students").set(auth(faculty)).send({}), 403);

  await check("users list student", request(app).get("/api/users").set(auth(student)), 403);
  await check("users list faculty", request(app).get("/api/users").set(auth(faculty)), 403);
  await check("users POST admin missing", request(app).post("/api/users").set(auth(admin)).send({ name: "x" }), 400);
  await check("users POST admin bad role", request(app).post("/api/users").set(auth(admin)).send({ name: "x", email: "x@y.com", password: "123456", role: "root" }), 400);
  await check("stats student", request(app).get("/api/stats").set(auth(student)), 403);
  await check("stats no token", request(app).get("/api/stats"), 401);

  await check("attendance mark student", request(app).post("/api/attendance/mark").set(auth(student)).send({}), 403);
  await check("attendance mark bad body", request(app).post("/api/attendance/mark").set(auth(faculty)).send({ student: "abc" }), 400);
  await check("attendance mark no present", request(app).post("/api/attendance/mark").set(auth(faculty)).send({ student: "64b000000000000000000001", subject: "DS" }), 400);
  await check("attendance list student", request(app).get("/api/attendance").set(auth(student)), 403);
  await check("timetable no token", request(app).get("/api/timetable"), 401);
  await check("timetable POST student", request(app).post("/api/timetable").set(auth(student)).send({}), 403);

  console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
  process.exit(failed ? 1 : 0);
})();
