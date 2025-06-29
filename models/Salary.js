const mongoose = require("mongoose");

const salarySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  month: { type: String, required: true }, // Format: "2025-06"
  baseSalary: { type: Number, required: true },
  bonus: { type: Number, default: 0 },
  isBonusRecurring: { type: Boolean, default: false },
  bonusEndMonth: { type: String }, // Format: "2025-08"
  currency: { type: String, enum: ['INR', 'USD'], default: 'INR' },
  finalAmount: { type: Number },
  unpaidLeaveDays: { type: Number },
  remarks: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Salary", salarySchema);
