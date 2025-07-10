const User = require("../models/User");
const Submission = require("../models/Submissions");
const Timesheet = require("../models/Timesheet");
const PTORequest = require("../models/PTORequest");

const getRecruiterDashboard = async (req, res) => {
  try {
    const recruiterId = req.user._id;

    const candidateCount = await User.countDocuments({
      role: "candidate",
      assignedBy: recruiterId,
    });

    const ptoRequests = await PTORequest.find({
      requestedBy: recruiterId,
      role: "recruiter",
      status: "approved",
    });

    const usedPtoDays = ptoRequests.reduce((sum, req) => sum + req.days, 0);
    const ptoBalance = 10 - usedPtoDays;

    const submissions = await Submission.find({ recruiterId })
      .sort({ date: -1 })
      .limit(5)
      .lean();

    const timesheet = await Timesheet.findOne({ recruiterId })
      .sort({ updatedAt: -1 })
      .lean();

    res.status(200).json({
      candidates: candidateCount,
      ptoBalance,
      recentSubmissions: submissions.map((s) => ({
        candidate: s.candidate, 
        client: s.client,
        date: s.date,
      })),
      timesheetStatus: timesheet?.status || "N/A",
    });
  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).json({ message: "Failed to load recruiter dashboard" });
  }
};
const importExcelSubmissions = async (req, res) => {
  try {
    const { submissions } = req.body;
    const recruiterId = req.user._id;

    const formatted = [];
    console.log(submissions)
    for (const s of submissions) {
      const candidateUser = await User.findOne({ name: s.candidate, role: "candidate" });
      if (!candidateUser) continue; 

      formatted.push({
        recruiter: recruiterId,
        candidate: candidateUser._id,
        client: s.client,
        vendor: s.vendor || "",
        date: s.date,
        customFields: s.customFields || {},
      });
    }

    const data = await Submission.insertMany(formatted);
    console.log(data)
    res.status(201).json({ message: "Submissions imported successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to import submissions" });
  }
};


module.exports = {
  getRecruiterDashboard,
  importExcelSubmissions
};
