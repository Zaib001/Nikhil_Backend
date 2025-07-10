const User = require("../models/User");
const bcrypt = require("bcryptjs");

const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find()
      .select("-password")
      .populate("assignedBy", "name");
    res.json({ success: true, count: users.length, users });
  } catch (err) {
    next(err);
  }
};

const toggleUserVerification = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.isVerified = !user.isVerified;
    await user.save();

    res.json({
      success: true,
      message: `User verification status updated to ${user.isVerified}`,
      isVerified: user.isVerified,
    });
  } catch (err) {
    next(err);
  }
};

const createUser = async (req, res, next) => {
  try {
    let {
      name,
      email,
      password,
      role,
      permissions = [],
      experience,
      tech,
      dob,
      currency,
      ptoLimit,
      workingDays,
      annualSalary,
      joiningDate,
      payCycleChangeMonth,
      vendorBillRate,
      candidateShare,
    } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    email = email.trim().toLowerCase();
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ success: false, message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email,
      password: hashedPassword,
      role: role.toLowerCase(),
      isVerified: true,
      status: "active",
      assignedBy: req.user?._id || null,
      permissions,
      experience,
      tech,
      dob,
      currency,
      ptoLimit,
      workingDays,
      annualSalary,
      joiningDate,
      payCycleChangeMonth,
      vendorBillRate,
      candidateShare,
    });

    const sanitized = user.toObject();
    delete sanitized.password;

    res.status(201).json({ success: true, message: "User created", user: sanitized });
  } catch (err) {
    next(err);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const {
      name,
      email,
      role,
      experience,
      tech,
      dob,
      currency,
      ptoLimit,
      workingDays,
      permissions,
      status,
      annualSalary,
      joiningDate,
      payCycleChangeMonth,
      vendorBillRate,
      candidateShare,
    } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (name) user.name = name.trim();
    if (email) user.email = email.trim().toLowerCase();
    if (role) user.role = role.toLowerCase();
    if (experience) user.experience = experience;
    if (tech) user.tech = tech;
    if (dob) user.dob = dob;
    if (currency) user.currency = currency;
    if (ptoLimit !== undefined) user.ptoLimit = Number(ptoLimit);
    if (workingDays !== undefined) user.workingDays = Number(workingDays);
    if (permissions) user.permissions = permissions;
    if (status) user.status = status;

    if (annualSalary !== undefined) user.annualSalary = Number(annualSalary);
    if (joiningDate) user.joiningDate = joiningDate;
    if (payCycleChangeMonth !== undefined) user.payCycleChangeMonth = Number(payCycleChangeMonth);
    if (vendorBillRate !== undefined) user.vendorBillRate = Number(vendorBillRate);
    if (candidateShare !== undefined) user.candidateShare = Number(candidateShare);

    await user.save();

    const sanitized = user.toObject();
    delete sanitized.password;

    res.json({ success: true, message: "User updated", user: sanitized });
  } catch (err) {
    next(err);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "User not found" });

    res.json({ success: true, message: "User deleted" });
  } catch (err) {
    next(err);
  }
};

const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.status = user.status === "active" ? "inactive" : "active";
    await user.save();

    res.json({
      success: true,
      message: `User status updated to ${user.status}`,
      status: user.status,
    });
  } catch (err) {
    next(err);
  }
};

const assignPermissions = async (req, res, next) => {
  try {
    const { permissions } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.permissions = Array.isArray(permissions) ? permissions : [];
    await user.save();

    res.json({ success: true, message: "Permissions updated", permissions: user.permissions });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  assignPermissions,
  toggleUserVerification,
};
