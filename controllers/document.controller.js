const Document = require("../models/Document");
const fs = require("fs");
const path = require("path");

exports.uploadDocument = async (req, res) => {
  try {
    const fileUrl = `/uploads/${req.file.filename}`; 
    const document = await Document.create({
      user: req.user._id,
      fileUrl,
      fileName: req.file.originalname,
    });
    res.status(201).json(document);
  } catch (err) {
    res.status(500).json({ message: "Upload failed" });
  }
};

exports.getDocuments = async (req, res) => {
  try {
    const filter = req.user.role === "admin" ? {} : { user: req.user._id };
    const docs = await Document.find(filter).populate("user", "name email role");
    res.json(docs);
  } catch {
    res.status(500).json({ message: "Failed to fetch documents" });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });

    if (req.user.role !== "admin" && req.user._id.toString() !== doc.user.toString()) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const filePath = path.join(__dirname, "..", doc.fileUrl);
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.warn("File not found when deleting:", filePath);
    }

    await doc.deleteOne(); 
    res.json({ message: "Deleted successfully" });

  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ message: "Failed to delete document" });
  }
};