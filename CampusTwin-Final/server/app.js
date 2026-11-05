const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
  })
);
app.use(helmet());
app.use(express.json({ limit: "2mb" })); // footprints can be large GeoJSON

// Slow down password guessing. Disabled under test so suites can log in repeatedly.
if (process.env.NODE_ENV !== "test")
  app.use("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { message: "Too many login attempts. Try again in a few minutes." } }));

app.get("/", (req, res) => {
  res.json({ message: "CampusTwin Backend is Running 🚀" });
});

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/students", require("./routes/studentRoutes"));
app.use("/api/faculty", require("./routes/facultyRoutes"));
app.use("/api/labs", require("./routes/labRoutes"));
app.use("/api/events", require("./routes/eventRoutes"));
app.use("/api/notices", require("./routes/noticeRoutes"));
app.use("/api/attendance", require("./routes/attendanceRoutes"));
app.use("/api/timetable", require("./routes/timetableRoutes"));
app.use("/api/stats", require("./routes/statsRoutes"));

// ---- CampusTwin digital-twin modules ----
const simple = require("./routes/simpleRoutes");
app.use("/api/buildings", require("./routes/buildingRoutes"));
app.use("/api/floors", require("./routes/floorRoutes"));
app.use("/api/rooms", require("./routes/roomRoutes"));
app.use("/api/facilities", require("./routes/facilityRoutes"));
app.use("/api/courses", simple.courses);
app.use("/api/paths", simple.paths);
app.use("/api/layers", simple.layers);
app.use("/api/availability", require("./routes/availabilityRoutes"));
app.use("/api/maintenance", require("./routes/maintenanceRoutes"));
app.use("/api/reservations", require("./routes/reservationRoutes"));
app.use("/api/replacements", require("./routes/replacementRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/audit-logs", require("./routes/auditRoutes"));
app.use("/api/settings", require("./routes/settingsRoutes"));
app.use("/api/map", require("./routes/mapRoutes"));
app.use("/api/public", require("./routes/publicRoutes"));

// Unknown API route
app.use("/api", (req, res) => {
  res.status(404).json({ message: "API route not found" });
});

// Last-resort error handler (bad JSON body, unexpected errors)
app.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON in request body" });
  }
  console.error(error);
  res.status(500).json({ message: "Something went wrong on the server" });
});

module.exports = app;
