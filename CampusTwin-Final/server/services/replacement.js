// Smart Lab Replacement: affected classes -> hard-constraint filtering -> scoring -> ranking.
// Score = wA*A + wE*E + wC*C + wD*D, each component 0..100.  Never recommends a room that is
// busy, under maintenance, too small, or missing required equipment.
const { DEFAULT_WEIGHTS } = require("../utils/constants");
const { overlaps, slotToInterval, toCampusParts, eachDate, formatHHMM } = require("../utils/time");
const { effectiveAllocations, buildBusy, conflictsFor, equipmentCheck } = require("./availability");
const { walkingDistance } = require("./distance");

const id = (v) => (v == null ? "" : String(v._id || v));
const clamp = (x, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, x));
const round1 = (x) => Math.round(x * 10) / 10;

function normaliseWeights(w = {}) {
  const m = { ...DEFAULT_WEIGHTS, ...w };
  const sum = m.availability + m.equipment + m.capacity + m.distance;
  if (!(sum > 0)) return { ...DEFAULT_WEIGHTS };
  return { availability: m.availability / sum, equipment: m.equipment / sum, capacity: m.capacity / sum, distance: m.distance / sum };
}

// Requirements of one affected class (course defaults are merged in by the caller)
function requirementsOf(entry, originalRoom) {
  return {
    studentCount: entry.studentCount || 0,
    equipment: entry.requiredEquipment || [],
    special: entry.specialRequirements || [],
    roomType: originalRoom.type,
    labCategory: originalRoom.labCategory || "",
  };
}

/* Component scores (documented in docs/ARCHITECTURE.md) */
// A: free for the whole slot = 60; +20 if free `buffer` min before; +20 if free `buffer` min after.
function availabilityScore(busyList, interval, bufferMin) {
  const b = bufferMin * 60000;
  const before = !conflictsFor(busyList, { start: interval.start - b, end: interval.start }).length;
  const after = !conflictsFor(busyList, { start: interval.end, end: interval.end + b }).length;
  return 60 + (before ? 20 : 0) + (after ? 20 : 0);
}
// E: all requirements met = 70; +15 same lab category as the original; +15 scaled by spare working equipment.
function equipmentScore(eq, room, req) {
  return clamp(70 + (req.labCategory && room.labCategory === req.labCategory ? 15 : 0) + 15 * eq.surplusRatio);
}
// C: best fit when 60-100 % full; smaller classes in huge rooms are scored lower (wasteful).
function capacityScore(students, capacity) {
  if (!capacity) return 0;
  const ratio = students / capacity;
  return ratio >= 0.6 ? 100 : clamp(((ratio - 0.2) / 0.4) * 100);
}
// D: 100 at zero distance, 0 at/after maxDistanceM. Unknown distance scores 0 and is flagged.
function distanceScore(meters, maxM) {
  return meters == null ? 0 : clamp(100 * (1 - meters / maxM));
}

function evaluateCandidate({ room, req, interval, busyList, dist, weights, maxDistanceM = 1000, bufferMin = 15 }) {
  const reasons = [];
  if (room.operationalStatus === "inactive") reasons.push("room is inactive");
  const hits = conflictsFor(busyList, interval);
  for (const h of hits) {
    if (h.type === "maintenance") reasons.push("under maintenance");
    else if (h.type === "unavailable") reasons.push("room unavailable");
    else reasons.push(`occupied (${h.label || h.type})`);
  }
  if (req.studentCount > room.capacity) reasons.push(`capacity ${room.capacity} < ${req.studentCount} students`);
  const eq = equipmentCheck(room, req.equipment);
  if (!eq.ok) reasons.push("missing equipment: " + eq.missing.map((m) => `${m.type} (need ${m.need}, working ${m.have})`).join(", "));
  const have = new Set(room.specialFacilities || []);
  const lacking = (req.special || []).filter((s) => !have.has(s));
  if (lacking.length) reasons.push("missing facilities: " + lacking.join(", "));
  if (reasons.length) return { eligible: false, reasons: [...new Set(reasons)] };

  const w = normaliseWeights(weights);
  const A = availabilityScore(busyList, interval, bufferMin), E = equipmentScore(eq, room, req),
    C = capacityScore(req.studentCount, room.capacity), D = distanceScore(dist.meters, maxDistanceM);
  const total = round1(w.availability * A + w.equipment * E + w.capacity * C + w.distance * D);
  const why = [`free for the whole slot${A >= 100 ? " with buffer on both sides" : ""}`, "all required equipment present",
    `seats ${room.capacity} for ${req.studentCount} students`,
    dist.type === "same_building" ? "same building" : dist.meters == null ? "walking route distance unavailable (no connected pedestrian route)"
      : `${dist.meters} m ${dist.type === "network" ? "walk" : "straight-line (approximate)"}`];
  return { eligible: true, scores: { availability: A, equipment: round1(E), capacity: round1(C), distance: round1(D) }, total, reason: why.join("; ") };
}

// ctx: { rooms, timetable, changes, reservations, maintenance } (as from availability.loadContext)
// buildings: Map<id, building>; graph: from distance.buildGraph
function analyzeOutage({ roomId, startAt, endAt, ctx, buildings, graph, settings = {}, floors = new Map() }) {
  const original = ctx.rooms.find((r) => id(r) === String(roomId));
  if (!original) throw Object.assign(new Error("Room not found"), { status: 404 });
  const weights = normaliseWeights(settings.scoringWeights);
  const outage = { start: new Date(startAt).getTime(), end: new Date(endAt).getTime() };
  const first = toCampusParts(outage.start).date, last = toCampusParts(outage.end - 1).date;
  const speed = settings.walkingSpeedMps || 1.34;
  const point = (r) => buildings.get(id(r.building))?.location?.coordinates || null;
  const occurrences = [];

  for (const date of eachDate(first, last, 120)) {
    const busy = buildBusy({ dateStr: date, ...ctx });
    for (const a of effectiveAllocations(date, ctx.timetable, ctx.changes)) {
      if (a.roomId !== id(original) || !overlaps(a.interval, outage)) continue;
      const e = a.entry, req = requirementsOf(e, original);
      const candidates = [], rejected = [];
      for (const room of ctx.rooms) {
        if (id(room) === id(original) || room.type !== original.type) continue;
        const sameBuilding = id(room.building) === id(original.building);
        const dist = walkingDistance(graph, point(original), point(room), { sameBuilding, speedMps: speed, aKey: buildings.get(id(original.building))?.osmId, bKey: buildings.get(id(room.building))?.osmId });
        const ev = evaluateCandidate({ room, req, interval: a.interval, busyList: busy.get(id(room)), dist, weights,
          maxDistanceM: settings.maxRecommendedWalkM || 1000, bufferMin: settings.turnoverBufferMin ?? 15 });
        const b = buildings.get(id(room.building));
        const base = { roomId: id(room), roomNumber: room.roomNumber, roomName: room.name, building: b ? { id: id(b), name: b.name, code: b.code, coordinates: b.location?.coordinates || null } : null, capacity: room.capacity,
          floor: floors.get(id(room.floor)) ? { number: floors.get(id(room.floor)).number, name: floors.get(id(room.floor)).name } : null };
        if (ev.eligible) candidates.push({ ...base, scores: ev.scores, total: ev.total, reason: ev.reason,
          walking: { meters: dist.meters, minutes: dist.minutes, type: dist.type, route: dist.route } });
        else rejected.push({ ...base, reasons: ev.reasons });
      }
      candidates.sort((x, y) => y.total - x.total || (x.walking.meters ?? 1e9) - (y.walking.meters ?? 1e9));
      occurrences.push({
        timetable: id(e), date, startMinutes: e.startMinutes, endMinutes: e.endMinutes,
        summary: { subject: e.subject, faculty: e.faculty, course: e.course, section: e.section, className: e.className, time: `${formatHHMM(e.startMinutes)}-${formatHHMM(e.endMinutes)}`,
          originalRoom: { id: id(original), roomNumber: original.roomNumber, name: original.name,
            building: buildings.get(id(original.building)) ? { id: id(original.building), name: buildings.get(id(original.building)).name, coordinates: point(original) } : null } },
        requirements: req, candidates, rejected,
        decision: candidates.length ? "pending" : "no_alternative",
        explanation: candidates.length ? undefined
          : `No eligible alternative: ${rejected.length ? "every other " + original.type + " violates at least one hard constraint (see rejected list)" : "there is no other " + original.type + " in the database"}.`,
      });
    }
  }
  // Greedy suggestion so two simultaneous classes are not both sent to the same room.
  const taken = [];
  for (const o of [...occurrences].sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes)) {
    const iv = slotToInterval(o.date, o.startMinutes, o.endMinutes);
    const pick = o.candidates.find((c) => !taken.some((t) => t.roomId === c.roomId && overlaps(t.iv, iv)));
    if (pick) { o.suggestedRoom = pick.roomId; taken.push({ roomId: pick.roomId, iv }); }
    else if (o.candidates.length) o.explanation = "Eligible rooms exist but are all taken by other affected classes in this slot.";
  }
  return { weights, occurrences };
}

module.exports = {
  normaliseWeights, requirementsOf, availabilityScore, equipmentScore, capacityScore, distanceScore,
  evaluateCandidate, analyzeOutage,
};
