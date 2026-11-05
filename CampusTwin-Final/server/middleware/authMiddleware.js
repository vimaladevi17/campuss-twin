const jwt = require("jsonwebtoken");

// Checks the "Authorization: Bearer <token>" header and attaches the user to req.user
function protect(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Please log in to continue" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ message: "Your session has expired. Please log in again" });
  }
}

// Allows only the listed roles. Admin is always allowed.
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Please log in to continue" });
    }

    if (req.user.role === "admin" || roles.includes(req.user.role)) {
      return next();
    }

    return res
      .status(403)
      .json({ message: "You do not have permission to do this" });
  };
}

module.exports = { protect, authorize };
