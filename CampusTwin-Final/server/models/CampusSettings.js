const mongoose = require("mongoose");
const { DEFAULT_WEIGHTS } = require("../utils/constants");
// Single document holding campus reference values and tunables.
const schema = new mongoose.Schema(
  {
    key: { type: String, default: "campus", unique: true },
    name: { type: String, default: "Kalasalingam Academy of Research and Education (KARE), Krishnankoil" },
    totalAreaSqm: { type: Number, default: 1536957 },     // supplied campus statistic
    openSpaceRatioPct: { type: Number, default: 94.7 },   // supplied campus statistic
    referencePoint: { lat: { type: Number, default: 9.5743 }, lng: { type: Number, default: 77.6761 } }, // approximate map centre
    scoringWeights: {
      availability: { type: Number, default: DEFAULT_WEIGHTS.availability, min: 0, max: 1 },
      equipment: { type: Number, default: DEFAULT_WEIGHTS.equipment, min: 0, max: 1 },
      capacity: { type: Number, default: DEFAULT_WEIGHTS.capacity, min: 0, max: 1 },
      distance: { type: Number, default: DEFAULT_WEIGHTS.distance, min: 0, max: 1 },
    },
    maxRecommendedWalkM: { type: Number, default: 1000, min: 50 },
    walkingSpeedMps: { type: Number, default: 1.34, min: 0.3, max: 3 },
    dayStartMinutes: { type: Number, default: 8 * 60 },
    dayEndMinutes: { type: Number, default: 18 * 60 },
    turnoverBufferMin: { type: Number, default: 15, min: 0 },
  },
  { timestamps: true }
);
schema.statics.get = async function () {
  return (await this.findOne({ key: "campus" })) || (await this.create({ key: "campus" }));
};
module.exports = mongoose.model("CampusSettings", schema);
