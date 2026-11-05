const mongoose = require("mongoose");
const geo = require("./_geo");
const { VERIFICATION } = require("../utils/constants");
const schema = new mongoose.Schema(
  {
    name: { type: String, default: "", trim: true },
    pathType: { type: String, enum: ["footpath", "road", "stairs", "ramp", "crossing", "other"], default: "footpath" },
    geometry: { ...geo.line(), required: [true, "geometry is required"] }, // GeoJSON LineString
    accessible: { type: Boolean, default: true },   // step-free? set false for stairs; unknown paths stay true until reviewed
    walkable: { type: Boolean, default: true },
    source: { type: String, default: "manual", trim: true },
    verification: { type: String, enum: VERIFICATION, default: "manual" },
    osmId: { type: String, trim: true },        // segment id, e.g. "way/123#4" (unique per imported segment)
    adminEditedFields: [{ type: String }],
  },
  { timestamps: true }
);
schema.index({ geometry: "2dsphere" });
schema.index({ osmId: 1 }, { unique: true, partialFilterExpression: { osmId: { $type: "string" } } });
module.exports = mongoose.model("CampusPath", schema);
