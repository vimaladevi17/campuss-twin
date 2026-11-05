const Building = require("../models/Building");
const Path = require("../models/CampusPath");
const Floor = require("../models/Floor");
const AllocationChange = require("../models/AllocationChange");
const ReplacementRequest = require("../models/ReplacementRequest");
const Settings = require("../models/CampusSettings");
const { loadContext, buildBusy } = require("./availability");
const { analyzeOutage, evaluateCandidate, requirementsOf } = require("./replacement");
const { buildGraph, buildMatrix, walkingDistance } = require("./distance");
const WalkingDistance = require("../models/WalkingDistance");
const { toCampusParts, slotToInterval } = require("../utils/time");
const { withLocks } = require("./locks");
const { notifyUsers, adminIds, userIdsForFaculty } = require("./notify");
const { audit } = require("../utils/audit");
const realtime = require("../utils/realtime");

const id = (v) => String(v && v._id ? v._id : v);
const httpError = (status, message, details) => Object.assign(new Error(message), { status, details });

async function loadWorld(startAt, endAt) {
  const first = toCampusParts(startAt).date, last = toCampusParts(new Date(endAt).getTime() - 1).date;
  const [ctx, buildingDocs, paths, settings, floorDocs, walkDocs] = await Promise.all([
    loadContext(first, last), Building.find().lean(), Path.find().lean(), Settings.get(), Floor.find().lean(), WalkingDistance.find().lean(),
  ]);
  const graph = buildGraph(paths);
  graph.matrix = buildMatrix(walkDocs);
  return { ctx, buildings: new Map(buildingDocs.map((b) => [id(b), b])), floors: new Map(floorDocs.map((f) => [id(f), f])), graph, settings: settings.toObject() };
}

async function analyzeAndSave({ roomId, startAt, endAt, reason, maintenanceId, weights, user }) {
  if (!(new Date(endAt) > new Date(startAt))) throw httpError(400, "endAt must be after startAt");
  const { ctx, buildings, floors, graph, settings } = await loadWorld(startAt, endAt);
  if (weights) settings.scoringWeights = { ...settings.scoringWeights, ...weights };
  const { weights: used, occurrences } = analyzeOutage({ roomId, startAt, endAt, ctx, buildings, graph, settings, floors });
  const doc = await ReplacementRequest.create({
    room: roomId, maintenance: maintenanceId, startAt, endAt, reason, weights: used, occurrences,
    status: occurrences.length ? "pending" : "no_affected_classes", requestedBy: user && user.id,
  });
  if (occurrences.length) {
    const admins = await adminIds();
    await notifyUsers(admins, { type: "replacement_pending", title: "Lab replacement needs review",
      message: `${occurrences.length} class(es) affected by an outage. Review recommendations.`, link: `/replacements/${doc._id}`, meta: { replacementId: doc._id } });
  }
  realtime.emit("replacement:created", { id: String(doc._id), status: doc.status });
  return doc;
}

// selections: [{ occurrenceId, roomId }]   Approval re-validates against FRESH data inside a lock.
async function approve({ requestId, selections, note, req }) {
  const reqDoc0 = await ReplacementRequest.findById(requestId);
  if (!reqDoc0) throw httpError(404, "Replacement request not found");
  const lockKeys = [`replacement:${requestId}`, `room:${id(reqDoc0.room)}`, ...selections.map((s) => `room:${s.roomId}`)];

  return withLocks(lockKeys, async () => {
    const doc = await ReplacementRequest.findById(requestId);
    if (!["pending", "partially_approved"].includes(doc.status)) throw httpError(409, `Request is already ${doc.status}`);
    if (!selections.length) throw httpError(400, "Select at least one alternative to approve");

    const { ctx, buildings, graph, settings } = await loadWorld(doc.startAt, doc.endAt);
    const original = ctx.rooms.find((r) => id(r) === id(doc.room));
    const point = (r) => buildings.get(id(r.building))?.location?.coordinates || null;
    const staged = [], problems = [];

    for (const sel of selections) {
      const occ = doc.occurrences.id(sel.occurrenceId);
      if (!occ) { problems.push({ occurrenceId: sel.occurrenceId, reasons: ["unknown occurrence"] }); continue; }
      if (occ.decision === "approved") { problems.push({ occurrenceId: sel.occurrenceId, reasons: ["already approved"] }); continue; }
      const entry = ctx.timetable.find((e) => id(e) === id(occ.timetable));
      const room = ctx.rooms.find((r) => id(r) === String(sel.roomId));
      if (!entry || !room) { problems.push({ occurrenceId: sel.occurrenceId, reasons: ["class or room no longer exists"] }); continue; }
      if (!occ.candidates.some((c) => c.roomId === String(sel.roomId)))
        { problems.push({ occurrenceId: sel.occurrenceId, reasons: ["room was not an eligible recommendation"] }); continue; }
      // fresh state + earlier selections in this same approval
      const changes = [...ctx.changes, ...staged.map((s) => ({ status: "active", date: s.date, timetable: s.timetable, newRoom: s.newRoom }))];
      const busy = buildBusy({ dateStr: occ.date, ...ctx, changes });
      const interval = slotToInterval(occ.date, occ.startMinutes, occ.endMinutes);
      const dist = walkingDistance(graph, point(original), point(room), { sameBuilding: id(room.building) === id(original.building), speedMps: settings.walkingSpeedMps, aKey: buildings.get(id(original.building))?.osmId, bKey: buildings.get(id(room.building))?.osmId });
      const ev = evaluateCandidate({ room, req: requirementsOf(entry, original), interval, busyList: busy.get(id(room)), dist, weights: doc.weights,
        maxDistanceM: settings.maxRecommendedWalkM, bufferMin: settings.turnoverBufferMin });
      if (!ev.eligible) { problems.push({ occurrenceId: sel.occurrenceId, room: room.roomNumber, reasons: ev.reasons }); continue; }
      staged.push({ occ, timetable: id(occ.timetable), date: occ.date, originalRoom: id(original), newRoom: id(room) });
    }
    if (problems.length) throw httpError(409, "Some selections are no longer valid. Nothing was changed.", { problems });

    try {
      await AllocationChange.insertMany(staged.map((s) => ({
        timetable: s.timetable, date: s.date, originalRoom: s.originalRoom, newRoom: s.newRoom, replacementRequest: doc._id,
        reason: doc.reason || "Room unavailable", approvedBy: req.user.id, approvedAt: new Date(),
      })));
    } catch (e) {
      if (e.code === 11000) throw httpError(409, "One of these classes already has an approved room change for that date");
      throw e;
    }
    for (const s of staged) { s.occ.decision = "approved"; s.occ.selectedRoom = s.newRoom; }
    const done = doc.occurrences.filter((o) => o.decision === "approved").length;
    doc.status = done === doc.occurrences.length ? "approved" : "partially_approved";
    doc.decidedBy = req.user.id; doc.decidedAt = new Date(); doc.decisionNote = note || "";
    await doc.save();

    // Notify faculty of affected classes + admins
    const roomsById = new Map(ctx.rooms.map((r) => [id(r), r]));
    for (const s of staged) {
      const e = ctx.timetable.find((x) => id(x) === s.timetable);
      const fu = e && e.facultyRef ? await userIdsForFaculty([e.facultyRef]) : [];
      await notifyUsers(fu, { type: "class_room_changed", title: `Room change: ${e ? e.subject : "class"}`,
        message: `On ${s.date} the class moves from ${roomsById.get(s.originalRoom).roomNumber} to ${roomsById.get(s.newRoom).roomNumber}.`, link: "/timetable", meta: { date: s.date } });
    }
    await notifyUsers(await adminIds(), { type: "replacement_approved", title: "Lab replacement approved", message: `${staged.length} class(es) moved.`, link: `/replacements/${doc._id}` });
    await audit(req, "approve", "replacement", doc._id, { changes: staged.map((s) => ({ timetable: s.timetable, date: s.date, from: s.originalRoom, to: s.newRoom })), note });
    realtime.emit("replacement:approved", { id: String(doc._id) });
    realtime.emit("availability:changed", { rooms: [...new Set(staged.flatMap((s) => [s.originalRoom, s.newRoom]))] });
    realtime.emit("timetable:changed", { dates: [...new Set(staged.map((s) => s.date))] });
    return doc;
  });
}

async function reject({ requestId, note, req }) {
  const doc = await ReplacementRequest.findById(requestId);
  if (!doc) throw httpError(404, "Replacement request not found");
  if (!["pending", "partially_approved"].includes(doc.status)) throw httpError(409, `Request is already ${doc.status}`);
  doc.occurrences.forEach((o) => { if (o.decision === "pending" || o.decision === "no_alternative") o.decision = "rejected"; });
  doc.status = doc.occurrences.some((o) => o.decision === "approved") ? "partially_approved" : "rejected"; doc.decidedBy = req.user.id; doc.decidedAt = new Date(); doc.decisionNote = note || "";
  await doc.save();
  await audit(req, "reject", "replacement", doc._id, { note });
  realtime.emit("replacement:rejected", { id: String(doc._id) });
  return doc;
}

module.exports = { analyzeAndSave, approve, reject, loadWorld };
