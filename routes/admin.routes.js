const express = require("express");
const router = express.Router();
const { getAdminDashboardStats } = require("../controllers/adminDashboardController");

const { protect, requireRole } = require("../middleware/authMiddleware");

router.use(protect); 
router.use(requireRole("admin"));

router.get("/dashboard-stats", getAdminDashboardStats);

module.exports = router;