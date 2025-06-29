const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/authMiddleware");
const {
  getRecruiterTimesheets,
  submitRecruiterTimesheet
} = require("../controllers/recruiterTimesheetController");

router.get("/", protect, requireRole("recruiter"), getRecruiterTimesheets);
router.post("/", protect, requireRole("recruiter"), submitRecruiterTimesheet);

module.exports = router;
