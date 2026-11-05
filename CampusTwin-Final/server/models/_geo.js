const { validateGeometry } = require("../utils/geo");
const mk = (allowed) => ({
  type: Object,
  default: undefined,
  validate: { validator: (v) => v == null || validateGeometry(v, allowed) === null,
              message: (p) => validateGeometry(p.value, allowed) || "invalid geometry" },
});
module.exports = { point: () => mk(["Point"]), polygon: () => mk(["Polygon", "MultiPolygon"]), line: () => mk(["LineString"]),
                   any: () => mk(["Point", "Polygon", "MultiPolygon", "LineString"]) };
