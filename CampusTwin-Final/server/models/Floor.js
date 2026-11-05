const mongoose = require("mongoose");
const floorSchema = new mongoose.Schema(
  {
    building: { type: mongoose.Schema.Types.ObjectId, ref: "Building", required: [true, "building is required"] },
    number: { type: Number, required: [true, "floor number is required"] }, // 0 = ground
    name: { type: String, trim: true, default: "" },
    layout: { type: Object, default: undefined }, // future: floor plan GeoJSON / BIM reference
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);
floorSchema.index({ building: 1, number: 1 }, { unique: true });
module.exports = mongoose.model("Floor", floorSchema);
