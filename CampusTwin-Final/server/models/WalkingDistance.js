const mongoose = require("mongoose");
// Building-to-building walking distance computed offline with NetworkX (gis/ pipeline).
// a and b are Building.osmId values. meters null = the pipeline found no connected pedestrian route.
const schema = new mongoose.Schema(
  {
    a: { type: String, required: true, trim: true },
    b: { type: String, required: true, trim: true },
    meters: { type: Number, min: 0, default: null },
    route: { type: String, enum: ["network", "no_connected_route"], required: true },
    source: { type: String, default: "NetworkX pedestrian graph (OSM-derived)" },
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
schema.index({ a: 1, b: 1 }, { unique: true });
module.exports = mongoose.model("WalkingDistance", schema);
