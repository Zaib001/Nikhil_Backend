const mongoose = require("mongoose");

const timesheetSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  submittedByRole: {
    type: String,
    enum: ["candidate", "recruiter"],
    required: true,
  },
  from: { type: Date, required: true },
  to: { type: Date, required: true },
  filename: { type: String }, 
  month: { type: String }, 
  hours: { type: Number }, 
  totalPay: { type: Number },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
}, { timestamps: true });

module.exports = mongoose.model("Timesheet", timesheetSchema);
