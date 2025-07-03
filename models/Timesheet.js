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
  filename: { type: String }, // URL or path to the screenshot image
  month: { type: String }, // To track the month for PDF generation
  hours: { type: Number }, // Optional, if you want to store hours directly
  totalPay: { type: Number }, // Optional, if you want to calculate total pay
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
}, { timestamps: true });

module.exports = mongoose.model("Timesheet", timesheetSchema);
