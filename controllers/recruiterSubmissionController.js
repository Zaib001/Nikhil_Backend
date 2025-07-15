const Submission = require("../models/Submissions");
const User = require("../models/User");
const XLSX = require("xlsx");

// GET: All recruiter submissions with search, sort, and populated candidate name
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
      ],
    })
      .populate("candidate", "name")
      .sort({ [sort]: order === "asc" ? 1 : -1 });

    res.status(200).json(submissions);
  } catch (err) {
    console.error("Error in getRecruiterSubmissions:", err);
    res.status(500).json({ message: "Failed to fetch submissions" });
  }
};

// POST: Create a single submission
const createRecruiterSubmission = async (req, res) => {
  try {
    const { candidateId, client, vendor, date, notes, customFields } = req.body;
    const candidate = await User.findById(candidateId);

    if (!candidate || candidate.role !== "candidate") {
      return res.status(400).json({ message: "Invalid candidate" });
    }

    const submission = await Submission.create({
      recruiter: req.user._id,
      candidate: candidate._id,
      client,
      vendor,
      date,
      notes,
      customFields: customFields || {},
    });

    res.status(201).json(submission);
  } catch (err) {
    console.error("Error in createRecruiterSubmission:", err);
    res.status(500).json({ message: "Failed to add submission" });
  }
};

const bulkImportSubmissions = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const recruiterId = req.user._id;
    let successCount = 0;
    let errorCount = 0;
    const errorLogs = [];
    const inserted = [];

    for (const [index, row] of rows.entries()) {
      try {
        const candidateName = (row["Consultant Name"] || row["Candidate Name"] || "").trim();
        const candidateEmail = (row["Vendor Email"] || row["Candidate Email"] || "").trim().toLowerCase();
        const candidatePhone = (row["Vendor Contact"] || row["Candidate Phone"] || "").toString().replace(/\D/g, "");
        const client = (row["Client"] || "").trim();
        const vendor = (row["Vendor Name"] || row["Vendor"] || "").trim();
        const notes = row["Unnamed: 11"] || row["Notes"] || "";
        const date = row["Date"] ? new Date(row["Date"]) : new Date();

        const customFields = {
          Technology: row["Technology"] || "",
          Location: row["Location"] || "",
          Rate: row["Rate"] || "",
          Recruiter: row["Recruiter"] || "",
          Implementation: row["Implementation"] || "",
        };

        if (!candidateName && !candidateEmail && !candidatePhone) {
          errorLogs.push({ index: index + 1, error: "Missing name, email, and phone" });
          errorCount++;
          continue;
        }

        let candidate = null;
        if (candidateEmail) candidate = await User.findOne({ email: candidateEmail });
        if (!candidate && candidatePhone) candidate = await User.findOne({ phone: candidatePhone });
        if (!candidate && candidateName)
          candidate = await User.findOne({ name: new RegExp(`^${candidateName}$`, "i") });

        if (!candidate) {
          candidate = await User.create({
            name: candidateName,
            email: candidateEmail || undefined,
            phone: candidatePhone || undefined,
            role: "candidate",
          });
        }

        const existing = await Submission.findOne({
          recruiter: recruiterId,
          candidate: candidate._id,
          client,
          date: {
            $gte: new Date(date.setHours(0, 0, 0, 0)),
            $lte: new Date(date.setHours(23, 59, 59, 999)),
          },
        });

        if (existing) {
          errorLogs.push({ index: index + 1, error: "Duplicate submission skipped" });
          errorCount++;
          continue;
        }

        const submission = await Submission.create({
          recruiter: recruiterId,
          candidate: candidate._id,
          client,
          vendor,
          date,
          notes,
          customFields,
        });

        inserted.push(submission);
        successCount++;
      } catch (err) {
        errorLogs.push({ index: index + 1, error: err.message });
        errorCount++;
      }
    }

    return res.json({
      success: true,
      imported: successCount,
      failed: errorCount,
      inserted,
      errors: errorLogs,
    });
  } catch (err) {
    console.error("Recruiter Excel import error:", err);
    res.status(500).json({ success: false, message: "Failed to import submissions" });
  }
};


module.exports = {
  getRecruiterSubmissions,
  createRecruiterSubmission,
  bulkImportSubmissions,
};
