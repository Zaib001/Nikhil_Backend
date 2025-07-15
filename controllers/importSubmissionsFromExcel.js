
const importSubmissionsFromExcel = async (req, res) => {
  try {
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    let successCount = 0;
    let errorCount = 0;
    const errorLogs = [];

    for (const row of rows) {
      try {
        const name = (row.name || "").trim().toLowerCase();
        const email = (row.email || "").trim().toLowerCase();
        const phone = (row.phone || "").toString().replace(/\D/g, "");
        const client = row.client?.trim() || "";
        const submissionDate = new Date(row.submissionDate || row.date);

        if (!name && !email && !phone) {
          errorLogs.push({ row, error: "Missing identifier (name/email/phone)" });
          errorCount++;
          continue;
        }

        if (!client || !submissionDate || isNaN(submissionDate.getTime())) {
          errorLogs.push({ row, error: "Missing client or invalid date" });
          errorCount++;
          continue;
        }

        // Candidate lookup
        let candidate = null;
        if (email) candidate = await User.findOne({ email });
        if (!candidate && phone) candidate = await User.findOne({ phone });
        if (!candidate && name) candidate = await User.findOne({ name });

        if (!candidate) {
          candidate = await User.create({
            name,
            email,
            phone,
            role: "candidate",
          });
        }

        await Submission.create({
          candidate: candidate._id,
          client,
          date: submissionDate,
        });

        successCount++;

      } catch (err) {
        errorLogs.push({ row, error: err.message });
        errorCount++;
      }
    }

    res.json({
      success: true,
      imported: successCount,
      failed: errorCount,
      errors: errorLogs,
    });
  } catch (err) {
    console.error("Excel import error:", err);
    res.status(500).json({ success: false, message: "Failed to import submissions" });
  }
};
