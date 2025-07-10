const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/authMiddleware");
const { getRecruiterPTO, submitRecruiterPTO } = require("../controllers/recruiterPtoController");

router.get("/", protect, requireRole("recruiter"), getRecruiterPTO);
router.post("/", protect, requireRole("recruiter"), submitRecruiterPTO);

module.exports = router;
