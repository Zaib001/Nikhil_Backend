const User = require("../models/User");
const Submission = require("../models/Submissions");
const XLSX = require("xlsx");
const nodemailer = require("nodemailer");
const { createCanvas } = require("canvas");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");

// Export candidate list to Excel
const exportCandidatesExcel = async (req, res) => {
  const candidates = await User.find({ role: "candidate" });
  const data = candidates.map(c => ({
    Name: c.name,
    Email: c.email,
    Created: c.createdAt
  }));
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Candidates");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.set("Content-Disposition", "attachment; filename=candidates.xlsx");
  res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
};

// Submission analytics (grouped bar chart + pie data)
const getSubmissionAnalytics = async (req, res) => {
  const submissions = await Submission.find().populate("recruiter", "name");

  const recruiterMap = {};
  const clientMap = {};
  const vendorMap = {};

  submissions.forEach(s => {
    const recruiterName = s.recruiter?.name || "Unknown";
    recruiterMap[recruiterName] = recruiterMap[recruiterName] || { submissions: 0, interviews: 0 };
    recruiterMap[recruiterName].submissions++;
    if (s.interviews) recruiterMap[recruiterName].interviews++;

    clientMap[s.client] = (clientMap[s.client] || 0) + 1;
    vendorMap[s.vendor] = (vendorMap[s.vendor] || 0) + 1;
  });

  const recruiterAnalytics = Object.entries(recruiterMap).map(([name, stats]) => ({
    name,
    submissions: stats.submissions,
    interviews: stats.interviews,
    conversion: Math.round((stats.interviews / stats.submissions) * 100)
  }));

  const clientPie = Object.entries(clientMap).map(([name, value]) => ({ name, value }));
  const vendorPie = Object.entries(vendorMap).map(([name, value]) => ({ name, value }));

  res.json({ recruiterAnalytics, clientPie, vendorPie });
};


// Conversion % only
const getConversionReport = async (req, res) => {
  const submissions = await Submission.find();
  const recruiterStats = {};

  submissions.forEach(s => {
    const r = s.recruiter;
    if (!recruiterStats[r]) recruiterStats[r] = { subs: 0, interviews: 0 };
    recruiterStats[r].subs++;
    if (s.interviews) recruiterStats[r].interviews++;
  });

  const data = Object.entries(recruiterStats).map(([name, val]) => ({
    recruiter: name,
    submissions: val.subs,
    interviews: val.interviews,
    conversionRate: Math.round((val.interviews / val.subs) * 100)
  }));

  res.json(data);
};

// Email report as attachment (Excel or summary text)
const sendReportByEmail = async (req, res) => {
  const { to, subject, message } = req.body;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    }
  });

  const info = await transporter.sendMail({
    from: `"Logicnosh Reports" <${process.env.MAIL_USER}>`,
    to,
    subject: subject || "Performance Report",
    text: message || "Attached is the requested report from Logicnosh admin panel.",
  });

  res.json({ success: true, info });
};

// Chart image export (bar chart)
const generateChartImage = async (req, res) => {
  const submissions = await Submission.find();
  const recruiterMap = {};

  submissions.forEach(s => {
    recruiterMap[s.recruiter] = recruiterMap[s.recruiter] || { submissions: 0, interviews: 0 };
    recruiterMap[s.recruiter].submissions++;
    if (s.interviews) recruiterMap[s.recruiter].interviews++;
  });

  const labels = Object.keys(recruiterMap);
  const submissionsData = labels.map(r => recruiterMap[r].submissions);
  const interviewData = labels.map(r => recruiterMap[r].interviews);

  const canvasRender = new ChartJSNodeCanvas({ width: 800, height: 400 });
  const config = {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Submissions", backgroundColor: "#6366f1", data: submissionsData },
        { label: "Interviews", backgroundColor: "#10b981", data: interviewData }
      ]
    },
    options: { responsive: false, scales: { y: { beginAtZero: true } } }
  };

  const image = await canvasRender.renderToBuffer(config);
  res.set("Content-Type", "image/png");
  res.send(image);
};

module.exports = {
  exportCandidatesExcel,
  getSubmissionAnalytics,
  getConversionReport,
  sendReportByEmail,
  generateChartImage
};
