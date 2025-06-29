const mongoose = require("mongoose");

const recruiterTimesheetSchema = new mongoose.Schema({
  recruiter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  from: { type: Date, required: true },
  to: { type: Date, required: true },
  hours: { type: Number, required: true },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  totalPay: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model("RecruiterTimesheet", recruiterTimesheetSchema);
