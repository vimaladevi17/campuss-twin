const Event = require("../models/Event");
const createCrudRouter = require("./crudRouter");

// Anyone can read events. Only admin can create, update or delete.
module.exports = createCrudRouter(Event, {
  label: "Event",
  fields: ["title", "date", "time", "location", "category", "description"],
  required: ["title", "date", "time", "location", "category"],
  sort: { date: 1 },
});
