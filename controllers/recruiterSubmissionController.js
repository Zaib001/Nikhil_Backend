const Submission = require("../models/Submissions");
const User = require("../models/User");

const getRecruiterSubmissions = async (req, res) => {
  try {
    const { search = "", sort = "date", order = "desc" } = req.query;
    const regex = new RegExp(search, "i");

    const submissions = await Submission.find({
      recruiter: req.user._id,
      $or: [
        { client: regex },
        { vendor: regex },
        { notes: regex },
      ]
    })
      .populate('candidate', 'name')
      .sort({ [sort]: order === "asc" ? 1 : -1 });


    res.status(200).json(submissions);
  } catch (err) {
    console.error("❌ Error in getRecruiterSubmissions:", err.message, err.stack);
    res.status(500).json({ message: "Failed to fetch submissions" });
  }
};

const createRecruiterSubmission = async (req, res) => {
  try {
const { candidateId, client, vendor, date, notes, customFields } = req.body;
    const candidate = await User.findById(candidateId);

    if (!candidate || candidate.role !== "candidate") {
      return res.status(400).json({ message: "Invalid candidate" });
    }

    const submission = new Submission({
  recruiter: req.user._id,
  candidate: candidate._id,
  client,
  vendor,
  date,
  notes,
  customFields: customFields || {}, 
});


    await submission.save();
    res.status(201).json(submission);
  } catch (err) {
    console.error("❌ Error in createRecruiterSubmission:", err.message, err.stack);
    res.status(500).json({ message: "Failed to add submission" });
  }
};

const bulkImportSubmissions = async (req, res) => {
  try {
    const { submissions = [] } = req.body;

    const formatted = submissions.map(s => ({
      recruiterId: req.user._id,
      candidate: s.candidate,
      client: s.client,
      vendor: s.vendor,
      date: s.date || new Date(),
      notes: s.notes || "",
    }));

    await Submission.insertMany(formatted);
    res.status(201).json({ message: "Bulk submissions added" });
  } catch (err) {
    console.error("❌ Error in bulkImportSubmissions:", err.message, err.stack);
    res.status(500).json({ message: "Failed to import submissions" });
  }
};

module.exports = {
  getRecruiterSubmissions,
  createRecruiterSubmission,
  bulkImportSubmissions,
};
