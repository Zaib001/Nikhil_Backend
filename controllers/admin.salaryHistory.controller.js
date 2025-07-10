const SalaryHistory = require("../models/SalaryHistory");

const getSalaryHistory = async (req, res) => {
  const { userId } = req.query;
  const filter = userId ? { userId } : {};
  const history = await SalaryHistory.find(filter).sort({ updatedAt: -1 }).populate("userId", "name email role");
  res.json(history);
};

const addSalaryHistoryEntry = async (req, res) => {
  const { userId, month, base, bonus } = req.body;
  const entry = await SalaryHistory.create({ userId, month, base, bonus });
  res.status(201).json({ message: "Salary history added", entry });
};

module.exports = {
  getSalaryHistory,
  addSalaryHistoryEntry,
};
