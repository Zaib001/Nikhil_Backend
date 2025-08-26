const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

const FieldSchema = new Schema({
  sectionId: { type: Types.ObjectId, ref: "Section", index: true, required: true },
  key: { type: String, required: true }, // machine key (e.g., vendorName)
  label: { type: String, required: true },
  type: { type: String, enum: ["text","number","date","select","multiselect","boolean","file","relation"], required: true },
  config: { type: Schema.Types.Mixed, default: {} }, // {options: [], relation: {sectionSlug, labelKey, valueKey}}
  validation: { type: Schema.Types.Mixed, default: {} }, // {required, min, max, regex}
  order: { type: Number, default: 0 },
  version: { type: Number, default: 1 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

FieldSchema.index({ sectionId: 1, order: 1 });
module.exports = mongoose.model("Field", FieldSchema);
