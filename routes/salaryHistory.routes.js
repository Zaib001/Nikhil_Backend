const express = require("express");
const router = express.Router();
const {
  getSalaryHistory,
  addSalaryHistoryEntry,
} = require("../controllers/salaryHistory.controller");

const { protect, requireRole } = require("../middleware/authMiddleware");

router.use(protect); 
router.use(requireRole("admin"));

router.get("/", getSalaryHistory);

router.post("/", addSalaryHistoryEntry);

module.exports = router;
