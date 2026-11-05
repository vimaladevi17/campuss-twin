const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const { sendError, validateId, pick } = require("../utils/helpers");
const { audit } = require("../utils/audit");
const realtime = require("../utils/realtime");

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Builds GET / GET one / POST / PUT / DELETE routes for a model.
//  fields      fields clients may set            required   must be non-empty on create/update
//  readRoles   null = public read, or roles allowed to read (admin always allowed)
//  writeRoles  roles allowed to write (admin always allowed)
// Optional (all backwards compatible):
//  searchFields  ?search=text matches these fields (case-insensitive)
//  filters       { queryParam: "field" } equality filters, e.g. { building: "building" }
//  populate      mongoose populate string/array for reads
//  beforeSave(data, req, existingDoc|null) -> may throw {status,message} or return modified data
//  beforeDelete(doc, req) -> return an error string to block deletion (409)
//  entity        name used for audit log + realtime events ("building" -> "building:created" ...)
//  Paging: ?page=&limit= switches the response to { items, total, page, pages }; without it a plain array is returned.
function createCrudRouter(Model, options) {
  const {
    label, fields, required = [], sort = { createdAt: -1 }, readRoles = null, writeRoles = [],
    searchFields = [], filters = {}, populate, beforeSave, beforeDelete, entity,
  } = options;

  const router = express.Router();
  const readGuards = readRoles ? [protect, authorize(...readRoles)] : [];
  const writeGuards = [protect, authorize(...writeRoles)];

  function missingField(data, partial) {
    for (const field of required) {
      const value = data[field];
      if (partial && value === undefined) continue;
      if (value === undefined || value === null || String(value).trim() === "") return field;
    }
    return null;
  }
  const fail = (res, e, msg) => (e && e.status ? res.status(e.status).json({ message: e.message, ...(e.details || {}) }) : sendError(res, e, msg));
  async function after(req, action, doc) {
    if (!entity) return;
    await audit(req, action, entity, doc._id, action === "delete" ? { name: doc.name || doc.title } : undefined);
    realtime.emit(`${entity}:${action}d`.replace("deleted", "deleted"), { id: String(doc._id) });
  }

  router.get("/", ...readGuards, async (req, res) => {
    try {
      const q = {};
      for (const [param, field] of Object.entries(filters)) if (req.query[param] !== undefined && req.query[param] !== "") q[field] = req.query[param];
      if (req.query.search && searchFields.length)
        q.$or = searchFields.map((f) => ({ [f]: { $regex: escapeRe(req.query.search), $options: "i" } }));
      let cursor = Model.find(q).sort(sort);
      if (populate) cursor = cursor.populate(populate);
      if (req.query.page) {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1), limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 25));
        const [items, total] = await Promise.all([cursor.skip((page - 1) * limit).limit(limit), Model.countDocuments(q)]);
        return res.json({ items, total, page, pages: Math.ceil(total / limit) });
      }
      res.json(await cursor);
    } catch (error) { sendError(res, error, `Failed to fetch ${label}s`); }
  });

  router.get("/:id", ...readGuards, validateId, async (req, res) => {
    try {
      let cursor = Model.findById(req.params.id);
      if (populate) cursor = cursor.populate(populate);
      const item = await cursor;
      if (!item) return res.status(404).json({ message: `${label} not found` });
      res.json(item);
    } catch (error) { sendError(res, error, `Failed to fetch ${label}`); }
  });

  router.post("/", ...writeGuards, async (req, res) => {
    try {
      let data = pick(req.body, fields);
      const missing = missingField(data);
      if (missing) return res.status(400).json({ message: `${missing} is required` });
      if (beforeSave) data = (await beforeSave(data, req, null)) || data;
      const created = await Model.create(data);
      await after(req, "create", created);
      res.status(201).json(created);
    } catch (error) { fail(res, error, `Failed to create ${label}`); }
  });

  router.put("/:id", ...writeGuards, validateId, async (req, res) => {
    try {
      let data = pick(req.body, fields);
      const missing = missingField(data, true);
      if (missing) return res.status(400).json({ message: `${missing} is required` });
      const existing = await Model.findById(req.params.id);
      if (!existing) return res.status(404).json({ message: `${label} not found` });
      if (beforeSave) data = (await beforeSave(data, req, existing)) || data;
      existing.set(data);          // .save() so schema hooks (derived fields) and validators run
      const updated = await existing.save();
      await after(req, "update", updated);
      res.json(updated);
    } catch (error) { fail(res, error, `Failed to update ${label}`); }
  });

  router.delete("/:id", ...writeGuards, validateId, async (req, res) => {
    try {
      const doc = await Model.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: `${label} not found` });
      if (beforeDelete) {
        const blocked = await beforeDelete(doc, req);
        if (blocked) return res.status(409).json({ message: blocked });
      }
      await doc.deleteOne();
      await after(req, "delete", doc);
      res.json({ message: `${label} deleted successfully` });
    } catch (error) { fail(res, error, `Failed to delete ${label}`); }
  });

  return router;
}

module.exports = createCrudRouter;
