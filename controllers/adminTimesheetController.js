const Timesheet = require("../models/Timesheet");
const User = require("../models/User");

// GET /api/admin/timesheets
const getAllTimesheets = async (req, res) => {
  try {
    const timesheets = await Timesheet.find().populate("user");
    res.json(timesheets);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch timesheets", error: err });
  }
};

// GET /api/admin/timesheets/:id
const getTimesheetById = async (req, res) => {
  try {
    const timesheet = await Timesheet.findById(req.params.id).populate("user");
    if (!timesheet) return res.status(404).json({ message: "Timesheet not found" });
    res.json(timesheet);
  } catch (err) {
    res.status(500).json({ message: "Error fetching timesheet", error: err });
  }
};

// POST /api/admin/timesheets
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

// PUT /api/admin/timesheets/:id
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

// DELETE /api/admin/timesheets/:id
const deleteTimesheet = async (req, res) => {
  try {
    const deleted = await Timesheet.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Timesheet not found" });
    res.json({ message: "Timesheet deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete timesheet", error: err });
  }
};

module.exports = {
  getAllTimesheets,
  getTimesheetById,
  createTimesheet,
  updateTimesheet,
  deleteTimesheet,
};
