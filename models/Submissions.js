const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema(
  {
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recruiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    client: { type: String, required: true },
    vendor: { type: String },
    notes: { type: String },
    date: { type: Date, required: true, default: Date.now },
    status: {
      type: String,
      enum: ["pending", "submitted", "rejected", "accepted"],
      default: "pending",
    },
    customFields: { type: Map, of: String, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Submission", submissionSchema);
