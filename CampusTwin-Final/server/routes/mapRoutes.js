// GeoJSON endpoints for the map. Public data only (no room details, no personal data).
const express = require("express");
const Building = require("../models/Building");
const Facility = require("../models/Facility");
const CampusPath = require("../models/CampusPath");
const CampusLayer = require("../models/CampusLayer");
const Room = require("../models/Room");
const { sendError } = require("../utils/helpers");
const { getRoomStatuses } = require("../services/availability");
const router = express.Router();

const fc = (features, extra = {}) => ({ type: "FeatureCollection", features, ...extra });

// Footprint polygon when we have it (for extrusion); marker point is in properties.centroid.
router.get("/buildings", async (req, res) => {
  try {
    const q = {};
    if (req.query.category) q.category = req.query.category;
    const [buildings, live, roomDocs] = await Promise.all([Building.find(q).lean(), getRoomStatuses(new Date()), Room.find().select("building type").lean()]);
    const byBuilding = new Map();
    for (const r of roomDocs) {
      const k = String(r.building); const s = live.statuses.get(String(r._id))?.status || "available";
      const c = byBuilding.get(k) || { total: 0, classrooms: 0, laboratories: 0, available: 0, occupied: 0, maintenance: 0, unavailable: 0 };
      c.total++; c[s]++; if (r.type === "classroom") c.classrooms++; if (r.type === "laboratory") c.laboratories++;
      byBuilding.set(k, c);
    }
    const features = buildings.filter((b) => b.footprint || b.location).map((b) => ({
      type: "Feature", id: String(b._id), geometry: b.footprint || b.location,
      properties: { id: String(b._id), code: b.code, name: b.name, category: b.category, floors: b.floorsCount, heightM: b.heightM, heightSource: b.heightSource,
        status: b.status, verification: b.verification, source: b.source, isDemo: b.isDemo, hasFootprint: Boolean(b.footprint), imageUrl: b.imageUrl,
        centroid: b.location ? b.location.coordinates : null, rooms: byBuilding.get(String(b._id)) || { total: 0 } },
    }));
    res.json(fc(features, { generatedAt: new Date(), note: "Features without hasFootprint are point markers, not building outlines." }));
  } catch (e) { sendError(res, e, "Failed to load map buildings"); }
});

router.get("/facilities", async (req, res) => {
  try {
    const q = {};
    for (const k of ["category", "layer", "status", "accessibilityType"]) if (req.query[k]) q[k] = req.query[k];
    if (req.query.tag) q.tags = req.query.tag;
    if (req.query.search) q.name = { $regex: String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const items = await Facility.find(q).lean();
    res.json(fc(items.map((f) => ({ type: "Feature", id: String(f._id), geometry: f.location,
      properties: { id: String(f._id), name: f.name, category: f.category, tags: f.tags, description: f.description, layer: f.layer, accessibilityType: f.accessibilityType,
        status: f.status, verification: f.verification, source: f.source, imageUrl: f.imageUrl, building: f.building } }))));
  } catch (e) { sendError(res, e, "Failed to load map facilities"); }
});

router.get("/boundary", async (req, res) => {
  try {
    const docs = await CampusLayer.find({ key: "boundary" }).lean();
    res.json(fc(docs.map((d) => ({ type: "Feature", geometry: d.geometry, properties: { name: d.name, verification: d.verification, source: d.source, note: d.note } })),
      docs.length ? {} : { note: "No campus boundary has been loaded yet. Import or digitise it from the master plan." }));
  } catch (e) { sendError(res, e, "Failed to load boundary"); }
});

router.get("/layers/:key", async (req, res) => {
  try {
    const docs = await CampusLayer.find({ key: req.params.key }).lean();
    res.json(fc(docs.map((d) => ({ type: "Feature", geometry: d.geometry, properties: { id: String(d._id), key: d.key, name: d.name, verification: d.verification, note: d.note } }))));
  } catch (e) { sendError(res, e, "Failed to load layer"); }
});

router.get("/paths", async (req, res) => {
  try {
    const q = req.query.accessible === "true" ? { accessible: true } : {};
    const docs = await CampusPath.find(q).lean();
    res.json(fc(docs.map((p) => ({ type: "Feature", id: String(p._id), geometry: p.geometry,
      properties: { id: String(p._id), name: p.name, pathType: p.pathType, accessible: p.accessible, walkable: p.walkable, verification: p.verification } }))));
  } catch (e) { sendError(res, e, "Failed to load paths"); }
});

module.exports = router;
