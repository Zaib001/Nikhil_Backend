const mongoose = require("mongoose");

const SectionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true, index: true },
  icon: { type: String, default: "FaFolder" }, // frontend maps icon name -> component
  permissions: { type: Object, default: { read: ["admin"], write: ["admin"] } },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model("Section", SectionSchema);
