// src/middleware/sectionAccess.js
const Section = require("../models/Section");

async function loadSectionBySlug(req, res, next) {
  const { slug } = req.params;
  const section = await Section.findOne({ slug, isActive: true });
  if (!section) return res.status(404).json({ message: "Section not found" });
  req.section = section;
  next();
}

function requireSectionRead(req, res, next) {
  const role = req.user?.role; // assume auth middleware sets req.user
  const readRoles = req.section?.permissions?.read || ["admin"];
  if (!readRoles.includes(role)) return res.status(403).json({ message: "No read access" });
  next();
}

function requireSectionWrite(req, res, next) {
  const role = req.user?.role;
  const writeRoles = req.section?.permissions?.write || ["admin"];
  if (!writeRoles.includes(role)) return res.status(403).json({ message: "No write access" });
  next();
}

module.exports = { loadSectionBySlug, requireSectionRead, requireSectionWrite };
