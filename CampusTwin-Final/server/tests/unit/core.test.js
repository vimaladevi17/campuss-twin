const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("../../utils/time");
const G = require("../../utils/geo");
const A = require("../../services/availability");
const { checkEntryConflicts } = require("../../services/conflicts");
const R = require("../../services/replacement");
const D = require("../../services/distance");
const { withLocks } = require("../../services/locks");

/* ---------- time ---------- */
test("parseHHMM / parseTimeRange handle common formats", () => {
  assert.equal(T.parseHHMM("9:30"), 570);
  assert.equal(T.parseHHMM("2:15 pm"), 855);
  assert.equal(T.parseHHMM("12:00 AM"), 0);
  assert.equal(T.parseHHMM("25:00"), null);
  assert.deepEqual(T.parseTimeRange("10:00-11:00"), { start: 600, end: 660 });
  assert.deepEqual(T.parseTimeRange("9:00 AM – 10:30 AM"), { start: 540, end: 630 });
  assert.equal(T.parseTimeRange("11:00-10:00"), null);
  assert.equal(T.parseTimeRange("nonsense"), null);
});
test("campus time is IST and date maths is correct", () => {
  assert.equal(T.weekdayOf("2026-11-02"), "Monday");
  assert.equal(T.addDays("2026-02-28", 1), "2026-03-01");
  const iv = T.slotToInterval("2026-11-02", 600, 660);
  assert.deepEqual(T.toCampusParts(iv.start), { date: "2026-11-02", minutes: 600, day: "Monday" });
  assert.equal(T.isDateStr("2026-02-30"), false);
  assert.equal(T.rangesIntersect("2026-01-01", "2026-03-01", "2026-03-01", null), true);
  assert.equal(T.rangesIntersect("2026-01-01", "2026-02-01", "2026-03-01", null), false);
});
test("overlap is half-open: back-to-back slots do not clash", () => {
  assert.equal(T.overlaps({ start: 10, end: 11 }, { start: 11, end: 12 }), false);
  assert.equal(T.overlaps({ start: 10, end: 12 }, { start: 11, end: 13 }), true);
});

/* ---------- geo ---------- */
test("geometry validation", () => {
  assert.equal(G.validateGeometry({ type: "Point", coordinates: [77.67, 9.57] }), null);
  assert.ok(G.validateGeometry({ type: "Point", coordinates: [9.57, 177.67] }));
  const ring = [[0, 0], [0, 1], [1, 1], [0, 0]];
  assert.equal(G.validateGeometry({ type: "Polygon", coordinates: [ring] }), null);
  assert.ok(G.validateGeometry({ type: "Polygon", coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0]]] })); // not closed
  const sq = { type: "Polygon", coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] };
  assert.deepEqual(G.representativePoint(sq).map(Math.round), [1, 1]);
  assert.ok(Math.abs(G.haversine([77.6761, 9.5743], [77.6761, 9.5753]) - 111) < 2);
});

/* ---------- fixtures ---------- */
const DATE = "2026-11-02"; // Monday
const rooms = [
  { _id: "labA", building: "b1", type: "laboratory", labCategory: "computing", capacity: 60, roomNumber: "A", equipment: [{ type: "desktop_computer", quantity: 60, workingQuantity: 60 }], specialFacilities: ["air_conditioned"] },
  { _id: "labB", building: "b1", type: "laboratory", labCategory: "computing", capacity: 70, roomNumber: "B", equipment: [{ type: "desktop_computer", quantity: 70, workingQuantity: 70 }], specialFacilities: ["air_conditioned"] },
  { _id: "labC", building: "b2", type: "laboratory", labCategory: "computing", capacity: 40, roomNumber: "C", equipment: [{ type: "desktop_computer", quantity: 40, workingQuantity: 40 }] },
  { _id: "labD", building: "b2", type: "laboratory", labCategory: "electronics", capacity: 80, roomNumber: "D", equipment: [{ type: "electronics", quantity: 30 }] },
  { _id: "labE", building: "b2", type: "laboratory", labCategory: "computing", capacity: 80, roomNumber: "E", equipment: [{ type: "desktop_computer", quantity: 80, workingQuantity: 10 }] },
  { _id: "labF", building: "b2", type: "laboratory", labCategory: "computing", capacity: 80, roomNumber: "F", maintenanceStatus: "under_maintenance", equipment: [{ type: "desktop_computer", quantity: 80 }] },
];
const buildings = new Map([["b1", { _id: "b1", name: "8th Block", code: "B8", location: { coordinates: [77.6756, 9.575] } }],
                           ["b2", { _id: "b2", name: "5th Block", code: "B5", location: { coordinates: [77.6758, 9.5738] } }]]);
const entry = (o) => ({ _id: "e" + Math.random(), day: "Monday", status: "active", subject: "S", faculty: "F1", roomRef: "labA", startMinutes: 600, endMinutes: 720, studentCount: 50, requiredEquipment: [{ type: "desktop_computer", minQuantity: 50 }], ...o });

/* ---------- availability ---------- */
test("a class 10:00-11:00 blocks every overlapping window but not adjacent ones", () => {
  const tt = [entry({ _id: "e1", endMinutes: 660 })];
  const busy = A.buildBusy({ dateStr: DATE, rooms, timetable: tt });
  const free = (s, e) => A.findVacantRooms({ dateStr: DATE, startMin: s, endMin: e, rooms: [rooms[0]], busy }).length === 1;
  assert.equal(free(570, 630), false); assert.equal(free(630, 690), false); assert.equal(free(600, 660), false); assert.equal(free(540, 720), false);
  assert.equal(free(660, 720), true); assert.equal(free(540, 600), true);
});
test("timetable respects weekday and date range", () => {
  const tt = [entry({ dateFrom: "2026-11-09", dateTo: "2026-12-01" }), entry({ day: "Tuesday" })];
  assert.equal(A.entriesOnDate(DATE, tt).length, 0);
  assert.equal(A.entriesOnDate("2026-11-09", tt).length, 1);
});
test("maintenance and reservations block; cancelled entries do not", () => {
  const maintenance = [{ _id: "m1", room: "labB", reason: "AC", status: "scheduled", startAt: T.slotToInterval(DATE, 600, 600).start, endAt: T.slotToInterval(DATE, 720, 720).start }];
  const reservations = [{ _id: "r1", room: "labC", status: "approved", date: DATE, startMinutes: 540, endMinutes: 600, title: "Seminar" }, { _id: "r2", room: "labD", status: "pending", date: DATE, startMinutes: 540, endMinutes: 600, title: "x" }];
  const tt = [entry({ roomRef: "labD", status: "cancelled" })];
  const busy = A.buildBusy({ dateStr: DATE, rooms, timetable: tt, maintenance, reservations });
  const w = { dateStr: DATE, startMin: 540, endMin: 660, rooms, busy };
  const ids = A.findVacantRooms(w).map((x) => x.room._id);
  assert.ok(!ids.includes("labB") && !ids.includes("labC") && !ids.includes("labF"));
  assert.ok(ids.includes("labD") && ids.includes("labA"));
});
test("vacancy filters: capacity, equipment, type, free slots", () => {
  const tt = [entry({ roomRef: "labA", startMinutes: 540, endMinutes: 600 })];
  const busy = A.buildBusy({ dateStr: DATE, rooms, timetable: tt });
  const r = A.findVacantRooms({ dateStr: DATE, startMin: 700, endMin: 760, rooms, busy, filters: { minCapacity: 65, equipment: [{ type: "desktop_computer", minQuantity: 60 }] } });
  assert.deepEqual(r.map((x) => x.room._id), ["labB"]); // labE has only 10 working PCs
  const a = A.findVacantRooms({ dateStr: DATE, startMin: 700, endMin: 760, rooms: [rooms[0]], busy })[0];
  assert.deepEqual(a.freeSlots, [{ start: 480, end: 540 }, { start: 600, end: 1080 }]);
});
test("approved room change moves occupancy to the new room for that date only", () => {
  const e = entry({ _id: "e9" });
  const changes = [{ status: "active", date: DATE, timetable: "e9", newRoom: "labB", originalRoom: "labA" }];
  const b1 = A.buildBusy({ dateStr: DATE, rooms, timetable: [e], changes });
  assert.equal(b1.get("labA").length, 0); assert.equal(b1.get("labB").length, 1);
  const b2 = A.buildBusy({ dateStr: "2026-11-09", rooms, timetable: [e], changes });
  assert.equal(b2.get("labA").length, 1); assert.equal(b2.get("labB").length, 0);
});
test("status now: maintenance / occupied / available", () => {
  const tt = [entry({ roomRef: "labA" })];
  const busy = A.buildBusy({ dateStr: DATE, rooms, timetable: tt });
  const at = T.slotToInterval(DATE, 630, 631).start;
  assert.equal(A.statusAt(busy.get("labA"), at).status, "occupied");
  assert.equal(A.statusAt(busy.get("labB"), at).status, "available");
  assert.equal(A.statusAt(busy.get("labF"), at).status, "maintenance");
});

/* ---------- conflicts ---------- */
test("conflict detection: room, faculty, section, capacity", () => {
  const existing = [entry({ _id: "x1", faculty: "Dr A", course: "CS", section: "A" })];
  const cand = { day: "Monday", startMinutes: 660, endMinutes: 780, roomRef: "labA", faculty: "dr a", course: "CS", section: "A", studentCount: 65 };
  const { errors } = checkEntryConflicts(cand, existing, rooms[0]);
  const codes = errors.map((e) => e.code).sort();
  assert.deepEqual(codes, ["capacity_exceeded", "faculty_double_booked", "room_double_booked", "section_double_booked"]);
  assert.equal(checkEntryConflicts({ ...cand, startMinutes: 720, endMinutes: 780, studentCount: 10 }, existing, rooms[0]).errors.length, 0);
  assert.equal(checkEntryConflicts({ ...cand, _id: "x1" }, existing, rooms[0]).errors.filter((e) => e.code === "room_double_booked").length, 0); // editing itself
  assert.equal(checkEntryConflicts({ ...cand, dateFrom: "2027-01-01" }, [entry({ _id: "x2", dateTo: "2026-12-01" })], rooms[0]).errors.filter((e) => e.code === "room_double_booked").length, 0);
});

/* ---------- replacement ---------- */
test("scoring components", () => {
  assert.equal(R.capacityScore(50, 60), 100);
  assert.ok(R.capacityScore(10, 80) < 10);
  assert.equal(R.distanceScore(0, 1000), 100);
  assert.equal(R.distanceScore(1000, 1000), 0);
  assert.equal(R.distanceScore(null, 1000), 0);
  const w = R.normaliseWeights({ availability: 4, equipment: 3, capacity: 2, distance: 1 });
  assert.ok(Math.abs(w.availability - 0.4) < 1e-9);
});
test("default scoring weights follow the specification (equipment 40, capacity 30, availability 20, distance 10)", () => {
  const w = R.normaliseWeights();
  assert.deepEqual([w.equipment, w.capacity, w.availability, w.distance].map((x) => Math.round(x * 100)), [40, 30, 20, 10]);
});
test("lab outage: affected classes, hard constraints, ranking, greedy suggestion", () => {
  const e1 = entry({ _id: "e1", subject: "Networks Lab", startMinutes: 600, endMinutes: 720, studentCount: 50 });
  const e2 = entry({ _id: "e2", subject: "DBMS Lab", faculty: "F2", startMinutes: 630, endMinutes: 690, studentCount: 55 });
  const occupier = entry({ _id: "e3", roomRef: "labC", faculty: "F3", startMinutes: 600, endMinutes: 720, studentCount: 30 });
  const ctx = { rooms, timetable: [e1, e2, occupier], changes: [], reservations: [], maintenance: [] };
  const out = R.analyzeOutage({ roomId: "labA", startAt: T.slotToInterval(DATE, 600, 600).start, endAt: T.slotToInterval(DATE, 720, 720).start, ctx, buildings, graph: null });
  assert.equal(out.occurrences.length, 2);
  const o1 = out.occurrences.find((o) => o.timetable === "e1");
  const rejectedIds = Object.fromEntries(o1.rejected.map((r) => [r.roomId, r.reasons.join("|")]));
  assert.match(rejectedIds.labC, /occupied/);           // busy
  assert.match(rejectedIds.labC, /capacity/);           // too small (40 < 50)
  assert.match(rejectedIds.labD, /missing equipment/);  // wrong equipment
  assert.match(rejectedIds.labE, /missing equipment/);  // only 10 working PCs
  assert.match(rejectedIds.labF, /maintenance/);        // under maintenance
  assert.deepEqual(o1.candidates.map((c) => c.roomId), ["labB"]);
  assert.equal(o1.candidates[0].walking.type, "same_building");
  // both classes overlap in time and only labB is eligible -> second one gets no suggestion
  const o2 = out.occurrences.find((o) => o.timetable === "e2");
  assert.equal([o1, o2].filter((o) => o.suggestedRoom === "labB").length, 1);
  assert.match([o1, o2].find((o) => !o.suggestedRoom).explanation, /taken by other affected classes/);
});
test("no alternative -> explanation, never a bad room", () => {
  const e1 = entry({ _id: "e1", studentCount: 75 });
  const out = R.analyzeOutage({ roomId: "labA", startAt: T.slotToInterval(DATE, 600, 600).start, endAt: T.slotToInterval(DATE, 720, 720).start,
    ctx: { rooms: [rooms[0], rooms[2], rooms[5]], timetable: [e1], changes: [], reservations: [], maintenance: [] }, buildings, graph: null });
  assert.equal(out.occurrences[0].candidates.length, 0);
  assert.equal(out.occurrences[0].decision, "no_alternative");
  assert.ok(out.occurrences[0].explanation.length > 10);
});
test("outage that misses every class yields no occurrences", () => {
  const out = R.analyzeOutage({ roomId: "labA", startAt: T.slotToInterval(DATE, 840, 840).start, endAt: T.slotToInterval(DATE, 900, 900).start,
    ctx: { rooms, timetable: [entry()], changes: [], reservations: [], maintenance: [] }, buildings, graph: null });
  assert.equal(out.occurrences.length, 0);
});

/* ---------- walking distance ---------- */
test("network distance used when paths connect, otherwise reported as unavailable (no straight-line fallback)", () => {
  const paths = [{ walkable: true, accessible: true, geometry: { type: "LineString", coordinates: [[77.6756, 9.575], [77.6757, 9.5744], [77.6758, 9.5738]] } },
                 { walkable: true, accessible: false, geometry: { type: "LineString", coordinates: [[77.6756, 9.575], [77.6758, 9.5738]] } }];
  const g = D.buildGraph(paths);
  const r = D.walkingDistance(g, [77.6756, 9.575], [77.6758, 9.5738]);
  assert.equal(r.type, "network"); assert.ok(r.meters > 120 && r.meters < 160);
  const acc = D.walkingDistance(D.buildGraph(paths, { accessibleOnly: true }), [77.6756, 9.575], [77.6758, 9.5738]);
  assert.equal(acc.type, "network");
  const far = D.walkingDistance(g, [77.6756, 9.575], [77.69, 9.56]);
  assert.equal(far.type, "unavailable");
  assert.equal(far.meters, null);
  assert.ok(far.straightLineMeters > 1000); // shown for information only, never used as the walking distance
  assert.equal(D.walkingDistance(null, [1, 1], [1, 1], { sameBuilding: true }).type, "same_building");
  assert.equal(D.walkingDistance(null, null, [1, 1]).type, "unknown");
});

test("NetworkX matrix is preferred; a null entry means no connected route", () => {
  const g = { nodes: new Map(), adj: new Map(), matrix: D.buildMatrix([{ a: "way/1", b: "way/2", meters: 240.4 }, { a: "way/1", b: "way/3", meters: null }]) };
  const p1 = [77.6756, 9.575], p2 = [77.6758, 9.5738];
  const ok = D.walkingDistance(g, p1, p2, { aKey: "way/2", bKey: "way/1" }); // order must not matter
  assert.equal(ok.type, "network"); assert.equal(ok.engine, "networkx"); assert.equal(ok.meters, 240);
  const none = D.walkingDistance(g, p1, p2, { aKey: "way/1", bKey: "way/3" });
  assert.equal(none.type, "unavailable"); assert.equal(none.meters, null); assert.match(none.reason, /no connected/);
});

/* ---------- locks ---------- */
test("withLocks serialises critical sections", async () => {
  let inside = 0, max = 0;
  const job = () => withLocks(["room:1"], async () => { inside++; max = Math.max(max, inside); await new Promise((r) => setTimeout(r, 10)); inside--; });
  await Promise.all([job(), job(), job()]);
  assert.equal(max, 1);
});
