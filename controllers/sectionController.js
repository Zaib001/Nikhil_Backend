const Section = require("../models/Section");
const Field = require("../models/Field");

exports.createSection = async (req, res) => {
  try {
    const { name, slug, icon, permissions } = req.body;
    const exists = await Section.findOne({ slug });
    if (exists) return res.status(400).json({ message: "Slug already exists" });
    const section = await Section.create({ name, slug, icon, permissions });
    res.json(section);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.listSections = async (req, res) => {
  const role = req.user?.role || "candidate";
  const sections = await Section.find({
    isActive: true,
    $or: [
      { "permissions.read": role },
      { "permissions.read": { $exists: false } }
    ]
  }).sort({ createdAt: -1 });
  res.json(sections);
};


exports.getSectionBySlug = async (req, res) => {
  const section = await Section.findOne({ slug: req.params.slug });
  if (!section) return res.status(404).json({ message: "Not found" });
  const fields = await Field.find({ sectionId: section._id, active: true }).sort({ order: 1 });
  res.json({ section, fields });
};
// sectionController.js
exports.updateSection = async (req, res) => {
  const { sectionId } = req.params;
  const { name, slug, icon, permissions } = req.body;
  const updated = await Section.findByIdAndUpdate(
    sectionId,
    { $set: { name, slug, icon, permissions } },
    { new: true }
  );
  if (!updated) return res.status(404).json({ message: "Section not found" });
  res.json(updated);
};

exports.deleteSection = async (req, res) => {
  const { sectionId } = req.params;
  await Field.deleteMany({ sectionId });
  await Record.deleteMany({ sectionId });
  const del = await Section.findByIdAndDelete(sectionId);
  if (!del) return res.status(404).json({ message: "Section not found" });
  res.json({ ok: true });
};