const express = require("express");
const router = express.Router();
const {
  getSalaryHistory,
  addSalaryHistoryEntry,
} = require("../controllers/salaryHistory.controller");

const { protect, requireRole } = require("../middleware/authMiddleware");

router.use(protect); 
router.use(requireRole("admin"));

// View all history for a user or all
router.get("/", getSalaryHistory);

// Add a history entry manually (fallback/debug use)
router.post("/", addSalaryHistoryEntry);

module.exports = router;
