const express = require("express");
const router = express.Router();
const multer = require("multer");
const { protect, requireRole } = require("../middleware/authMiddleware");
const { uploadTimesheet, getTimesheets } = require("../controllers/candidate.timesheetController");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/timesheets"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

router.get("/", protect, requireRole("candidate"), getTimesheets);
router.post("/", protect, requireRole("candidate"), upload.single("file"), uploadTimesheet);

module.exports = router;
