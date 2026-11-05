// Frontend <-> backend contract: every API URL the React code calls must exist on the Express app.
// Runs without a database (DB calls fail fast with 500, which still proves the route exists; a missing route is 404).
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const mongoose = require("mongoose");
mongoose.set("bufferCommands", false);
const app = require("../app");

const SRC = path.join(__dirname, "..", "..", "client", "src");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(SRC).filter((f) => /\.(jsx?|js)$/.test(f) && !/\.test\./.test(f));
const ID = "64b0000000000000000000aa";
const clean = (u) => u.replace(/\$\{[^}]*\}/g, ID).split("?")[0];

const calls = new Map();   // "METHOD url" -> file
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/\bhttp\s*\.(get|post|put|patch|delete)\(\s*[`"'](\/[^`"']*)[`"']/g)) calls.set(`${m[1].toUpperCase()} ${clean(m[2])}`, f);
  // config-driven admin screens: endpoint -> list/create/update/delete
  for (const m of src.matchAll(/(?:endpoint|param)?\s*endpoint:\s*"(\/[^"]+)"/g)) {
    if (!/resources\.js$/.test(f)) continue;
    for (const meth of ["GET", "POST"]) calls.set(`${meth} ${m[1]}`, f);
    for (const meth of ["PUT", "DELETE"]) calls.set(`${meth} ${m[1]}/${ID}`, f);
  }
}
const auth = { Authorization: `Bearer ${jwt.sign({ id: "64b000000000000000000001", name: "A", email: "a@x.com", role: "admin" }, process.env.JWT_SECRET)}` };

test("found a realistic number of frontend API calls", () => assert.ok(calls.size > 40, `only ${calls.size} calls found`));

for (const [key, file] of calls) {
  const [method, url] = key.split(" ");
  test(`frontend calls ${key} -> route exists (${path.relative(SRC, file)})`, async () => {
    const r = await request(app)[method.toLowerCase()](`/api${url}`).set(auth).send(method === "GET" || method === "DELETE" ? undefined : {});
    assert.notEqual(r.status, 404, `Backend has no route for ${key}: ${JSON.stringify(r.body)}`);
  });
}
