const Timesheet = require("../models/Timesheet");

const getTimesheets = async (req, res) => {
  try {
    const timesheets = await Timesheet.find({ user: req.user._id }).sort({ from: -1 });
    res.status(200).json(timesheets);
  } catch (error) {
    console.error("Error fetching timesheets:", error);
    res.status(500).json({ message: "Failed to load timesheets" });
  }
};

const uploadTimesheet = async (req, res) => {
  const { from, to } = req.body;
  const filename = req.file?.filename;

  if (!from || !to || !filename) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const month = new Date(from).toISOString().slice(0, 7); // Format: "YYYY-MM"

  const timesheet = new Timesheet({
    user: req.user._id,
    submittedByRole: "candidate",
    from,
    to,
    filename,
    month, 
  });

  await timesheet.save();
  res.status(201).json({ message: "Candidate timesheet submitted", timesheet });
};




module.exports = { getTimesheets, uploadTimesheet };
