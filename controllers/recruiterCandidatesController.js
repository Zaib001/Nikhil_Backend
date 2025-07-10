const User = require("../models/User");

const getCandidates = async (req, res) => {
  try {
    const candidates = await User.find({
      role: "candidate",
      assignedBy: req.user._id
    }).select("-password");
    res.status(200).json(candidates);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch candidates" });
  }
};

const createCandidate = async (req, res) => {
  try {
    const { name, email, password, dob, experience, tech, customFields = {} } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const newCandidate = new User({
      name,
      email,
      password,
      role: "candidate",
      assignedBy: req.user._id,
      dob,
      experience,
      tech,
      customFields, 
    });

    await newCandidate.save();
    res.status(201).json(newCandidate);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create candidate" });
  }
};

const updateCandidate = async (req, res) => {
  try {
    const { name, dob, experience, tech } = req.body;
    const updated = await User.findOneAndUpdate(
      { _id: req.params.id, role: "candidate", assignedBy: req.user._id },
      { name, dob, experience, tech },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Candidate not found" });
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: "Failed to update candidate" });
  }
};

const deleteCandidate = async (req, res) => {
  try {
    const deleted = await User.findOneAndDelete({
      _id: req.params.id,
      role: "candidate",
      assignedBy: req.user._id
    });
    if (!deleted) return res.status(404).json({ message: "Candidate not found" });
    res.status(200).json({ message: "Candidate deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete candidate" });
  }
};

module.exports = {
  getCandidates,
  createCandidate,
  updateCandidate,
  deleteCandidate
};
