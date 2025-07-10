const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  experience: String,
  tech: String,
  dob: Date,
  role: {
    type: String,
    enum: ['admin', 'recruiter', 'candidate'],
    default: 'recruiter',
  },
  isVerified: { type: Boolean, default: false },
  permissions: [{ type: String }],
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  currency: {
    type: String,
    enum: ['INR', 'USD'],
    default: 'INR',
  },
  ptoLimit: { type: Number, default: 10 },
  workingDays: { type: Number, default: 30 },

  annualSalary: { type: Number, default: 0 },
  joiningDate: { type: Date }, 
  payCycleChangeMonth: { type: Number, default: 0 },
  vendorBillRate: { type: Number },
  candidateShare: { type: Number },

  createdAt: { type: Date, default: Date.now },
  customFields: { type: Map, of: String, default: {} },
});

module.exports = mongoose.model("User", userSchema);
