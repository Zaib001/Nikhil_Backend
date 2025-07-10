const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/authMiddleware");
const {
  getRecruiterSubmissions,
  createRecruiterSubmission,
  bulkImportSubmissions,
} = require("../controllers/recruiterSubmissionController");

router.get("/", protect, requireRole("recruiter"), getRecruiterSubmissions);
router.post("/", protect, requireRole("recruiter"), createRecruiterSubmission);
router.post("/bulk", protect, requireRole("recruiter"), bulkImportSubmissions);

module.exports = router;
