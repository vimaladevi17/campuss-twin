const mongoose = require("mongoose");

// Turns Mongoose errors into friendly 400/500 responses (no stack traces)
function sendError(res, error, fallbackMessage) {
  if (error && error.name === "ValidationError") {
    const message = Object.values(error.errors)
      .map((item) => item.message)
      .join(", ");
    return res.status(400).json({ message });
  }

  if (error && error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || "value";
    return res.status(400).json({ message: `This ${field} already exists` });
  }

  if (error && error.name === "CastError") {
    return res.status(400).json({ message: "Invalid value in request" });
  }

  console.error(fallbackMessage, error);
  return res.status(500).json({ message: fallbackMessage });
}

// Middleware: rejects ids that are not valid MongoDB ids
function validateId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid id" });
  }
  next();
}

// Copies only the allowed fields from the request body
function pick(body, fields) {
  const result = {};
  const source = body || {};
  fields.forEach((field) => {
    if (source[field] !== undefined) {
      result[field] = source[field];
    }
  });
  return result;
}

module.exports = { sendError, validateId, pick };
