const mongoose = require("mongoose");

const salaryHistorySchema = new mongoose.Schema({
  salaryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Salary",
    required: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  changes: {
    base: Number,
    bonus: Number,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("SalaryHistory", salaryHistorySchema);
