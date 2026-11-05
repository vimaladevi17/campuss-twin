const Floor = require("../models/Floor");
const Building = require("../models/Building");
const Room = require("../models/Room");
const createCrudRouter = require("./crudRouter");

module.exports = createCrudRouter(Floor, {
  label: "Floor", entity: "floor",
  fields: ["building", "number", "name", "layout"],
  required: ["building", "number"],
  sort: { building: 1, number: 1 },
  filters: { building: "building" },
  populate: { path: "building", select: "name code" },
  readRoles: ["student", "faculty"],
  beforeSave: async (data) => {
    if (data.building && !(await Building.exists({ _id: data.building })))
      throw Object.assign(new Error("Building does not exist"), { status: 400 });
  },
  beforeDelete: async (doc) => {
    const n = await Room.countDocuments({ floor: doc._id });
    return n ? `Cannot delete: floor still has ${n} room(s).` : null;
  },
});
