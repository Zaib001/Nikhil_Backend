const express = require("express");
const router = express.Router();
const {
  getAllTimesheets,
  getTimesheetById,
  createTimesheet,
  updateTimesheet,
  deleteTimesheet,
  generateTimesheetPDF
} = require("../controllers/adminTimesheetController");

const { protect, requireRole } = require("../middleware/authMiddleware");

router.use(protect); 
router.use(requireRole("admin"));

router.get("/", getAllTimesheets);
router.get("/:id", getTimesheetById);
router.post("/", createTimesheet);
router.put("/:id", updateTimesheet);
router.delete("/:id", deleteTimesheet);
router.get("/:userId/:month", generateTimesheetPDF);

module.exports = router;
