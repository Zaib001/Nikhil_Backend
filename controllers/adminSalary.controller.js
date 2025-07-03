const Salary = require("../models/Salary");
const User = require("../models/User");
const Timesheet = require('../models/Timesheet');
const PTORequest = require("../models/PTORequest");
const { Parser } = require("json2csv");
const PDFDocument = require("pdfkit");
const stream = require("stream");
const sendEmail = require("../utils/sendEmail");

// Helper to calculate unpaid leaves
const calculateUnpaidLeaves = async (userId, month, ptoLimit) => {
  const [year, monthNum] = month.split("-").map(Number);
  const start = new Date(`${month}-01`);
  const end = new Date(`${month}-31`);

  const leaves = await PTORequest.find({
    requestedBy: userId,
    status: "approved",
    from: { $lte: end },
    to: { $gte: start },
  });

  let totalDays = 0;
  for (let leave of leaves) {
    const from = new Date(Math.max(new Date(leave.from), start));
    const to = new Date(Math.min(new Date(leave.to), end));
    const days = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;
    totalDays += days;
  }

  const unpaidDays = Math.max(0, totalDays - ptoLimit);
  return unpaidDays;
};

// ✅ Get all salaries
const getAllSalaries = async (req, res) => {
  const { month } = req.query;
  const filter = month ? { month } : {};
  const salaries = await Salary.find(filter).populate("userId", "name email role");
  res.json(salaries);
};
const addSalary = async (req, res) => {
  const {
    userId,
    month, // format: "2025-06"
    baseSalary,
    bonus = 0,
    isBonusRecurring = false,
    bonusEndMonth,
    currency,
    customFields = {},
    mode = "month", // "month" or "year"
    payType = "fixed", 
    payTypeEffectiveDate,
    fixedPhaseDuration = 0,
    vendorBillRate = 0,
    candidateShare = 0,
    bonusAmount = 0,
    bonusType = "one-time",
    bonusFrequency = "monthly",
    bonusStartDate,
    bonusEndDate,
    enablePTO = false,
    ptoType = "monthly",
    ptoDaysAllocated = 0,
    previewMonth,
  } = req.body;

  try {
    // Log the incoming request data
    console.log("Received request data:", req.body);

    // Validate required fields
    if (!userId || !month || !baseSalary) {
      console.log("Validation failed: Missing required fields");
      return res.status(400).json({ message: "Missing required fields (userId, month, baseSalary)" });
    }

    // Validate that the base salary is a valid number
    if (isNaN(baseSalary) || baseSalary < 1000) {
      console.log("Validation failed: Invalid baseSalary");
      return res.status(400).json({ message: "Base salary must be a valid number and at least 1000" });
    }

    // Validate that month is in correct format (YYYY-MM)
    const monthPattern = /^\d{4}-\d{2}$/;
    if (!monthPattern.test(month)) {
      console.log("Validation failed: Invalid month format");
      return res.status(400).json({ message: "Month must be in 'YYYY-MM' format" });
    }

    // Ensure the user exists in the system
    const user = await User.findById(userId);
    if (!user) {
      console.log("User not found:", userId);
      return res.status(404).json({ message: "User not found" });
    }

    console.log("User found:", user);

    const ptoLimit = user.ptoLimit ?? 10;
    const workingDays = user.workingDays ?? 30;
    const standardMonthlyHours = 160;

    const calculateForMonth = async (year, monthNum) => {
      let attemptMonth = monthNum;
      let attemptYear = year;

      for (let i = 0; i < 12; i++) {
        const paddedMonth = attemptMonth.toString().padStart(2, '0');
        const monthStr = `${attemptYear}-${paddedMonth}`;

        const exists = await Salary.findOne({ userId, month: monthStr });
        if (!exists) {
          const unpaidLeaveDays = await calculateUnpaidLeaves(userId, monthStr, ptoLimit);

          const startDate = new Date(attemptYear, attemptMonth - 1, 1);
          const endDate = new Date(attemptYear, attemptMonth, 1);

          const approvedTimesheets = await Timesheet.find({
            user: userId,
            status: 'approved',
            from: { $lt: endDate },
            to: { $gte: startDate },
          });

          const totalHours = approvedTimesheets.reduce((sum, t) => sum + (t.hours || 0), 0);
          const hourlyRate = baseSalary / standardMonthlyHours;
          let calculatedAmount = totalHours * hourlyRate;

          const parsedBonus = Number(bonusAmount) || 0;
          const isRecurringBonusValid =
            isBonusRecurring &&
            bonusEndMonth &&
            new Date(bonusEndMonth + "-01") >= new Date(monthStr + "-01");

          const isOneTimeBonusValid = !isBonusRecurring && monthStr === month;

          const shouldApplyBonus = parsedBonus && (isRecurringBonusValid || isOneTimeBonusValid);

          if (shouldApplyBonus) {
            calculatedAmount += parsedBonus;
          }

          const dailyRate = baseSalary / workingDays;
          const leaveDeduction = dailyRate * unpaidLeaveDays;

          const finalAmount = Math.round((calculatedAmount - leaveDeduction) * 100) / 100;

          const formattedCustomFields = {};
          for (const key in customFields) {
            if (Object.hasOwnProperty.call(customFields, key)) {
              formattedCustomFields[key] = String(customFields[key]);
            }
          }

          const salary = await Salary.create({
            userId,
            month: monthStr,
            baseSalary,
            bonus: parsedBonus,
            isBonusRecurring,
            bonusEndMonth,
            currency: currency || user.currency,
            unpaidLeaveDays,
            finalAmount,
            payType,
            payTypeEffectiveDate,
            fixedPhaseDuration,
            vendorBillRate,
            candidateShare,
            bonusAmount,
            bonusType,
            bonusFrequency,
            bonusStartDate,
            bonusEndDate,
            enablePTO,
            ptoType,
            ptoDaysAllocated,
            previewMonth,
            customFields: formattedCustomFields,
            remarks: unpaidLeaveDays > 0
              ? `${unpaidLeaveDays} unpaid leave(s)`
              : `Paid for ${totalHours} hour(s)`,
          });

          return { message: `Salary added for ${monthStr}`, salary };
        }

        attemptMonth++;
        if (attemptMonth > 12) {
          attemptMonth = 1;
          attemptYear++;
        }
      }

      return { message: "All months already have salary." };
    };

    const [year, monthNum] = month.split('-').map(Number);
    const result = await calculateForMonth(year, monthNum);

    if (result.salary) {
      console.log("Salary successfully added:", result.salary);
      return res.status(201).json({ message: "Salary calculated and added", salary: result.salary });
    } else {
      console.log("Salary already exists for the month:", month);
      return res.status(409).json(result);
    }
  } catch (err) {
    console.error("Error in addSalary:", err.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};







// ✅ Update salary
const updateSalary = async (req, res) => {
  const { baseSalary, bonus, isBonusRecurring, bonusEndMonth, currency, payType, payTypeEffectiveDate, fixedPhaseDuration, vendorBillRate, candidateShare, bonusAmount, bonusType, bonusFrequency, bonusStartDate, bonusEndDate, enablePTO, ptoType, ptoDaysAllocated, previewMonth } = req.body;
  const salary = await Salary.findById(req.params.id);
  if (!salary) return res.status(404).json({ message: "Salary not found" });

  Object.assign(salary, {
    baseSalary: baseSalary ?? salary.baseSalary,
    bonus: bonus ?? salary.bonus,
    isBonusRecurring: isBonusRecurring ?? salary.isBonusRecurring,
    bonusEndMonth: bonusEndMonth ?? salary.bonusEndMonth,
    currency: currency ?? salary.currency,
    payType: payType ?? salary.payType,
    payTypeEffectiveDate: payTypeEffectiveDate ?? salary.payTypeEffectiveDate,
    fixedPhaseDuration: fixedPhaseDuration ?? salary.fixedPhaseDuration,
    vendorBillRate: vendorBillRate ?? salary.vendorBillRate,
    candidateShare: candidateShare ?? salary.candidateShare,
    bonusAmount: bonusAmount ?? salary.bonusAmount,
    bonusType: bonusType ?? salary.bonusType,
    bonusFrequency: bonusFrequency ?? salary.bonusFrequency,
    bonusStartDate: bonusStartDate ?? salary.bonusStartDate,
    bonusEndDate: bonusEndDate ?? salary.bonusEndDate,
    enablePTO: enablePTO ?? salary.enablePTO,
    ptoType: ptoType ?? salary.ptoType,
    ptoDaysAllocated: ptoDaysAllocated ?? salary.ptoDaysAllocated,
    previewMonth: previewMonth ?? salary.previewMonth,
  });

  await salary.save();
  res.json({ message: "Salary updated", salary });
};


// ✅ Delete salary
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

module.exports = {
  getAllSalaries,
  exportSalariesPDF,
  sendSalarySlip,
  addSalary,
  updateSalary,
  deleteSalary,
  exportSalariesCSV
};
