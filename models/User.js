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
    enum: ['admin', 'recruiter', 'candidate', 'company'],
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
  ptoLimit: {
    type: Number,
    default: 10, // ✅ Editable via admin
  },
  workingDays: {
    type: Number,
    default: 30, // ✅ Editable via admin
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  customFields: { type: Map, of: String, default: {} },

});

module.exports = mongoose.model("User", userSchema);
