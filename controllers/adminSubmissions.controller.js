const Submission = require("../models/Submissions");
const { Parser } = require("json2csv");
const stream = require("stream");
const Submissions = require("../models/Submissions");
const PDFDocument = require("pdfkit");
const { Table } = require("pdfkit-table"); 
const multer = require("multer");
const XLSX = require("xlsx");
const User = require("../models/User"); 

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "application/vnd.ms-excel" ||
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "text/csv"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel or CSV files are allowed"), false);
    }
  },
});

// Utility to format dates
const formatDate = (date) => new Date(date).toLocaleDateString("en-GB");

// GET all submissions with optional filters
const getAllSubmissions = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const query = {};
    if (startDate) query.date = { ...query.date, $gte: new Date(startDate) };
    if (endDate) query.date = { ...query.date, $lte: new Date(endDate) };

    const submissions = await Submissions.find(query)
      .populate("candidate", "name email") 
      .populate("recruiter", "name email")  
      .sort({ date: -1 });

    res.json({ submissions });
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ message: "Failed to fetch submissions" });
  }
};

// UPDATE submission
const updateSubmission = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await Submission.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Submission not found" });

    res.json({ success: true, message: "Submission updated", updated });
  } catch (err) {
    next(err);
  }
};

// DELETE submission
const deleteSubmission = async (req, res, next) => {
  try {
    const deleted = await Submission.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Submission not found" });

    res.json({ success: true, message: "Submission deleted" });
  } catch (err) {
    next(err);
  }
};

// ASSIGN reviewer
const assignReviewer = async (req, res, next) => {
  try {
    const { reviewer } = req.body;
    const updated = await Submission.findByIdAndUpdate(req.params.id, { reviewer }, { new: true });

    if (!updated) return res.status(404).json({ message: "Submission not found" });

    res.json({ success: true, message: "Reviewer assigned", updated });
  } catch (err) {
    next(err);
  }
};

// EXPORT to CSV
const exportSubmissionsCSV = async (req, res) => {
  try {
    const submissions = await Submission.find()
      .populate("candidate", "name")
      .populate("recruiter", "name")
      .populate("client", "name")
      .populate("vendor", "name");

    const data = submissions.map((s) => ({
      Candidate: s.candidate?.name || "N/A",
      Recruiter: s.recruiter?.name || "N/A",
      Client: s.client?.name || "N/A",
      Vendor: s.vendor?.name || "N/A",
      Date: s.date.toISOString().split("T")[0],
      Notes: s.notes || "",
    }));

    const parser = new Parser();
    const csv = parser.parse(data);

    res.header("Content-Type", "text/csv");
    res.attachment(`submissions_${Date.now()}.csv`);
    res.send(csv);
  } catch (err) {
    console.error("CSV export error:", err);
    res.status(500).json({ message: "Failed to export CSV" });
  }
};

// EXPORT to PDF
const exportSubmissionsPDF = async (req, res) => {
  try {
    const submissions = await Submission.find()
      .populate("candidate", "name")
      .populate("recruiter", "name")
      .populate("client", "name")
      .populate("vendor", "name");

    const doc = new PDFDocument({ margin: 30, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=submissions.pdf");
    doc.pipe(res);

    doc.fontSize(18).text("All Submissions", { align: "center" }).moveDown(1.5);

    const tableData = {
      headers: ["Candidate", "Recruiter", "Client", "Vendor", "Date", "Notes"],
      rows: submissions.map((s) => [
        s.candidate?.name || "N/A",
        s.recruiter?.name || "N/A",
        s.client?.name || "N/A",
        s.vendor?.name || "N/A",
        new Date(s.date).toLocaleDateString(),
        s.notes || "-",
      ]),
    };

    await doc.table(tableData, {
      prepareHeader: () => doc.font("Helvetica-Bold").fontSize(12),
      prepareRow: (row, i) => doc.font("Helvetica").fontSize(10),
      columnSpacing: 10,
      width: 530,
    });

    doc.end();
  } catch (err) {
    console.error("PDF export error:", err);
    res.status(500).json({ message: "Failed to export PDF" });
  }
};

// ANALYTICS
const getSubmissionsAnalytics = async (req, res, next) => {
  try {
    const submissions = await Submission.find();

    const aggregateBy = (key) =>
      submissions.reduce((acc, s) => {
        acc[s[key]] = (acc[s[key]] || 0) + 1;
        return acc;
      }, {});

    const analytics = {
      recruiters: aggregateBy("recruiter"),
      clients: aggregateBy("client"),
      vendors: aggregateBy("vendor"),
    };

    res.json({ success: true, analytics });
  } catch (err) {
    next(err);
  }
};


const importSubmissions = [
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      const finalPayload = [];

      for (const [index, row] of rows.entries()) {
        const {
          Candidate: candidateName,
          CandidateEmail: candidateEmail,
          CandidatePhone: candidatePhone,
          Recruiter: recruiterName,
          Client: client,
          Vendor: vendor,
          Date: date,
          Notes: notes,
          ...meta
        } = row;

        if (!candidateName && !candidateEmail && !candidatePhone) {
          console.log(`Row ${index + 1} skipped: Missing candidate details`);
          continue;
        }

        const normalizedName = candidateName?.toLowerCase().trim();
        const normalizedEmail = candidateEmail?.toLowerCase().trim();
        const normalizedPhone = candidatePhone?.replace(/\D/g, "");

        let candidate = null;

        if (normalizedEmail) {
          candidate = await User.findOne({ email: normalizedEmail });
          if (candidate) console.log(`Matched by email: ${normalizedEmail}`);
        }
        if (!candidate && normalizedPhone) {
          candidate = await User.findOne({ phone: normalizedPhone });
          if (candidate) console.log(`Matched by phone: ${normalizedPhone}`);
        }
        if (!candidate && normalizedName) {
          candidate = await User.findOne({ name: new RegExp(`^${normalizedName}$`, "i") });
          if (candidate) console.log(`Matched by name: ${normalizedName}`);
        }

        if (!candidate) {
          candidate = await User.create({
            name: candidateName,
            email: normalizedEmail || undefined,
            phone: normalizedPhone || undefined,
            role: "candidate",
          });
          console.log(`Created new candidate: ${candidateName}`);
        }

        let recruiter = null;
        if (recruiterName) {
          recruiter = await User.findOne({ name: recruiterName });
          if (!recruiter) {
            recruiter = await User.create({ name: recruiterName, role: "recruiter" });
            console.log(`Created new recruiter: ${recruiterName}`);
          }
        }

        finalPayload.push({
          recruiter: recruiter?._id,
          candidate: candidate._id,
          client,
          vendor,
          date: date ? new Date(date) : new Date(),
          notes: notes || "",
          meta,
        });
      }

      if (!finalPayload.length) {
        return res.status(400).json({ message: "No valid submissions found" });
      }

      await Submission.insertMany(finalPayload);
      res.status(201).json({ message: "Submissions imported", count: finalPayload.length });
    } catch (err) {
      console.error("Admin import error:", err);
      res.status(500).json({ message: "Failed to import submissions" });
    }
  },
];





module.exports = {
  getAllSubmissions,
  updateSubmission,
  deleteSubmission,
  assignReviewer,
  exportSubmissionsCSV,
  exportSubmissionsPDF,
  getSubmissionsAnalytics,
  importSubmissions
};
