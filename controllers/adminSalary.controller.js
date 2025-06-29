const Salary = require("../models/Salary");
const User = require("../models/User");
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

// ✅ Add salary
const addSalary = async (req, res) => {
  const {
    userId,
    month,
    baseSalary,
    bonus = 0,
    isBonusRecurring = false,
    bonusEndMonth,
    currency,
  } = req.body;

  const exists = await Salary.findOne({ userId, month });
  if (exists) return res.status(409).json({ message: "Salary already exists for this month." });

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: "User not found." });

  const ptoLimit = user.ptoLimit ?? 10;
  const workingDays = user.workingDays ?? 30;

  const unpaidLeaveDays = await calculateUnpaidLeaves(userId, month, ptoLimit);
  const dailyRate = baseSalary / workingDays;
  const deduction = dailyRate * unpaidLeaveDays;
  const finalAmount = Math.round((baseSalary + bonus - deduction) * 100) / 100;

  const salary = await Salary.create({
    userId,
    month,
    baseSalary,
    bonus,
    isBonusRecurring,
    bonusEndMonth,
    currency: currency || user.currency,
    unpaidLeaveDays,
    finalAmount,
    remarks: unpaidLeaveDays > 0 ? `${unpaidLeaveDays} unpaid leave(s)` : "Full salary",
  });

  res.status(201).json({ message: "Salary calculated and added", salary });
};

// ✅ Update salary
const updateSalary = async (req, res) => {
  const { baseSalary, bonus, isBonusRecurring, bonusEndMonth, currency } = req.body;
  const salary = await Salary.findById(req.params.id);
  if (!salary) return res.status(404).json({ message: "Salary not found" });

  Object.assign(salary, {
    baseSalary: baseSalary ?? salary.baseSalary,
    bonus: bonus ?? salary.bonus,
    isBonusRecurring: isBonusRecurring ?? salary.isBonusRecurring,
    bonusEndMonth: bonusEndMonth ?? salary.bonusEndMonth,
    currency: currency ?? salary.currency,
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
