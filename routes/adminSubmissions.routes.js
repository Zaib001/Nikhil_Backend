const express = require("express");
const router = express.Router();
const {
  getAllSubmissions,
  updateSubmission,
  deleteSubmission,
  exportSubmissionsCSV,
  exportSubmissionsPDF,
  assignReviewer,
  getSubmissionsAnalytics,
  importSubmissions
} = require("../controllers/adminSubmissions.controller");

const { protect, requireRole } = require("../middleware/authMiddleware");
const multer = require("multer");
const upload = multer();

router.post(
  "/import",
  upload.single("file"),
  protect,
  requireRole("admin"),
  importSubmissions
);

router.use(protect);
router.use(requireRole("admin"));

router.get("/", getAllSubmissions);
router.put("/:id", updateSubmission);
router.delete("/:id", deleteSubmission);
router.put("/:id/reviewer", assignReviewer);
router.get("/export/csv", exportSubmissionsCSV);
router.get("/export/pdf", exportSubmissionsPDF);
router.get("/analytics", getSubmissionsAnalytics);

module.exports = router;
