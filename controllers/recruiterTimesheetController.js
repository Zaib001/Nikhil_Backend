const RecruiterTimesheet = require("../models/RecruiterTimesheet");
const Timesheet = require("../models/Timesheet");

const getRecruiterTimesheets = async (req, res) => {
  try {
    const timesheets = await RecruiterTimesheet.find({ recruiter: req.user._id }).sort({ from: -1 });
    res.status(200).json(timesheets);
  } catch (err) {
    res.status(500).json({ message: "Error fetching timesheets" });
  }
};

const submitRecruiterTimesheet = async (req, res) => {
  const { from, to, hours } = req.body;

  if (!from || !to || !hours) {
    return res.status(400).json({ message: "All fields required" });
  }

  const hourlyRate = 25;

  const timesheet = new Timesheet({
    user: req.user._id,
    submittedByRole: "recruiter",
    from,
    to,
    hours,
    totalPay: hours * hourlyRate,
  });

  await timesheet.save();
  res.status(201).json({ message: "Recruiter timesheet submitted", timesheet });
};


module.exports = {
  getRecruiterTimesheets,
  submitRecruiterTimesheet
};
