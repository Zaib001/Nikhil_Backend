const express = require("express");
const router = express.Router();
const {
  exportCandidatesExcel,
  getSubmissionAnalytics,
  getConversionReport,
  sendReportByEmail,
  generateChartImage,
} = require("../controllers/admin.report.controller");

// Export candidate list to Excel
router.get("/candidates", exportCandidatesExcel);

// Submission analytics (bar/pie charts)
router.get("/submissions", getSubmissionAnalytics);

// Conversion % per recruiter
router.get("/conversions", getConversionReport);

// Send email report
router.post("/email", sendReportByEmail);

// Get chart as image (PNG)
router.get("/charts/image", generateChartImage);

module.exports = router;
