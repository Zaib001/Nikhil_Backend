const Submission = require("../models/Submissions");
const User = require("../models/User");

const getSubmissions = async (req, res) => {
  const submissions = await Submission.find({ candidate: req.user._id }).sort({ date: -1 });
  res.status(200).json(submissions);
};


const createSubmission = async (req, res) => {
  const { recruiter, client, vendor, date, status, customFields } = req.body;
  if (!recruiter || !client || !date)
    return res.status(400).json({ message: "Missing required fields" });

  // Ensure recruiter exists
  const recruiterUser = await User.findById(recruiter);
  if (!recruiterUser || recruiterUser.role !== "recruiter") {
    return res.status(400).json({ message: "Invalid recruiter" });
  }

  const newSubmission = new Submission({
    candidate: req.user._id,
    recruiter,
    client,
    vendor,
    date,
    status: status || "pending",
    customFields,
  });

  await newSubmission.save();
  res.status(201).json(newSubmission);
};

const updateSubmission = async (req, res) => {
  const submission = await Submission.findOne({ _id: req.params.id, candidate: req.user._id });
  if (!submission) return res.status(404).json({ message: "Submission not found" });

  const { recruiter, client, vendor, date, status, customFields } = req.body;
  Object.assign(submission, { recruiter, client, vendor, date, status, customFields });

  await submission.save();
  res.status(200).json(submission);
};

const deleteSubmission = async (req, res) => {
  const submission = await Submission.findOneAndDelete({ _id: req.params.id, candidate: req.user._id });
  if (!submission) return res.status(404).json({ message: "Submission not found" });

  res.status(200).json({ message: "Submission deleted" });
};

module.exports = {
  getSubmissions,
  createSubmission,
  updateSubmission,
  deleteSubmission,
};
