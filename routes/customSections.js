const router = require("express").Router();
const section = require("../controllers/sectionController");
const field = require("../controllers/fieldController");
const record = require("../controllers/recordController");
const { protect, requireRole } = require("../middleware/authMiddleware");
const { loadSectionBySlug, requireSectionRead, requireSectionWrite } = require("../middleware/sectionAccess");

router.use(protect);

// List sections (only those the user can read)
router.get("/sections", section.listSections);

// Admin create section
router.post("/sections", requireRole("admin"), section.createSection);

// Admin: fields management (by sectionId; keep admin-only)
router.post("/sections/:sectionId/fields", requireRole("admin"), field.addField);
router.get("/sections/:sectionId/fields", requireRole("admin"), field.listFields);
router.patch("/sections/:sectionId/fields/reorder", requireRole("admin"), field.reorderFields);

// Read section meta (includes fields) by slug — must have read access
router.get("/sections/:slug", loadSectionBySlug, requireSectionRead, section.getSectionBySlug);

// Records — per-section checks by slug
router.get("/data/:slug", loadSectionBySlug, requireSectionRead, record.listRecords);
router.get("/data/:slug/export", loadSectionBySlug, requireSectionRead, record.exportCsv);

router.post("/data/:slug", loadSectionBySlug, requireSectionWrite, record.createRecord);
router.put("/data/:slug/:recordId", loadSectionBySlug, requireSectionWrite, record.updateRecord);
router.delete("/data/:slug/:recordId", loadSectionBySlug, requireSectionWrite, record.deleteRecord);

// after existing imports & admin guards
router.put("/sections/:sectionId", requireRole("admin"), section.updateSection);
router.delete("/sections/:sectionId", requireRole("admin"), section.deleteSection);

router.put("/sections/:sectionId/fields/:fieldId", requireRole("admin"), field.updateField);
router.delete("/sections/:sectionId/fields/:fieldId", requireRole("admin"), field.deleteField);

module.exports = router;
