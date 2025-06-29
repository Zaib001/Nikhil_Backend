const mongoose = require("mongoose");
const User = require("../models/User");

async function seed() {
  await mongoose.connect("mongodb://localhost:27017/recruitmentDB");
  await User.insertMany([
    { name: "Aisha Khan", email: "aisha@example.com", role: "candidate" },
    { name: "Ali Raza", email: "ali@example.com", role: "candidate" },
    { name: "Sana Malik", email: "sana@example.com", role: "candidate" },
  ]);
  console.log("Seeded candidates");
  mongoose.disconnect();
}

seed();
