const Facility = require("../models/Facility");
const createCrudRouter = require("./crudRouter");

// Public read (campus map). Admin writes. Corrected fields are remembered so a re-import
// of the Excel sheet cannot silently overwrite an administrator's correction.
module.exports = createCrudRouter(Facility, {
  label: "Facility", entity: "facility",
  fields: ["name", "category", "tags", "description", "location", "building", "layer", "accessibilityType", "status",
    "imageUrl", "source", "verification"],
  required: ["name", "category", "location"],
  sort: { name: 1 },
  searchFields: ["name", "description", "tags"],
  filters: { category: "category", layer: "layer", status: "status", accessibilityType: "accessibilityType", verification: "verification", tag: "tags" },
  beforeSave: async (data, req, existing) => {
    if (existing) {
      const changed = Object.keys(data).filter((k) => JSON.stringify(data[k]) !== JSON.stringify(existing[k]) && !["source", "verification"].includes(k));
      data.adminEditedFields = [...new Set([...(existing.adminEditedFields || []), ...changed])];
      if (changed.length && !("verification" in data) && existing.verification !== "verified_college") data.verification = "manual";
    }
  },
});
