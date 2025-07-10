const Timesheet = require("../models/Timesheet");
const User = require("../models/User");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const path = require('path');

const uploadPath = path.join(__dirname, '..', 'uploads'); 

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const getAllTimesheets = async (req, res) => {
  try {
    const timesheets = await Timesheet.aggregate([
      {
        $sort: { updatedAt: -1 } 
      },
      {
        $group: {
          _id: "$user",          
          doc: { $first: "$$ROOT" } 
        }
      },
      {
        $replaceRoot: { newRoot: "$doc" }
      },
      {
        $lookup: {
          from: "users",           
          localField: "user",
          foreignField: "_id",
          as: "user"
        }
      },
      {
        $unwind: "$user"
      }
    ]);

    res.json(timesheets);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch unique user timesheets", error: err });
  }
};


const getTimesheetById = async (req, res) => {
  try {
    const timesheet = await Timesheet.findById(req.params.id).populate("user");
    if (!timesheet) return res.status(404).json({ message: "Timesheet not found" });
    res.json(timesheet);
  } catch (err) {
    res.status(500).json({ message: "Error fetching timesheet", error: err });
  }
};

const createTimesheet = async (req, res) => {
  try {
    const {
      user,
      submittedByRole,
      from,
      to,
      filename,
      hours,
      totalPay,
      status,
    } = req.body;

    const userExists = await User.findById(user);
    if (!userExists) return res.status(404).json({ message: "User not found" });

    const newTimesheet = await Timesheet.create({
      user,
      submittedByRole,
      from,
      to,
      filename,
      hours,
      totalPay,
      status,
    });

    res.status(201).json({ message: "Timesheet created", timesheet: newTimesheet });
  } catch (err) {
    res.status(500).json({ message: "Failed to create timesheet", error: err });
  }
};

const updateTimesheet = async (req, res) => {
  try {
    const updated = await Timesheet.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    }).populate("user");

    if (!updated) return res.status(404).json({ message: "Timesheet not found" });

    res.json({ message: "Timesheet updated", timesheet: updated });
  } catch (err) {
    res.status(500).json({ message: "Failed to update timesheet", error: err });
  }
};

const deleteTimesheet = async (req, res) => {
  try {
    const deleted = await Timesheet.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Timesheet not found" });
    res.json({ message: "Timesheet deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete timesheet", error: err });
  }
};

const generateTimesheetPDF = async (req, res) => {
  const { userId, month } = req.params;

  try {
    const timesheets = await Timesheet.find({ user: userId, month });

    if (!timesheets || timesheets.length === 0) {
      return res.status(404).json({ message: "No timesheets found for this month" });
    }

    const doc = new PDFDocument();
    const filePath = path.join(uploadPath, `timesheet-${userId}-${month}.pdf`);
    
    console.log("Saving PDF to: ", filePath);

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=timesheet-${userId}-${month}.pdf`);

    doc.pipe(res);

    doc.fontSize(16).text(`Timesheet for ${userId} - ${month}`, { align: "center" });
    doc.moveDown(1);

    timesheets.forEach((timesheet, index) => {
      if (index > 0) doc.addPage();

      doc.fontSize(14).text(`Timesheet for Week ${index + 1}`, { underline: true, align: "left" });
      doc.moveDown(0.5);

      doc.fontSize(12).text(`From: ${new Date(timesheet.from).toLocaleDateString()}`);
      doc.text(`To: ${new Date(timesheet.to).toLocaleDateString()}`);
      doc.text(`Status: ${timesheet.status}`);
      doc.text(`Remarks: ${timesheet.remarks || "No remarks"}`);
      doc.text(`Filename: ${timesheet.filename}`);
      doc.moveDown(0.5);

      const imagePath = path.join(uploadPath, 'timesheets', timesheet.filename);
      console.log("Image path: ", imagePath);

      if (fs.existsSync(imagePath)) {
        doc.image(imagePath, { width: 500, align: 'center' });
      } else {
        doc.fontSize(10).fillColor("red").text("Image not found", { align: "center" });
      }

      doc.moveDown(1).strokeColor("#cccccc").lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);
    });

    doc.end();

  } catch (error) {
    console.error("Error generating timesheet PDF:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Error generating the timesheet PDF" });
    }
  }
};




module.exports = {
  getAllTimesheets,
  getTimesheetById,
  createTimesheet,
  updateTimesheet,
  deleteTimesheet,
  generateTimesheetPDF
};
