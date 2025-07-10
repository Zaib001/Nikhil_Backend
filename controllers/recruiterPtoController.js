const PTORequest = require("../models/PTORequest");

const getRecruiterPTO = async (req, res) => {
  try {
    const ptoRequests = await PTORequest.find({ requestedBy: req.user._id, role: "recruiter" }).sort({ from: -1 });

    const usedDays = ptoRequests
      .filter(p => p.status === "approved")
      .reduce((sum, req) => sum + req.days, 0);

    const ptoBalance = 10 - usedDays;

    res.status(200).json({ ptoBalance, requests: ptoRequests });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch PTO" });
  }
};

const submitRecruiterPTO = async (req, res) => {
  try {
    const { from, to, reason } = req.body;
    if (!from || !to || !reason) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    const days = Math.max(((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1, 0);

    const previous = await PTORequest.find({ requestedBy: req.user._id, role: "recruiter", status: "approved" });
    const usedDays = previous.reduce((sum, p) => sum + p.days, 0);

    const currentBalance = 10 - usedDays;
    if (days > currentBalance) {
      return res.status(400).json({ message: "Not enough PTO balance" });
    }

    const newRequest = new PTORequest({
      requestedBy: req.user._id,
      role: "recruiter",
      from: fromDate,
      to: toDate,
      reason,
      days,
      status: "pending",
    });

    await newRequest.save();
    res.status(201).json({ message: "PTO request submitted", request: newRequest });
  } catch (err) {
    res.status(500).json({ message: "Submission failed" });
  }
};

module.exports = {
  getRecruiterPTO,
  submitRecruiterPTO,
};
