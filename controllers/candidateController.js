const Submission = require("../models/Submissions");
const Timesheet = require("../models/Timesheet");
const PTO = require("../models/PTORequest");
const User = require("../models/User")
const getCandidateDashboard = async (req, res) => {
  try {
    const candidateId = req.user._id;

    const submissions = await Submission.countDocuments({ candidate: candidateId });
    const approvedTimesheets = await Timesheet.countDocuments({
      candidate: candidateId,
      status: "approved",
    });
    const ptoData = await PTO.findOne({ candidate: candidateId }) || { used: 0, balance: 0 };

    res.status(200).json({
      name: req.user.name,
      email: req.user.email,
      submissions,
      approvedTimesheets,
      ptoUsed: ptoData.used,
      ptoBalance: ptoData.balance,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
const getCandidateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("name email phone address skills");
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};

const updateCandidateProfile = async (req, res) => {
  try {
    const { phone, address, skills } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { phone, address, skills },
      { new: true, runValidators: true }
    ).select("name email phone address skills");

    res.status(200).json({ message: "Profile updated", user });
  } catch (err) {
    res.status(500).json({ message: "Failed to update profile" });
  }
};

module.exports = {
  getCandidateDashboard,
  getCandidateProfile,
  updateCandidateProfile,
};
