const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/authMiddleware");
const {
  getRecruiterSubmissions,
  createRecruiterSubmission,
  bulkImportSubmissions,
} = require("../controllers/recruiterSubmissionController");

const multer = require("multer");
const upload = multer();

// GET all submissions for recruiter
router.get("/", protect, requireRole("recruiter"), getRecruiterSubmissions);

// POST a single submission
router.post("/", protect, requireRole("recruiter"), createRecruiterSubmission);

// POST bulk import (Excel upload)
router.post(
  "/bulk",
  upload.single("file"),          
  protect,                        
  requireRole("recruiter"),
  bulkImportSubmissions
);


module.exports = router;
