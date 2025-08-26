const Record = require("../models/Record");
const Section = require("../models/Section");
const Field = require("../models/Field");
const { validateAgainstFields } = require("../utils/validateRecord");
const { Parser } = require("json2csv");

exports.listRecords = async (req, res) => {
  const { slug } = req.params;
  const { q, page = 1, limit = 20 } = req.query;
  const section = await Section.findOne({ slug });
  if (!section) return res.status(404).json({ message: "Section not found" });

  const filter = { sectionId: section._id };
  if (q) {
    // naive text search across string fields
    filter.$or = Object.entries(req.query).filter(([k]) => !["q","page","limit"].includes(k))
      .map(([k, v]) => ({ [`data.${k}`]: new RegExp(v, "i") }));
  }

  const docs = await Record.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const count = await Record.countDocuments(filter);
  res.json({ records: docs, page: Number(page), pages: Math.ceil(count / limit), total: count });
};

exports.createRecord = async (req, res) => {
  const { slug } = req.params;
  const section = await Section.findOne({ slug });
  if (!section) return res.status(404).json({ message: "Section not found" });

  const fields = await Field.find({ sectionId: section._id, active: true }).sort({ order: 1 });
  const { valid, clean, errors } = validateAgainstFields(req.body.data || {}, fields);
  if (!valid) return res.status(422).json({ errors });

  const record = await Record.create({ sectionId: section._id, data: clean, createdBy: req.user?._id });
  res.json(record);
};

exports.updateRecord = async (req, res) => {
  const { slug, recordId } = req.params;
  const section = await Section.findOne({ slug });
  if (!section) return res.status(404).json({ message: "Section not found" });

  const fields = await Field.find({ sectionId: section._id, active: true });
  const { valid, clean, errors } = validateAgainstFields(req.body.data || {}, fields);
  if (!valid) return res.status(422).json({ errors });

  const updated = await Record.findOneAndUpdate(
    { _id: recordId, sectionId: section._id },
    { $set: { data: clean, updatedBy: req.user?._id } },
    { new: true }
  );
  if (!updated) return res.status(404).json({ message: "Record not found" });
  res.json(updated);
};

exports.deleteRecord = async (req, res) => {
  const { slug, recordId } = req.params;
  const section = await Section.findOne({ slug });
  if (!section) return res.status(404).json({ message: "Section not found" });
  await Record.findOneAndDelete({ _id: recordId, sectionId: section._id });
  res.json({ ok: true });
};

exports.exportCsv = async (req, res) => {
  const { slug } = req.params;
  const section = await Section.findOne({ slug });
  if (!section) return res.status(404).json({ message: "Section not found" });
  const rows = await Record.find({ sectionId: section._id }).lean();

  const flat = rows.map(r => ({ id: r._id, ...r.data, createdAt: r.createdAt }));
  const parser = new Parser();
  const csv = parser.parse(flat);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${slug}.csv"`);
  res.send(csv);
};
