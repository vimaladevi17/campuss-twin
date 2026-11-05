const mongoose = require("mongoose");
const geo = require("./_geo");
const { representativePoint } = require("../utils/geo");
const { VERIFICATION, FACILITY_CATEGORIES } = require("../utils/constants");

const buildingSchema = new mongoose.Schema(
  {
    code: { type: String, required: [true, "code is required"], trim: true, uppercase: true, unique: true },
    name: { type: String, required: [true, "name is required"], trim: true },
    category: { type: String, enum: FACILITY_CATEGORIES, default: "academic" },
    description: { type: String, default: "", trim: true },
    // Marker position, GeoJSON Point [lng, lat]. Derived from the footprint when omitted.
    location: geo.point(),
    // Original footprint, GeoJSON Polygon / MultiPolygon. Never replaced by a point.
    footprint: geo.polygon(),
    floorsCount: { type: Number, min: [0, "floorsCount cannot be negative"], default: 1 },
    heightM: { type: Number, min: [0, "height cannot be negative"] },
    heightSource: { type: String, enum: ["measured", "osm", "estimated_from_floors", "unknown"], default: "unknown" },
    facilities: [{ type: String, trim: true }],
    status: { type: String, enum: ["open", "closed", "under_construction"], default: "open" },
    imageUrl: { type: String, default: "", trim: true },
    source: { type: String, default: "manual", trim: true },        // e.g. "KARE_Campus_Facilities_Spatial_Data.xlsx#48"
    verification: { type: String, enum: VERIFICATION, default: "manual" },
    osmId: { type: String, trim: true },
    adminEditedFields: [{ type: String }],   // fields an administrator corrected; GIS re-imports leave them alone
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

buildingSchema.index({ location: "2dsphere" });
buildingSchema.index({ footprint: "2dsphere" });
buildingSchema.index({ osmId: 1 }, { unique: true, partialFilterExpression: { osmId: { $type: "string" } } });
buildingSchema.index({ name: "text", code: "text" });

buildingSchema.pre("validate", function () {
  if (!this.location && this.footprint) {
    const p = representativePoint(this.footprint);
    if (p) this.location = { type: "Point", coordinates: p };
  }
  // Height: never present an estimate as a measurement.
  if (this.heightM == null && this.floorsCount > 0) {
    this.heightM = Math.round(this.floorsCount * 3.5 * 10) / 10; // assumed 3.5 m per floor
    this.heightSource = "estimated_from_floors";
  }
});

module.exports = mongoose.model("Building", buildingSchema);
