const mongoose = require("mongoose");

const labSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "name is required"], trim: true },
    department: { type: String, default: "", trim: true },
    location: { type: String, required: [true, "location is required"], trim: true },
    capacity: { type: Number, required: [true, "capacity is required"], min: [1, "capacity must be at least 1"] },
    status: {
      type: String,
      enum: ["Available", "Occupied", "Maintenance"],
      default: "Available",
    },
    description: { type: String, default: "", trim: true },
    // Set by `npm run migrate`: the Room that now represents this lab. /api/labs is legacy; /api/rooms is authoritative.
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Lab", labSchema);
