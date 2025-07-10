const mongoose = require("mongoose");

const salarySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  month: { type: String, required: true }, 
  base: { type: Number, required: true },
  bonus: { type: Number, default: 0 },
  isBonusRecurring: { type: Boolean, default: false },
  bonusEndMonth: { type: String }, 
  currency: { type: String, enum: ['INR', 'USD'], default: 'INR' },
  finalAmount: { type: Number },
  unpaidLeaveDays: { type: Number },
  remarks: { type: String },
  payType: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
  mode: { type: String, enum: ['month', 'annum'], default: 'month' },
  payTypeEffectiveDate: { type: Date },
  fixedPhaseDuration: { type: Number },
  vendorBillRate: { type: Number },
  candidateShare: { type: Number }, 
  bonusAmount: { type: Number },
  bonusType: { type: String, enum: ['one-time', 'recurring'], default: 'one-time' },
  bonusFrequency: { type: String, enum: ['monthly', 'quarterly', 'annually'], default: 'monthly' },
  bonusStartDate: { type: Date },
  bonusEndDate: { type: Date },
  enablePTO: { type: Boolean, default: false },
  ptoType: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
  ptoDaysAllocated: { type: Number },
  previewMonth: { type: String },
  customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Salary", salarySchema);

