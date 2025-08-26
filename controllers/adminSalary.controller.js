const Salary = require("../models/Salary");
const User = require("../models/User");
const Timesheet = require('../models/Timesheet');
const PTORequest = require("../models/PTORequest");
const { Parser } = require("json2csv");
const PDFDocument = require("pdfkit");
const stream = require("stream");
const sendEmail = require("../utils/sendEmail");
const US_HOLIDAYS = require("../data/holidays.json");


const getAllSalaries = async (req, res) => {
  const { month } = req.query;
  const filter = month ? { month } : {};
  const salaries = await Salary.find(filter).populate("userId", "name email role");
  console.log(salaries)
  res.json(salaries);
};

const getWorkingDays = (year, month) => {
  const date = new Date(year, month - 1, 1);
  let count = 0;
  while (date.getMonth() === month - 1) {
    if (date.getDay() >= 1 && date.getDay() <= 5) count++; // Mon-Fri
    date.setDate(date.getDate() + 1);
  }
  return count;
};

const getWorkedDays = async (userId, monthStr) => {
  const [year, mon] = monthStr.split("-").map(Number);
  const start = new Date(year, mon - 1, 1);
  const end = new Date(year, mon, 0);

  const timesheets = await Timesheet.find({
    user: userId,
    date: { $gte: start, $lte: end },
    status: "approved"
  });

  return timesheets.filter(ts => ts.status === "worked").length;
};

const getOffDays = async (userId, monthStr) => {
  const [year, mon] = monthStr.split("-").map(Number);
  const start = new Date(year, mon - 1, 1);
  const end = new Date(year, mon, 0);

  const timesheets = await Timesheet.find({
    user: userId,
    date: { $gte: start, $lte: end },
    status: "approved"
  });

  return timesheets.filter(ts => ts.status === "off").length;
};

const getCarryForwardPTO = async (userId, currentMonth) => {
  const prevMonth = new Date(new Date(currentMonth + "-01").setMonth(new Date(currentMonth + "-01").getMonth() - 1))
    .toISOString().slice(0, 7);

  const prevSalary = await Salary.findOne({
    userId,
    month: prevMonth
  });

  if (!prevSalary) return 0;

  const allowedPTO = prevSalary.ptoDaysAllocated || 1;
  const usedPTO = prevSalary.offDays || 0;
  const unusedPTO = Math.max(0, allowedPTO - usedPTO);

  return unusedPTO;
};
const calculateSalary = async (user, monthStr, config = {}, isProjection = false) => {
  const [year, mon] = monthStr.split("-").map(Number);
  const workingDays = getWorkingDays(year, mon);
  const role = user.role;

  // Get PTO settings
  const basePTO = config.ptoDaysAllocated ?? user.ptoDaysAllocated ?? 1;
  const carryForwardPTO = await getCarryForwardPTO(user._id, monthStr);
  const allowedPTO = basePTO + carryForwardPTO;

  let workedDays = 0;
  let offDays = 0;
  let unpaidDays = 0;

  if (!isProjection) {
    workedDays = await getWorkedDays(user._id, monthStr);
    offDays = await getOffDays(user._id, monthStr);
    unpaidDays = Math.max(0, offDays - allowedPTO);
  } else {
    workedDays = workingDays - (config.ptoDaysAllocated || 1);
    offDays = config.ptoDaysAllocated || 1;
    unpaidDays = 0;
  }

  let basePay = 0;
  let finalPay = 0;
  let ptoDeduction = 0;
  let bonus = 0;
  let hourlyRate = 0;

  if (role === "recruiter") {
    // Recruiter salary logic
    basePay = config?.base ?? (user.salaryType === "yearly" ? user.annualSalary / 12 : user.monthlySalary);
    const perDaySalary = basePay / workingDays;
    ptoDeduction = unpaidDays * perDaySalary;
    finalPay = basePay - ptoDeduction;

    // Bonus calculation
    const bonusAmount = config.bonusAmount ?? user.bonusAmount ?? 0;
    if (bonusAmount > 0) {
      if (config.bonusType === "one-time" || user.bonusType === "one-time") {
        bonus = bonusAmount;
      } else if (new Date(monthStr + "-01") >= new Date(config.bonusStartDate || user.bonusStartDate) &&
        new Date(monthStr + "-01") <= new Date(config.bonusEndDate || user.bonusEndDate)) {
        bonus = bonusAmount;
      }
    }
    finalPay += bonus;

  } else {
    // Candidate salary logic
    const joined = new Date(user.joiningDate);
    const currentDate = new Date(year, mon - 1, 1);
    const monthsWorked = (currentDate.getFullYear() - joined.getFullYear()) * 12 +
      (currentDate.getMonth() - joined.getMonth());
    const shouldUsePercentage = monthsWorked >= (user.percentagePayAfterMonths || 6);

    if (!shouldUsePercentage) {
      // Fixed pay mode
      basePay = (config.annualSalary ?? user.annualSalary ?? 0) / 12;
      hourlyRate = basePay / (workingDays * 8);
      finalPay = (workedDays * 8) * hourlyRate;
    } else {
      // Percentage pay mode
      const clientRate = config.vendorBillRate ?? user.vendorBillRate ?? 0;
      const percentage = config.candidateShare ?? user.candidateShare ?? 0;
      hourlyRate = clientRate * (percentage / 100);
      finalPay = (workedDays * 8) * hourlyRate;
    }

    // PTO deduction for candidates
    if (config.enablePTO || user.enablePTO) {
      ptoDeduction = unpaidDays * 8 * hourlyRate;
      finalPay -= ptoDeduction;
    }
  }

  return {
    userId: user._id,
    role,
    month: monthStr,
    workingDays,
    workedDays,
    offDays,
    unpaidDays,
    hourlyRate: +Number(hourlyRate || 0).toFixed(2),
    ptoDeduction: +Number(ptoDeduction || 0).toFixed(2),
    bonus: +Number(bonus || 0).toFixed(2),
    basePay: +Number(basePay || 0).toFixed(2),
    finalPay: +Number(finalPay || 0).toFixed(2),
    carryForwardPTO,
    allowedPTO
  };

};

const addSalary = async (req, res) => {
  const {
    userId,
    month,
    base,
    currency,
    bonusAmount = 0,
    bonusType = "one-time",
    isBonusRecurring = false,
    bonusStartDate,
    bonusEndDate,
    enablePTO = false,
    ptoDaysAllocated = 1,
    payType,
    mode,
    vendorBillRate,
    candidateShare,
    salaryType = "monthly"
  } = req.body;

  try {
    if (!userId || !month) {
      return res.status(400).json({ message: "Missing required fields: userId and month" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Calculate salary
    const salaryCalc = await calculateSalary(user, month, {
      base,
      mode,
      ptoDaysAllocated,
      bonusType,
      bonusAmount,
      bonusStartDate,
      bonusEndDate,
      enablePTO,
      payType,
      vendorBillRate,
      candidateShare,
      salaryType
    });

    // Save salary record
    const salary = await Salary.create({
      userId,
      month,
      base: salaryCalc.basePay,
      finalAmount: salaryCalc.finalPay,
      hourlyRate: salaryCalc.hourlyRate,
      bonus: salaryCalc.bonus,
      bonusType,
      isBonusRecurring,
      bonusStartDate,
      bonusEndDate,
      currency: currency || user.currency,
      payType: payType ?? user.payType,
      salaryMode: mode ?? user.salaryMode,
      vendorBillRate: vendorBillRate ?? user.vendorBillRate,
      candidateShare: candidateShare ?? user.candidateShare,
      enablePTO,
      ptoDaysAllocated,
      workingDays: salaryCalc.workingDays,
      workedDays: salaryCalc.workedDays,
      offDays: salaryCalc.offDays,
      unpaidDays: salaryCalc.unpaidDays,
      carryForwardPTO: salaryCalc.carryForwardPTO,
      allowedPTO: salaryCalc.allowedPTO
    });

    // Generate 12-month projection
    const futureProjections = [];
    for (let i = 1; i <= 12; i++) {
      const [year, monthNum] = month.split("-").map(Number);
      const projectedDate = new Date(year, monthNum - 1 + i, 1);
      const projectedMonth = projectedDate.toISOString().slice(0, 7);

      const projection = await calculateSalary(user, projectedMonth, {
        ...req.body,
        month: projectedMonth
      }, true);

      futureProjections.push({
        month: projectedMonth,
        basePay: projection.basePay,
        finalPay: projection.finalPay,
        workingDays: projection.workingDays,
        allowedPTO: projection.allowedPTO
      });
    }

    return res.status(201).json({
      message: "Salary added successfully",
      salary,
      futureProjections
    });

  } catch (error) {
    console.error("Error in addSalary:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
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
