const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../models/User");
const Settings = require("../models/Settings");
const { testTelegramConnection } = require("../utils/telegramNotifications");
const { auth } = require("../middleware/auth");

const router = express.Router();

const createPasswordResetTransporter = () => {
  const { EMAIL_USER, EMAIL_PASS } = process.env;
  const missingVars = ["EMAIL_USER", "EMAIL_PASS"].filter((key) => !process.env[key]);

  if (missingVars.length > 0) {
    return {
      ok: false,
      message: `Email service is not configured. Missing: ${missingVars.join(", ")}`
    };
  }

  return {
    ok: true,
    transporter: nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
      }
    })
  };
};

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Login failed" });
  }
});

// Current user
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.json({ user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load user" });
  }
});

// Forgot Password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({ message: "If an account with that email exists, a password reset OTP has been sent." });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save OTP to user
    await User.findByIdAndUpdate(user._id, {
      resetOtp: otp,
      resetOtpExpire: otpExpire
    });

    const transportResult = createPasswordResetTransporter();
    if (!transportResult.ok) {
      return res.status(500).json({ message: transportResult.message });
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset OTP - Inventory Management System",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">Password Reset Request</h2>
          <p>Hello ${user.name},</p>
          <p>You requested to reset your password. Use the following OTP to proceed:</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 24px; font-weight: bold; letter-spacing: 3px; color: #10b981;">${otp}</span>
          </div>
          <p><strong>Important:</strong></p>
          <ul>
            <li>This OTP will expire in 10 minutes</li>
            <li>Do not share this OTP with anyone</li>
            <li>If you didn't request this, please ignore this email</li>
          </ul>
          <p>Thank you,<br>Inventory Management System</p>
        </div>
      `
    };

    await transportResult.transporter.sendMail(mailOptions);

    return res.json({ message: "If an account with that email exists, a password reset OTP has been sent." });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ message: "Failed to process request" });
  }
});

// Reset Password
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, OTP, and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or OTP" });
    }

    // Check OTP
    if (user.resetOtp !== otp || !user.resetOtpExpire || user.resetOtpExpire < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password and clear OTP
    await User.findByIdAndUpdate(user._id, {
      passwordHash,
      resetOtp: null,
      resetOtpExpire: null
    });

    // Log activity (you might want to create an Activity model for this)
    console.log(`Password reset completed for user: ${user.email} at ${new Date()}`);

    return res.json({ message: "Password reset successful. You can now login with your new password." });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ message: "Failed to reset password" });
  }
});

// Test Telegram notification (Super Admin only)
router.post("/test-telegram", auth, async (req, res) => {
  try {
    // Check if user is super admin
    const user = await User.findById(req.user.id);
    if (!user || user.role !== "super_admin") {
      return res.status(403).json({ message: "Access denied. Super Admin only." });
    }

    const { botToken, chatId } = req.body;
    
    // If bot token and chat ID are provided in request, use them
    // Otherwise, use the settings from database
    let testBotToken, testChatId;
    
    if (botToken && chatId) {
      testBotToken = botToken;
      testChatId = chatId;
    } else {
      // Get from settings
      const settings = await Settings.findOne();
      if (!settings || !settings.telegramBotToken || !settings.telegramChatId) {
        return res.status(400).json({ 
          success: false, 
          message: "Telegram bot token and chat ID are required" 
        });
      }
      testBotToken = settings.telegramBotToken;
      testChatId = settings.telegramChatId;
    }

    const result = await testTelegramConnection(testBotToken, testChatId);
    return res.json(result);
  } catch (err) {
    console.error("Test Telegram error:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to test Telegram connection" 
    });
  }
});

module.exports = router;

