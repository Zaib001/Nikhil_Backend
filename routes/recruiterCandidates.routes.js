const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/authMiddleware");
const {
  getCandidates,
  createCandidate,
  updateCandidate,
  deleteCandidate
} = require("../controllers/recruiterCandidatesController");

router.get("/", protect, requireRole("recruiter"), getCandidates);
router.post("/", protect, requireRole("recruiter"), createCandidate);
router.put("/:id", protect, requireRole("recruiter"), updateCandidate);
router.delete("/:id", protect, requireRole("recruiter"), deleteCandidate);

module.exports = router;
