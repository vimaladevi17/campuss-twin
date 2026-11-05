const mongoose = require("mongoose");
const geo = require("./_geo");
const { FACILITY_CATEGORIES, VERIFICATION } = require("../utils/constants");

const facilitySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "name is required"], trim: true },
    category: { type: String, enum: FACILITY_CATEGORIES, required: [true, "category is required"] },
    tags: [{ type: String, trim: true, lowercase: true }],          // e.g. "library", "parking"
    description: { type: String, default: "", trim: true },
    location: { ...geo.point(), required: [true, "location is required"] },
    building: { type: mongoose.Schema.Types.ObjectId, ref: "Building" },
    layer: { type: String, enum: ["general", "accessibility"], default: "general" },
    accessibilityType: { type: String, enum: ["accessible_toilet", "accessible_ramp", "day_care", "lactation_room", "transportation", ""], default: "" },
    status: { type: String, enum: ["operational", "closed", "under_maintenance"], default: "operational" },
    imageUrl: { type: String, default: "", trim: true },
    source: { type: String, default: "manual", trim: true },
    sourceRef: { file: String, sheet: String, row: Number },
    verification: { type: String, enum: VERIFICATION, default: "manual" },
    // Stable key so repeated imports update instead of duplicating.
    importKey: { type: String, trim: true },
    // Fields an administrator has corrected; imports must not overwrite them without confirmation.
    adminEditedFields: [{ type: String }],
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);
facilitySchema.index({ location: "2dsphere" });
facilitySchema.index({ importKey: 1 }, { unique: true, partialFilterExpression: { importKey: { $type: "string" } } });
facilitySchema.index({ category: 1, layer: 1 });
facilitySchema.index({ name: "text", description: "text" });
module.exports = mongoose.model("Facility", facilitySchema);
