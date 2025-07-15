
const Timesheet = require("../models/Timesheet");
const User = require("../models/User");
const PTORequest = require("../models/PTORequest");
const US_HOLIDAYS = require("../data/holidays.json");

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

const getTotalWorkedHoursByWeek = async (userId, monthStr) => {
  const [year, mon] = monthStr.split("-").map(Number);
  const start = new Date(year, mon - 1, 1);
  const end = new Date(year, mon, 0);

  const timesheets = await Timesheet.find({
    user: userId,
    from: { $lte: end },
    to: { $gte: start },
    status: "approved"
  });

  const weekly = {};
  for (const ts of timesheets) {
    const date = new Date(ts.from);
    const weekKey = `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}`;
    if (!weekly[weekKey]) weekly[weekKey] = 0;
    weekly[weekKey] += ts.hours || 0;
  }

  return weekly;
};

const getUnpaidLeaveDays = async (userId, monthStr, allowedPTO = 1) => {
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

  return Math.max(0, leaveDays - allowedPTO);
};

const calculateSalary = async (user, monthStr) => {
  const [year, mon] = monthStr.split("-").map(Number);
  const expectedHours = getWorkingDays(year, mon, Object.keys(US_HOLIDAYS).map(d => new Date(d))) * 8;
  const role = user.role;
  const weekHours = await getTotalWorkedHoursByWeek(user._id, monthStr);
  const workedHours = Object.values(weekHours).reduce((a, b) => a + b, 0);

  let hourlyRate = 0;
  let basePay = 0;
  let finalPay = 0;
  let unpaidLeaveDays = 0;
  let ptoDeduction = 0;
  let bonus = 0;

  const allowedPTO = user.ptoDaysAllocated || 1;

  if (role === "recruiter") {
    basePay = user.annualSalary ? user.annualSalary / 12 : 0;
    hourlyRate = expectedHours > 0 ? basePay / expectedHours : 0;
    unpaidLeaveDays = await getUnpaidLeaveDays(user._id, monthStr, allowedPTO);
    ptoDeduction = unpaidLeaveDays * 8 * hourlyRate;
    finalPay = (workedHours * hourlyRate) - ptoDeduction;

    if (user.bonusAmount && (!user.bonusStartDate || new Date(user.bonusStartDate).getMonth() + 1 === mon)) {
      bonus = user.bonusAmount;
      finalPay += bonus;
    }

  } else {
    const joined = new Date(user.joiningDate);
    const payCycleMonth = user.payCycleChangeMonth ?? 0;
    const hasTransitioned = mon >= payCycleMonth || year > joined.getFullYear();

    if (!hasTransitioned) {
      basePay = user.annualSalary / 12;
      hourlyRate = expectedHours > 0 ? basePay / expectedHours : 0;
      finalPay = workedHours * hourlyRate;
    } else {
      const rate = user.vendorBillRate || 0;
      const share = user.candidateShare || 0;
      hourlyRate = rate * (share / 100);
      finalPay = workedHours * hourlyRate;
      basePay = finalPay;
    }
  }

  const weeklyBreakdown = Object.entries(weekHours).map(([week, hrs]) => ({
    week,
    hours: hrs,
    amount: +(hrs * hourlyRate).toFixed(2)
  }));

  return {
    userId: user._id,
    role,
    month: monthStr,
    workedHours,
    expectedHours,
    hourlyRate: +hourlyRate.toFixed(2),
    unpaidLeaveDays,
    ptoDeduction: +ptoDeduction.toFixed(2),
    bonus: +bonus.toFixed(2),
    finalPay: +finalPay.toFixed(2),
    weeklyBreakdown
  };
};

module.exports = { calculateSalary };
