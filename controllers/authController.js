const User = require("../models/User");
const bcrypt = require("bcryptjs");
const generateToken = require("../utils/generateToken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const PasswordReset = require("../models/passwordReset.model");
const sendEmail = require("../utils/sendEmail");
const Otp = require("../models/otp.model");

const registerUser = async (req, res, next) => {
  try {
    let { name, email, password, role } = req.body;
    email = email?.trim().toLowerCase();
    name = name?.trim();
    role = role?.toLowerCase();

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!["company", "recruiter", "internal"].includes(role)) {
      return res.status(400).json({ message: "Invalid user role" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      isVerified: false,
    });

    await Otp.create({
      userId: user._id,
      otp: otpCode,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 mins
    });

    await sendEmail(
      email,
      "Verify Your Email",
      `<h3>Hello, ${name}!</h3><p>Your verification OTP is: <strong>${otpCode}</strong>. It will expire in 10 minutes.</p>`
    );

    res.status(201).json({ message: "Registered successfully. Please verify using the OTP sent to your email." });
  } catch (error) {
    console.error("Registration error:", error);
    next(error);
  }
};



const verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const otpRecord = await Otp.findOne({
      userId: user._id,
      otp,
      expiresAt: { $gt: new Date() }, 
    });

    console.log("OTP Record:", otpRecord);

    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    user.isVerified = true;
    await user.save();

    await Otp.deleteMany({ userId: user._id }); 

    return res.status(200).json({ message: "OTP verified successfully!" });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    next(error);
  }
};


const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: "Please verify your email first." });
    }

    if (user.status === "inactive") {
      return res.status(403).json({ message: "Your account is currently inactive. Please contact admin." });
    }

    res.json({
      success: true,
      token: generateToken(user),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const token = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    await PasswordReset.create({
      userId: user._id,
      token: hashedToken,
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    const resetLink = `${process.env.CLIENT_URL}/reset-password/${token}`;
    await sendEmail(
      user.email,
      "Reset Your Password",
      `<p>Click the link below to reset your password:</p>
       <a href="${resetLink}">Reset Password</a>
       <p>This link will expire in 1 hour.</p>`
    );

    res.json({ message: "Password reset link sent" });
  } catch (err) {
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const resetRecord = await PasswordReset.findOne({
      token: hashedToken,
      expiresAt: { $gt: Date.now() },
    });

    if (!resetRecord) return res.status(400).json({ message: "Invalid or expired token" });

    const user = await User.findById(resetRecord.userId);
    user.password = await bcrypt.hash(password, 12);
    await user.save();
    await PasswordReset.deleteMany({ userId: user._id });

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  registerUser,
  verifyOTP,
  loginUser,
  getUserProfile,
  forgotPassword,
  resetPassword,
};
