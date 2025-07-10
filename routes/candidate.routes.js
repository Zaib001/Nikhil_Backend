const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/authMiddleware");
const {
  getCandidateDashboard,
  getCandidateProfile,
  updateCandidateProfile,
} = require("../controllers/candidateController");

router.get("/dashboard", protect, requireRole("candidate"), getCandidateDashboard);
router.get("/profile", protect, requireRole("candidate"), getCandidateProfile);
router.put("/profile", protect, requireRole("candidate"), updateCandidateProfile);

module.exports = router;
