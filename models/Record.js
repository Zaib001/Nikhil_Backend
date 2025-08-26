const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

const RecordSchema = new Schema({
  sectionId: { type: Types.ObjectId, ref: "Section", index: true, required: true },
  data: { type: Schema.Types.Mixed, default: {} }, // dynamic payload
  createdBy: { type: Types.ObjectId, ref: "User" },
  updatedBy: { type: Types.ObjectId, ref: "User" },
}, { timestamps: true });

RecordSchema.index({ sectionId: 1, createdAt: -1 });
module.exports = mongoose.model("Record", RecordSchema);
