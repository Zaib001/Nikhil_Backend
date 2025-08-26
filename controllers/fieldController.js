const Field = require("../models/Field");
const Section = require("../models/Section");

exports.addField = async (req, res) => {
  const { sectionId } = req.params;
  const { key, label, type, config, validation, order } = req.body;
  const section = await Section.findById(sectionId);
  if (!section) return res.status(404).json({ message: "Section not found" });

  const dup = await Field.findOne({ sectionId, key, active: true });
  if (dup) return res.status(400).json({ message: "Field key already exists" });

  const field = await Field.create({ sectionId, key, label, type, config, validation, order });
  res.json(field);
};

exports.listFields = async (req, res) => {
  const fields = await Field.find({ sectionId: req.params.sectionId, active: true }).sort({ order: 1 });
  res.json(fields);
};

exports.reorderFields = async (req, res) => {
  // body: [{fieldId, order}]
  const ops = req.body.map(({ fieldId, order }) => ({
    updateOne: { filter: { _id: fieldId }, update: { $set: { order } } }
  }));
  if (!ops.length) return res.json({ ok: true });
  await Field.bulkWrite(ops);
  res.json({ ok: true });
};
exports.updateField = async (req, res) => {
  const { sectionId, fieldId } = req.params;
  const { key, label, type, config, validation, order } = req.body;
  const updated = await Field.findOneAndUpdate(
    { _id: fieldId, sectionId },
    { $set: { key, label, type, config, validation, order } },
    { new: true }
  );
  if (!updated) return res.status(404).json({ message: "Field not found" });
  res.json(updated);
};

exports.deleteField = async (req, res) => {
  const { sectionId, fieldId } = req.params;
  const del = await Field.findOneAndDelete({ _id: fieldId, sectionId });
  if (!del) return res.status(404).json({ message: "Field not found" });
  res.json({ ok: true });
};
