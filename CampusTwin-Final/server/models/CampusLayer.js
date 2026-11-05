const mongoose = require("mongoose");
const geo = require("./_geo");
const { VERIFICATION } = require("../utils/constants");
// Non-building map layers: campus boundary, lakes, playgrounds, open space, etc.
const schema = new mongoose.Schema(
  {
    key: { type: String, enum: ["boundary", "water", "sports_area", "open_space", "road_area", "other"], required: [true, "key is required"] },
    name: { type: String, default: "", trim: true },
    geometry: { ...geo.polygon(), required: [true, "geometry is required"] },
    source: { type: String, default: "manual", trim: true },
    verification: { type: String, enum: VERIFICATION, default: "estimated_unverified" },
    note: { type: String, default: "", trim: true }, // e.g. "traced from master plan, approximate"
  },
  { timestamps: true }
);
schema.index({ geometry: "2dsphere" });
module.exports = mongoose.model("CampusLayer", schema);
