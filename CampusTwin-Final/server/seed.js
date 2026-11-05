// Run from the server folder:
//   npm run seed        creates the first admin account (reads ADMIN_* from .env)
//   npm run seed:demo   also adds SAMPLE data and sample student/faculty accounts
require("dotenv").config();
const mongoose = require("mongoose");

const User = require("./models/User");
const Student = require("./models/Student");
const Faculty = require("./models/Faculty");
const Lab = require("./models/Lab");
const Event = require("./models/Event");
const Notice = require("./models/Notice");
const Timetable = require("./models/Timetable");
const Attendance = require("./models/Attendance");

const withDemo = process.argv.includes("--demo");

async function createUserIfMissing(name, email, password, role) {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    console.log(`User already exists: ${email}`);
    return;
  }
  await User.create({ name, email, password, role });
  console.log(`Created ${role} account: ${email}`);
}

async function insertIfEmpty(Model, label, items) {
  const count = await Model.countDocuments();
  if (count > 0) {
    console.log(`${label}: already has data, skipped`);
    return;
  }
  await Model.insertMany(items);
  console.log(`${label}: added ${items.length} sample records`);
}

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in server/.env");
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env first");
  }
  await createUserIfMissing(
    process.env.ADMIN_NAME || "Campus Admin",
    adminEmail,
    adminPassword,
    "admin"
  );

  if (withDemo) {
    const demoPassword = process.env.DEMO_PASSWORD;
    if (!demoPassword) {
      throw new Error("Set DEMO_PASSWORD in server/.env first");
    }

    await createUserIfMissing("Sample Student", "student@campustwin.demo", demoPassword, "student");
    await createUserIfMissing("Dr. Sample Faculty", "faculty@campustwin.demo", demoPassword, "faculty");

    await insertIfEmpty(Faculty, "Faculty", [
      { name: "Dr. Sample Faculty", department: "Computer Science", designation: "Professor", email: "faculty@campustwin.demo", phone: "", cabin: "CSE-201", specialization: "Data Structures" },
      { name: "Dr. Sample Priya", department: "Information Technology", designation: "Associate Professor", email: "priya@campustwin.demo", phone: "", cabin: "IT-105", specialization: "Databases" },
      { name: "Dr. Sample Arjun", department: "Artificial Intelligence", designation: "Assistant Professor", email: "arjun@campustwin.demo", phone: "", cabin: "AI-302", specialization: "Machine Learning" },
    ]);

    await insertIfEmpty(Lab, "Labs", [
      { name: "AI Lab", department: "Artificial Intelligence", location: "CSE Block", capacity: 60, status: "Available", description: "Sample record" },
      { name: "Programming Lab", department: "Information Technology", location: "IT Block", capacity: 40, status: "Occupied", description: "Sample record" },
      { name: "Networking Lab", department: "Computer Science", location: "CSE Block", capacity: 30, status: "Available", description: "Sample record" },
      { name: "Cloud Computing Lab", department: "Artificial Intelligence", location: "AI Block", capacity: 50, status: "Maintenance", description: "Sample record" },
    ]);

    await insertIfEmpty(Event, "Events", [
      { title: "AI Workshop (sample)", date: "2026-10-20", time: "10:00", location: "Seminar Hall", category: "Workshop", description: "Sample event for demonstration" },
      { title: "Tech Symposium (sample)", date: "2026-10-27", time: "09:30", location: "Auditorium", category: "Technical", description: "Sample event for demonstration" },
      { title: "Cultural Evening (sample)", date: "2026-11-05", time: "17:00", location: "Open Air Theatre", category: "Cultural", description: "Sample event for demonstration" },
    ]);

    await insertIfEmpty(Notice, "Notices", [
      { title: "Semester examination schedule (sample)", description: "Sample notice: students can check the schedule on the portal.", category: "Exam", priority: "High", date: "2026-10-12", createdBy: "Campus Admin" },
      { title: "Placement drive (sample)", description: "Sample notice: registration is open for the placement drive.", category: "Placement", priority: "Normal", date: "2026-10-14", createdBy: "Campus Admin" },
      { title: "Library timing update (sample)", description: "Sample notice: the library stays open until 9 PM.", category: "General", priority: "Low", date: "2026-10-15", createdBy: "Campus Admin" },
    ]);

    await insertIfEmpty(Student, "Students", [
      { name: "Sample Student", registerNumber: "SAMPLE001", email: "student@campustwin.demo", department: "Computer Science", year: 2, section: "A", attendance: 85 },
      { name: "Sample Student Two", registerNumber: "SAMPLE002", email: "student2@campustwin.demo", department: "Information Technology", year: 3, section: "B", attendance: 72 },
    ]);

    await insertIfEmpty(Timetable, "Timetable", [
      { day: "Monday", time: "09:00 - 10:00", subject: "Data Structures", faculty: "Dr. Sample Faculty", room: "Room 204", className: "CSE - A" },
      { day: "Monday", time: "11:00 - 12:00", subject: "Database Management Systems", faculty: "Dr. Sample Priya", room: "Room 301", className: "CSE - A" },
      { day: "Tuesday", time: "10:00 - 11:00", subject: "Artificial Intelligence", faculty: "Dr. Sample Arjun", room: "AI Lab", className: "CSE - A" },
      { day: "Wednesday", time: "09:00 - 10:00", subject: "Data Structures", faculty: "Dr. Sample Faculty", room: "Room 204", className: "CSE - A" },
    ]);

    if ((await Attendance.countDocuments()) === 0) {
      const student = await Student.findOne({ email: "student@campustwin.demo" });
      if (student) {
        await Attendance.insertMany([
          { student: student._id, subject: "Data Structures", totalClasses: 40, attended: 36 },
          { student: student._id, subject: "Database Management Systems", totalClasses: 38, attended: 30 },
          { student: student._id, subject: "Artificial Intelligence", totalClasses: 35, attended: 33 },
        ]);
        console.log("Attendance: added sample records");
      }
    }
  }

  await mongoose.disconnect();
  console.log("Done");
}

run().catch(async (error) => {
  console.error("Seed failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
