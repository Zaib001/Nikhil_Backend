const Salary = require("../models/Salary");
const User = require("../models/User");
const Timesheet = require('../models/Timesheet');
const PTORequest = require("../models/PTORequest");
const { Parser } = require("json2csv");
const PDFDocument = require("pdfkit");
const stream = require("stream");
const sendEmail = require("../utils/sendEmail");
const { calculateSalary } = require("./adminSalary.refactored");


const getAllSalaries = async (req, res) => {
  const { month } = req.query;
  const filter = month ? { month } : {};
  const salaries = await Salary.find(filter).populate("userId", "name email role");
  console.log(salaries)
  res.json(salaries);
};
const addSalary = async (req, res) => {
  const {
    userId,
    month,
    base,
    currency,
    bonusAmount = 0,
    bonusType = "one-time",
    bonusFrequency = "monthly",
    bonusStartDate,
    bonusEndDate,
    isBonusRecurring = false,
    bonusEndMonth,
    enablePTO = false,
    ptoType = "monthly",
    ptoDaysAllocated = 0,
    customFields = {},
    previewMonth,
    payType,
    mode,
    vendorBillRate,
    candidateShare,
  } = req.body;

  try {
    if (!userId || !month) {
      return res.status(400).json({ message: "Missing required fields: userId and month" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Calculate base salary for the requested month
    const salaryCalc = await calculateSalary(user, month, {
      base,
      mode,
      ptoType,
      ptoDaysAllocated,
      bonusType,
      bonusStartDate,
      bonusAmount,
    });

    // Bonus logic
    const parsedBonus = Number(bonusAmount) || 0;
    const isRecurringBonusValid =
      isBonusRecurring &&
      bonusEndMonth &&
      new Date(`${bonusEndMonth}-01`) >= new Date(`${month}-01`);
    const isOneTimeBonusValid = !isBonusRecurring && bonusType === "one-time";

    if (parsedBonus && (isRecurringBonusValid || isOneTimeBonusValid)) {
      salaryCalc.finalPay += parsedBonus;
    }

    // Format custom fields (ensure all values are strings)
    const formattedCustomFields = {};
    for (const key in customFields) {
      formattedCustomFields[key] = String(customFields[key]);
    }

    // Save salary record
    const salary = await Salary.create({
      userId,
      month,
      base,
      finalAmount: Math.round(salaryCalc.finalPay * 100) / 100,
      hourlyRate: salaryCalc.hourlyRate,
      bonus: parsedBonus,
      bonusType,
      bonusFrequency,
      bonusStartDate,
      bonusEndDate,
      isBonusRecurring,
      bonusEndMonth,
      currency: currency || user.currency,
      payType: payType ?? user.payType,
      mode: mode ?? user.salaryMode,
      vendorBillRate: vendorBillRate ?? user.vendorBillRate,
      candidateShare: candidateShare ?? user.candidateShare,
      enablePTO,
      ptoType,
      ptoDaysAllocated,
      customFields: formattedCustomFields,
      previewMonth,
      unpaidLeaveDays: salaryCalc.unpaidLeaveDays || 0,
      remarks: `Worked ${salaryCalc.workedHours} hour(s) at $${salaryCalc.hourlyRate.toFixed(2)}/hr`,
    });

    const futureProjections = [];
    const projectionCount = 12;

    for (let i = 1; i <= projectionCount; i++) {
      const [year, monthNum] = month.split("-").map(Number);
      const projectedDate = new Date(year, monthNum - 1 + i);
      const projectedMonth = `${projectedDate.getFullYear()}-${String(projectedDate.getMonth() + 1).padStart(2, "0")}`;

      const projectedCalc = await calculateSalary(user, projectedMonth);

      futureProjections.push({
        month: projectedMonth,
        finalPay: +projectedCalc.finalPay.toFixed(2),
        workedHours: projectedCalc.workedHours,
        expectedHours: projectedCalc.expectedHours,
        bonus: projectedCalc.bonus,
        ptoDeduction: projectedCalc.ptoDeduction,
      });
    }

    return res.status(201).json({
      message: "Salary added successfully",
      salary,
      futureProjections, 
    });

  } catch (error) {
    console.error("Error in addSalary:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};






const updateSalary = async (req, res) => {
  const {
    base,
    bonus,
    currency,
    payType,
    mode,
    vendorBillRate,
    candidateShare,
    bonusAmount,
    bonusType,
    bonusFrequency,
    bonusStartDate,
    bonusEndDate,
    isBonusRecurring,
    bonusEndMonth,
    enablePTO,
    ptoType,
    ptoDaysAllocated,
    previewMonth,
  } = req.body;

  const salary = await Salary.findById(req.params.id);
  if (!salary) return res.status(404).json({ message: "Salary not found" });

  Object.assign(salary, {
    base: base ?? salary.base,
    bonus: bonus ?? salary.bonus,
    bonusAmount: bonusAmount ?? salary.bonusAmount,
    bonusType: bonusType ?? salary.bonusType,
    bonusFrequency: bonusFrequency ?? salary.bonusFrequency,
    bonusStartDate: bonusStartDate ?? salary.bonusStartDate,
    bonusEndDate: bonusEndDate ?? salary.bonusEndDate,
    isBonusRecurring: isBonusRecurring ?? salary.isBonusRecurring,
    bonusEndMonth: bonusEndMonth ?? salary.bonusEndMonth,
    currency: currency ?? salary.currency,
    payType: payType ?? salary.payType,
    mode: mode ?? salary.mode,
    vendorBillRate: vendorBillRate ?? salary.vendorBillRate,
    candidateShare: candidateShare ?? salary.candidateShare,
    enablePTO: enablePTO ?? salary.enablePTO,
    ptoType: ptoType ?? salary.ptoType,
    ptoDaysAllocated: ptoDaysAllocated ?? salary.ptoDaysAllocated,
    previewMonth: previewMonth ?? salary.previewMonth,
  });

  await salary.save();
  res.json({ message: "Salary updated", salary });
};



const deleteSalary = async (req, res) => {
  const deleted = await Salary.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: "Salary not found" });
  res.json({ message: "Salary deleted" });
};

const exportSalariesCSV = async (req, res) => {
  const salaries = await Salary.find().populate("userId", "name email");

  const data = salaries.map(s => ({
    Name: s.userId?.name,
    Email: s.userId?.email,
    Currency: s.currency,
    BaseSalary: s.baseSalary,
    Bonus: s.bonus,
    FinalAmount: s.finalAmount,
    Month: s.month,
    Remarks: s.remarks,
  }));

  const fields = ["Name", "Email", "Currency", "BaseSalary", "Bonus", "FinalAmount", "Month", "Remarks"];
  const parser = new Parser({ fields });
  const csv = parser.parse(data);

  res.header("Content-Type", "text/csv");
  res.attachment("salaries.csv");
  return res.send(csv);
};

const exportSalariesPDF = async (req, res) => {
  const salaries = await Salary.find().populate("userId", "name email");

  const doc = new PDFDocument();
  const passthrough = new stream.PassThrough();

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="salaries.pdf"');

  doc.pipe(passthrough);
  doc.fontSize(16).text("Salary Report", { align: "center" }).moveDown();

  salaries.forEach((s, index) => {
    doc.fontSize(12).text(`${index + 1}. ${s.userId?.name} (${s.userId?.email})`);
    doc.text(`   Month: ${s.month} | Currency: ${s.currency}`);
    doc.text(`   Base: ${s.baseSalary} | Bonus: ${s.bonus} | Final: ${s.finalAmount}`);
    doc.text(`   Remarks: ${s.remarks || "-"}`).moveDown();
  });

  doc.end();
  passthrough.pipe(res);
};

const sendSalarySlip = async (req, res) => {
  const { id } = req.params;
  const salary = await Salary.findById(id).populate("userId", "email name");
  if (!salary) return res.status(404).json({ message: "Salary not found" });

  const doc = new PDFDocument();
  const streamBuf = new stream.PassThrough();
  const chunks = [];

  doc.pipe(streamBuf);
  doc.fontSize(16).text(`Salary Slip - ${salary.userId.name}`, { align: "center" }).moveDown();
  doc.fontSize(12).text(`Month: ${salary.month}`);
  doc.text(`Currency: ${salary.currency}`);
  doc.text(`Base Salary: ${salary.baseSalary}`);
  doc.text(`Bonus: ${salary.bonus}`);
  doc.text(`Unpaid Leave Days: ${salary.unpaidLeaveDays}`);
  doc.text(`Final Amount: ${salary.finalAmount}`);
  doc.text(`Remarks: ${salary.remarks || "None"}`);
  doc.end();

  streamBuf.on("data", chunk => chunks.push(chunk));
  streamBuf.on("end", async () => {
    const buffer = Buffer.concat(chunks);
    await sendEmail(
      salary.userId.email,
      "Your Salary Slip",
      `<p>Dear ${salary.userId.name},</p><p>Please find your salary slip for ${salary.month} attached.</p>`,
      [{ filename: "SalarySlip.pdf", content: buffer }]
    );
    res.json({ message: "Salary slip emailed successfully." });
  });
};
const getSalaryProjections = async (req, res) => {
  try {
    const {
      userId,
      month,
      base,
      mode,
      ptoType,
      ptoDaysAllocated,
      bonusType,
      bonusStartDate,
      bonusEndDate,
      bonusAmount,
      payType,
      payTypeEffectiveDate,
      fixedPhaseDuration,
      vendorBillRate,
      candidateShare,
      isBonusRecurring,
      bonusEndMonth,
      enablePTO,
      previewMonth,
      customFields,
    } = req.body;

    if (!userId || !month) {
      return res.status(400).json({ message: "userId and month are required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const futureProjections = [];
    const projectionCount = 3;

    for (let i = 0; i < projectionCount; i++) {
      const [year, mon] = month.split("-").map(Number);
      const futureDate = new Date(year, mon - 1 + i);
      const futureMonthStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}`;

      const futureSalary = await calculateSalary(user, futureMonthStr, {
        base: base ?? user.annualSalary / 12,
        mode,
        ptoType,
        ptoDaysAllocated,
        bonusType,
        bonusStartDate,
        bonusEndDate,
        bonusAmount,
        payType,
        payTypeEffectiveDate,
        fixedPhaseDuration,
        vendorBillRate: vendorBillRate ?? user.vendorBillRate,
        candidateShare: candidateShare ?? user.candidateShare,
        isBonusRecurring,
        bonusEndMonth,
        enablePTO,
        previewMonth,
        customFields,
      }, true); // <- important for projection mode

      futureProjections.push({
        month: futureMonthStr,
        finalPay: +futureSalary.finalPay.toFixed(2),
        workedHours: futureSalary.workedHours,
        expectedHours: futureSalary.expectedHours,
        bonus: futureSalary.bonus,
        ptoDeduction: futureSalary.ptoDeduction,
      });
    }

    return res.json({ projections: futureProjections });
  } catch (err) {
    console.error("Error in getSalaryProjections:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
};



module.exports = {
  getAllSalaries,
  exportSalariesPDF,
  sendSalarySlip,
  addSalary,
  updateSalary,
  deleteSalary,
  exportSalariesCSV,
  getSalaryProjections
};
