const mongoose = require("mongoose");
const { EQUIPMENT_TYPES } = require("../utils/constants");
const courseSchema = new mongoose.Schema(
  {
    code: { type: String, required: [true, "code is required"], trim: true, uppercase: true, unique: true },
    name: { type: String, required: [true, "name is required"], trim: true },
    department: { type: String, default: "", trim: true },
    defaultRequirements: [{ type: { type: String, enum: EQUIPMENT_TYPES }, minQuantity: { type: Number, min: 1, default: 1 }, _id: false }],
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);
module.exports = mongoose.model("Course", courseSchema);
