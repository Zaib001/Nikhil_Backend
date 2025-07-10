const User = require("../models/User");
const Submission = require("../models/Submissions");
const PTORequest = require("../models/PTORequest");

const getAdminDashboardStats = async (req, res) => {
  try {
    const recruiters = await User.countDocuments({ role: "recruiter" });
    const candidates = await User.countDocuments({ role: "candidate" });
    const pendingPTO = await PTORequest.countDocuments({ status: "pending" });
    const totalSubmissions = await Submission.countDocuments();

    res.json({
      success: true,
      stats: { recruiters, candidates, pendingPTO, totalSubmissions },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch stats" });
  }
};

module.exports = { getAdminDashboardStats };
