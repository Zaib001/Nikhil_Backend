const express = require("express");
const router = express.Router();
const {
  getAllPtoRequests,
  updatePtoStatus,
} = require("../controllers/adminPto.controller");

const { protect, requireRole } = require("../middleware/authMiddleware");

router.use(protect); 
router.use(requireRole("admin"));

router.get("/", getAllPtoRequests);
router.patch("/:id", updatePtoStatus);

module.exports = router;
