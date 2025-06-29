const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/authMiddleware");
const {
  getSubmissions,
  createSubmission,
  updateSubmission,
  deleteSubmission,
} = require("../controllers/candidate.submissionController");
const User = require("../models/User");

router.get("/", protect, requireRole("candidate"), getSubmissions);
router.post("/", protect, requireRole("candidate"), createSubmission);
router.put("/:id", protect, requireRole("candidate"), updateSubmission);
router.delete("/:id", protect, requireRole("candidate"), deleteSubmission);
router.get("/recruiters", protect, async (req, res) => {
  try {
    const recruiters = await User.find({ role: "recruiter" }).select("_id name email");
    res.status(200).json(recruiters);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch recruiters" });
  }
});
module.exports = router;
