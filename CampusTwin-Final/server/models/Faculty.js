const mongoose = require("mongoose");

const facultySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "name is required"], trim: true },
    department: { type: String, required: [true, "department is required"], trim: true },
    designation: { type: String, required: [true, "designation is required"], trim: true },
    email: { type: String, required: [true, "email is required"], trim: true },
    phone: { type: String, default: "", trim: true },
    cabin: { type: String, default: "", trim: true },
    specialization: { type: String, default: "", trim: true },
    image: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Faculty", facultySchema);
