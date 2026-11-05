// Small resources that only need the standard CRUD behaviour.
const Course = require("../models/Course");
const CampusPath = require("../models/CampusPath");
const CampusLayer = require("../models/CampusLayer");
const createCrudRouter = require("./crudRouter");

module.exports = {
  courses: createCrudRouter(Course, {
    label: "Course", entity: "course", fields: ["code", "name", "department", "defaultRequirements"], required: ["code", "name"],
    sort: { code: 1 }, searchFields: ["code", "name"], filters: { department: "department" }, readRoles: ["student", "faculty"],
  }),
  paths: createCrudRouter(CampusPath, {
    label: "Path", entity: "path", fields: ["name", "pathType", "geometry", "accessible", "walkable", "source", "verification"], required: ["geometry"],
    sort: { createdAt: -1 }, filters: { pathType: "pathType" },
  }),
  layers: createCrudRouter(CampusLayer, {
    label: "Map layer", entity: "layer", fields: ["key", "name", "geometry", "source", "verification", "note"], required: ["key", "geometry"],
    sort: { key: 1 }, filters: { key: "key" },
  }),
};
