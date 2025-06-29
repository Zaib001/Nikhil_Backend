const express = require("express");
const router = express.Router();
const { getAdminDashboardStats } = require("../controllers/adminDashboardController");

router.get("/dashboard-stats", getAdminDashboardStats);

module.exports = router;