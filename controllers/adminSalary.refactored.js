const Salary = require("../models/Salary");
const User = require("../models/User");
const Timesheet = require("../models/Timesheet");
const PTORequest = require("../models/PTORequest");
const US_HOLIDAYS = require("../data/holidays.json");

// ✅ Helper to calculate working business days (excluding weekends and holidays)
const getWorkingDays = (year, month, holidays = []) => {
  const date = new Date(year, month - 1, 1);
  let count = 0;
  while (date.getMonth() === month - 1) {
    const isWeekend = [0, 6].includes(date.getDay());
    const isHoliday = holidays.some(h => h.toDateString() === date.toDateString());
    if (!isWeekend && !isHoliday) count++;
    date.setDate(date.getDate() + 1);
  }
  return count;
};

// ✅ Helper to fetch total approved worked hours
const getTotalWorkedHours = async (userId, monthStr) => {
  const [year, mon] = monthStr.split("-").map(Number);
  const start = new Date(year, mon - 1, 1);
  const end = new Date(year, mon, 0);

  const timesheets = await Timesheet.find({
    user: userId,
    from: { $lte: end },
    to: { $gte: start },
    status: "approved"
  });

  return timesheets.reduce((sum, t) => sum + (t.hours || 0), 0);
};

// ✅ PTO deduction logic
const calculateUnpaidLeaves = async (userId, monthStr, ptoType, ptoPerUnit = 1) => {
  const [year, mon] = monthStr.split("-").map(Number);
  const start = new Date(year, mon - 1, 1);
  const end = new Date(year, mon, 0);

  const leaves = await PTORequest.find({
    requestedBy: userId,
    status: "approved",
    from: { $lte: end },
    to: { $gte: start },
  });

  let leaveDays = 0;
  for (const leave of leaves) {
    const from = new Date(Math.max(new Date(leave.from), start));
    const to = new Date(Math.min(new Date(leave.to), end));
    leaveDays += Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;
  }

  return Math.max(0, leaveDays - ptoPerUnit);
};

// ✅ Main Salary Calculation Function
const calculateSalary = async (user, monthStr, salaryConfig = {}) => {
  const [year, mon] = monthStr.split("-").map(Number);
  const start = new Date(year, mon - 1, 1);
  const end = new Date(year, mon, 0);

  const role = user.role;
  const workedHours = await getTotalWorkedHours(user._id, monthStr);
  const holidayDates = Object.keys(US_HOLIDAYS).map(dateStr => new Date(dateStr));
  const expectedDays = getWorkingDays(year, mon, holidayDates);
  const expectedHours = expectedDays * 8;

  let hourlyRate = 0;
  let basePay = 0;
  let finalPay = 0;

  if (role === "recruiter") {
    basePay = salaryConfig.mode === "annum" ? salaryConfig.base / 12 : salaryConfig.base;
    hourlyRate = basePay / expectedHours;

    const unpaidLeaves = await calculateUnpaidLeaves(
      user._id,
      monthStr,
      salaryConfig.ptoType,
      salaryConfig.ptoDaysAllocated || 0
    );

    const ptoDeduction = unpaidLeaves * 8 * hourlyRate;
    const bonus = (salaryConfig.bonusType === "recurring" || new Date(salaryConfig.bonusStartDate).getMonth() + 1 === mon)
      ? salaryConfig.bonusAmount || 0
      : 0;

    finalPay = (workedHours * hourlyRate) - ptoDeduction + bonus;
  } else {
  const payCycleMonth = user.payCycleChangeMonth ?? 0;
  const joined = new Date(user.joiningDate);
  const joinedMonth = joined.getMonth() + 1;
  const joinedYear = joined.getFullYear();

  const hasTransitioned = mon >= payCycleMonth || (year > joinedYear);

  if (!hasTransitioned) {
    const annual = user.annualSalary || 0;
    basePay = annual / 12;
    hourlyRate = expectedHours > 0 ? basePay / expectedHours : 0;
    finalPay = workedHours * hourlyRate;
  } else {
    const rate = user.vendorBillRate || 0;
    const share = user.candidateShare || 0;
    hourlyRate = expectedHours > 0 ? (rate * share / 100) / expectedHours : 0;
    finalPay = workedHours * hourlyRate;
    basePay = finalPay;
  }
}
if (role === "candidate") {
  console.log("User fields:", {
    annual: user.annualSalary,
    joiningDate: user.joiningDate,
    payCycleChangeMonth: user.payCycleChangeMonth,
    vendorBillRate: user.vendorBillRate,
    candidateShare: user.candidateShare
  });
}


  return {
    userId: user._id,
    month: monthStr,
    role,
    workedHours,
    hourlyRate,
    basePay,
    finalPay
  };
};


module.exports = {
  calculateSalary
};
