const mongoose = require("mongoose");

const recruiterPtoSchema = new mongoose.Schema({
  recruiter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  from: { type: Date, required: true },
  to: { type: Date, required: true },
  reason: { type: String, required: true },
  days: { type: Number, required: true },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
}, { timestamps: true });

module.exports = mongoose.model("RecruiterPTO", recruiterPtoSchema);
