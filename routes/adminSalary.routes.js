const express = require("express");
const router = express.Router();
const {
  getAllSalaries,
  addSalary,
  updateSalary,
  deleteSalary,
  exportSalariesCSV,
  exportSalariesPDF,
  sendSalarySlip,
  getSalaryProjections
} = require("../controllers/adminSalary.controller");

const { protect, requireRole } = require("../middleware/authMiddleware");

router.use(protect); 
router.use(requireRole("admin"));

router.get("/", getAllSalaries);
router.post("/", addSalary);
router.put("/:id", updateSalary);
router.delete("/:id", deleteSalary);

router.get("/export/csv", exportSalariesCSV);
router.get("/export/pdf", exportSalariesPDF);
router.post("/:id/send-slip", sendSalarySlip);
router.post("/projections", getSalaryProjections);

module.exports = router;
