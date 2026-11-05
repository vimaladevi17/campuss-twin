const Notice = require("../models/Notice");
const createCrudRouter = require("./crudRouter");

module.exports = createCrudRouter(Notice, {
  label: "Notice",
  fields: ["title", "description", "category", "date", "priority", "createdBy"],
  required: ["title", "description"],
  sort: { date: -1, createdAt: -1 },
});
