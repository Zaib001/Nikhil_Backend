const Salary = require("../models/Salary");
const User = require("../models/User");
const Timesheet = require('../models/Timesheet');
const PTORequest = require("../models/PTORequest");
const { Parser } = require("json2csv");
const PDFDocument = require("pdfkit");
const stream = require("stream");
const sendEmail = require("../utils/sendEmail");

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

const getAllSalaries = async (req, res) => {
  const { month } = req.query;
  const filter = month ? { month } : {};
  const salaries = await Salary.find(filter).populate("userId", "name email role");
  res.json(salaries);
};
const addSalary = async (req, res) => {
  const {
    userId,
    month,
    base,
    bonus = 0,
    currency,
    payType = "fixed",
    mode = "month",
    vendorBillRate = 0,
    candidateShare = 0,
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
  } = req.body;

  try {
    if (!userId || !month || !base) {
      return res.status(400).json({ message: "Missing required fields (userId, month, baseSalary)" });
    }

    if (isNaN(base) || base < 1000) {
      return res.status(400).json({ message: "Base salary must be a valid number and at least 1000" });
    }

    const monthPattern = /^\d{4}-\d{2}$/;
    if (!monthPattern.test(month)) {
      return res.status(400).json({ message: "Month must be in 'YYYY-MM' format" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const userRole = user.role;
    const ptoLimit = user.ptoLimit ?? 10;
    const workingDays = user.workingDays ?? 30;
    const standardMonthlyHours = 160;

    if (userRole === "recruiter") {
      const monthlyBase = mode === "annum" ? base / 12 : base;
      const salary = await Salary.create({
        userId,
        month,
        base,
        finalAmount: monthlyBase,
        currency: currency || user.currency,
        remarks: "Recruiter salary entry",
        mode,
      });
      return res.status(201).json({ message: "Recruiter salary added", salary });
    }

    const start = new Date(`${month}-01`);
    const end = new Date(`${month}-31`);

    const unpaidLeaveDays = await calculateUnpaidLeaves(userId, month, ptoLimit);
    const approvedTimesheets = await Timesheet.find({
      user: userId,
      status: "approved",
      from: { $lt: end },
      to: { $gte: start },
    });

    const totalHours = approvedTimesheets.reduce((sum, t) => sum + (t.hours || 0), 0);
    let hourlyRate = 0;
    let finalAmount = 0;

    if (payType === "fixed") {
      const monthlySalary = mode === "annum" ? base / 12 : base;
      hourlyRate = monthlySalary / standardMonthlyHours;
      finalAmount = hourlyRate * totalHours;
    } else if (payType === "percentage") {
      finalAmount = (vendorBillRate * candidateShare) / 100;
      hourlyRate = totalHours ? finalAmount / totalHours : 0;
    }

    // Bonus Logic
    const parsedBonus = Number(bonusAmount) || 0;
    const isRecurringBonusValid =
      isBonusRecurring && bonusEndMonth && new Date(bonusEndMonth + "-01") >= new Date(month + "-01");
    const isOneTimeBonusValid = !isBonusRecurring && month === month;

    if (parsedBonus && (isRecurringBonusValid || isOneTimeBonusValid)) {
      finalAmount += parsedBonus;
    }

    // Leave deduction (optional)
    const leaveDeduction =
      enablePTO && unpaidLeaveDays > 0
        ? (base / workingDays) * unpaidLeaveDays
        : 0;

    const formattedCustomFields = {};
    for (const key in customFields) {
      formattedCustomFields[key] = String(customFields[key]);
    }

    const salary = await Salary.create({
      userId,
      month,
      base,
      finalAmount: Math.round((finalAmount - leaveDeduction) * 100) / 100,
      hourlyRate,
      bonus: parsedBonus,
      bonusType,
      bonusFrequency,
      bonusStartDate,
      bonusEndDate,
      isBonusRecurring,
      bonusEndMonth,
      currency: currency || user.currency,
      payType,
      mode,
      vendorBillRate,
      candidateShare,
      enablePTO,
      ptoType,
      ptoDaysAllocated,
      customFields: formattedCustomFields,
      previewMonth,
      unpaidLeaveDays,
      remarks:
        unpaidLeaveDays > 0
          ? `${unpaidLeaveDays} unpaid leave(s)`
          : `Paid for ${totalHours} hour(s)`,
    });

    return res.status(201).json({ message: "Candidate salary added", salary });
  } catch (err) {
    console.error("Error in addSalary:", err.message);
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

module.exports = {
  getAllSalaries,
  exportSalariesPDF,
  sendSalarySlip,
  addSalary,
  updateSalary,
  deleteSalary,
  exportSalariesCSV
};
