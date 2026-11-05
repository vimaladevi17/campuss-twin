const Lab = require("../models/Lab");
const createCrudRouter = require("./crudRouter");

module.exports = createCrudRouter(Lab, {
  label: "Lab",
  fields: ["name", "department", "location", "capacity", "status", "description"],
  required: ["name", "location", "capacity"],
  sort: { name: 1 },
});
