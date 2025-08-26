const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const { errorHandler } = require('./middleware/error.middleware');
const cors = require('cors');
const morgan = require('morgan');
const adminRoutes = require("./routes/adminRoutes");


dotenv.config();
connectDB();

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://jobportal-mo58.onrender.com",
  "https://job-portal-frontend-e3n4.onrender.com"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan('dev'));


app.use('/api/auth', authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin", require("./routes/admin.routes"));
app.use("/api/admin/submissions", require("./routes/adminSubmissions.routes"));
app.use("/api/admin/report", require("./routes/admin.report.routes"));
app.use("/api/admin/pto", require("./routes/adminPto.routes"));
app.use("/api/admin/salary", require("./routes/adminSalary.routes"));
app.use("/api/admin/timesheets", require("./routes/adminTimesheet.js"));



// candidate
app.use("/api/candidate", require("./routes/candidate.routes"));
app.use("/api/candidate/submissions", require("./routes/candidate.submission.routes"));
app.use("/api/candidate/timesheet", require("./routes/candidate.timesheet.routes"));

// recruiter
app.use("/api/recruiter/submissions", require("./routes/recruiterSubmission.routes"));
app.use("/api/recruiter", require("./routes/recruiter.routes"));
app.use("/api/recruiter/candidates", require("./routes/recruiterCandidates.routes"));
app.use("/api/recruiter/timesheets", require("./routes/recruiterTimesheet.routes"));
app.use("/api/recruiter/pto", require("./routes/recruiterPto.routes"));
app.use("/api/documents", require("./routes/documents"));
app.use("/api/custom", require("./routes/customSections.js"));

require("./cron/slipJob");

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
