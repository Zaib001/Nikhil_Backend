const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/authMiddleware");
const {
  getRecruiterDashboard,
  importExcelSubmissions
} = require("../controllers/recruiterController");

router.get("/dashboard", protect, requireRole("recruiter"), getRecruiterDashboard);
router.post("/import", protect, requireRole("recruiter"), importExcelSubmissions);

module.exports = router;
