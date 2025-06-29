const PTORequest = require("../models/PTORequest");


const getAllPtoRequests = async (req, res) => {
  try {
    const requests = await PTORequest.find()
      .populate("requestedBy", "name email") // ✅ corrected field
      .sort({ createdAt: -1 });

    res.status(200).json(requests);
  } catch (error) {
    console.error("Error fetching PTO requests:", error.message);
    res.status(500).json({ message: "Failed to fetch PTO requests" });
  }
};

const updatePtoStatus = async (req, res) => {
  const { status } = req.body;
  const pto = await PTORequest.findById(req.params.id);
  if (!pto) return res.status(404).json({ message: "PTO request not found" });

  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  pto.status = status;
  await pto.save();

  res.json({ message: `PTO ${status}`, pto });
};

module.exports = { getAllPtoRequests, updatePtoStatus };
