// Sets the admin login to the ADMIN_EMAIL / ADMIN_PASSWORD in server/.env.
//   npm run reset:admin
// Creates the account if it does not exist. If it exists (for example from an older database),
// its password is replaced and its role is set to admin. No other user or record is touched.
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

(async () => {
  const { MONGO_URI, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!MONGO_URI) throw new Error("MONGO_URI is missing in server/.env");
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env first");
  await mongoose.connect(MONGO_URI);
  console.log("Connected to database:", mongoose.connection.name);
  const email = ADMIN_EMAIL.trim().toLowerCase();
  const user = await User.findOne({ email }).select("+password");
  if (user) {
    user.password = ADMIN_PASSWORD; // hashed by the model before saving
    user.role = "admin";
    await user.save();
    console.log(`Updated the existing account ${email}: password reset, role admin.`);
  } else {
    await User.create({ name: process.env.ADMIN_NAME || "Campus Admin", email, password: ADMIN_PASSWORD, role: "admin" });
    console.log(`Created admin account ${email}.`);
  }
  const admins = await User.countDocuments({ role: "admin" });
  console.log(`Admin accounts in this database: ${admins}`);
  await mongoose.disconnect();
})().catch((e) => { console.error("Failed:", e.message); process.exit(1); });
