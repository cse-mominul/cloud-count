const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Settings = require("../models/Settings");
const Activity = require("../models/Activity");
const { auth, requireRole } = require("../middleware/auth");

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../uploads/logos");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, "logo-" + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  }
});

// Upload company logo (super_admin only)
router.post("/upload-logo", auth, requireRole("super_admin"), upload.single("logo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Get current settings to delete old logo if exists
    const settings = await Settings.getSettings();
    if (settings.companyLogo) {
      const oldLogoPath = path.join(__dirname, "..", settings.companyLogo);
      if (fs.existsSync(oldLogoPath)) {
        fs.unlinkSync(oldLogoPath);
      }
    }

    // Save new logo path
    const logoPath = `/uploads/logos/${req.file.filename}`;
    await Settings.updateSettings({ companyLogo: logoPath });

    // Log activity for logo upload
    await Activity.logActivity({
      action: 'settings_updated',
      description: `${req.user.role} updated company logo`,
      details: { 
        settingType: 'Company Logo',
        logoPath: logoPath,
        previousLogo: settings.companyLogo || 'None'
      },
      user: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      targetType: 'Settings',
      severity: 'low'
    });

    console.log('Activity logged for logo upload:', { logoPath });
    
    return res.json({
      message: "Logo uploaded successfully",
      logoPath: logoPath
    });
  } catch (err) {
    console.error("Failed to upload logo:", err);
    return res.status(500).json({ message: "Failed to upload logo" });
  }
});

// Delete company logo (super_admin only)
router.delete("/logo", auth, requireRole("super_admin"), async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    
    if (settings.companyLogo) {
      const logoPath = path.join(__dirname, "..", settings.companyLogo);
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
      }
      
      await Settings.updateSettings({ companyLogo: "" });

      // Log activity for logo deletion
      await Activity.logActivity({
        action: 'settings_updated',
        description: `${req.user.role} deleted company logo`,
        details: { 
          settingType: 'Company Logo',
          deletedLogo: settings.companyLogo || 'None'
        },
        user: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        targetType: 'Settings',
        severity: 'low'
      });

      console.log('Activity logged for logo deletion:', { deletedLogo: settings.companyLogo });
    }
    
    return res.json({ message: "Logo deleted successfully" });
  } catch (err) {
    console.error("Failed to delete logo:", err);
    return res.status(500).json({ message: "Failed to delete logo" });
  }
});

// Get public settings (no authentication required - for login page)
router.get("/public", async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    // Only return public-safe fields
    const publicSettings = {
      companyName: settings.companyName,
      siteTitle: settings.siteTitle,
      siteIcon: settings.siteIcon,
      companyLogo: settings.companyLogo,
      primaryColor: settings.primaryColor,
      secondaryColor: settings.secondaryColor,
      theme: settings.theme,
      loginPageTitle: settings.loginPageTitle,
      showForgotPassword: settings.showForgotPassword
    };
    return res.json(publicSettings);
  } catch (err) {
    console.error("Failed to fetch public settings:", err);
    return res.status(500).json({ message: "Failed to fetch settings" });
  }
});

// Get global settings (all authenticated users)
router.get("/", auth, async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    return res.json(settings);
  } catch (err) {
    console.error("Failed to fetch settings:", err);
    return res.status(500).json({ message: "Failed to fetch settings" });
  }
});

// Update global settings (super_admin only)
router.put("/", auth, requireRole("super_admin"), async (req, res) => {
  try {
    const {
      companyName,
      siteTitle,
      siteIcon,
      primaryColor,
      secondaryColor,
      currency,
      timezone,
      dateFormat,
      lowStockThreshold,
      enableNotifications,
      backupFrequency,
      companyAddress,
      companyPhone,
      companyEmail,
      invoiceTerms,
      loginPageTitle,
      showForgotPassword,
      telegramBotToken,
      telegramChatId,
      isTelegramEnabled
    } = req.body;

    const updateData = {};
    
    if (companyName !== undefined) updateData.companyName = companyName.trim();
    if (siteTitle !== undefined) updateData.siteTitle = siteTitle.trim();
    if (siteIcon !== undefined) updateData.siteIcon = siteIcon.trim();
    if (primaryColor !== undefined) updateData.primaryColor = primaryColor.trim();
    if (secondaryColor !== undefined) updateData.secondaryColor = secondaryColor.trim();
    if (currency !== undefined) updateData.currency = currency.trim();
    if (timezone !== undefined) updateData.timezone = timezone.trim();
    if (dateFormat !== undefined) updateData.dateFormat = dateFormat.trim();
    if (lowStockThreshold !== undefined) updateData.lowStockThreshold = Number(lowStockThreshold);
    if (enableNotifications !== undefined) updateData.enableNotifications = Boolean(enableNotifications);
    if (backupFrequency !== undefined) updateData.backupFrequency = backupFrequency;
    if (companyAddress !== undefined) updateData.companyAddress = companyAddress.trim();
    if (companyPhone !== undefined) updateData.companyPhone = companyPhone.trim();
    if (companyEmail !== undefined) updateData.companyEmail = companyEmail.trim();
    if (invoiceTerms !== undefined) updateData.invoiceTerms = invoiceTerms.trim();
    if (loginPageTitle !== undefined) updateData.loginPageTitle = loginPageTitle.trim();
    if (showForgotPassword !== undefined) updateData.showForgotPassword = Boolean(showForgotPassword);
    if (telegramBotToken !== undefined) updateData.telegramBotToken = telegramBotToken.trim();
    if (telegramChatId !== undefined) updateData.telegramChatId = telegramChatId.trim();
    if (isTelegramEnabled !== undefined) updateData.isTelegramEnabled = Boolean(isTelegramEnabled);

    const settings = await Settings.updateSettings(updateData);

    // Log activity for settings update
    const updatedFields = Object.keys(updateData);
    const settingCategories = {
      companyName: 'Business Info',
      siteTitle: 'Site Settings',
      siteIcon: 'Site Settings',
      primaryColor: 'Theme Settings',
      secondaryColor: 'Theme Settings',
      currency: 'Business Info',
      timezone: 'System Settings',
      dateFormat: 'System Settings',
      lowStockThreshold: 'Inventory Settings',
      enableNotifications: 'Notification Settings',
      backupFrequency: 'System Settings',
      companyAddress: 'Business Info',
      companyPhone: 'Business Info',
      companyEmail: 'Business Info',
      invoiceTerms: 'Business Info',
      loginPageTitle: 'Site Settings',
      showForgotPassword: 'Site Settings',
      telegramBotToken: 'Notification Settings',
      telegramChatId: 'Notification Settings',
      isTelegramEnabled: 'Notification Settings'
    };

    const categories = [...new Set(updatedFields.map(field => settingCategories[field] || 'General Settings'))];
    
    await Activity.logActivity({
      action: 'settings_updated',
      description: `${req.user.role} updated system settings: ${categories.join(', ')}`,
      details: { 
        updatedFields: updateData,
        categories: categories,
        fieldCount: updatedFields.length
      },
      user: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      targetType: 'Settings',
      severity: 'low'
    });

    console.log('Activity logged for settings update:', { categories, fieldCount: updatedFields.length });
    
    return res.json({
      message: "Settings updated successfully",
      settings
    });
  } catch (err) {
    console.error("Failed to update settings:", err);
    return res.status(500).json({ message: "Failed to update settings" });
  }
});

// Reset user password (super_admin only)
router.post("/reset-password/:userId", auth, requireRole("super_admin"), async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    const User = require("../models/User");
    const bcrypt = require("bcryptjs");
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    await user.save();

    return res.json({
      message: "Password reset successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error("Failed to reset password:", err);
    return res.status(500).json({ message: "Failed to reset password" });
  }
});

module.exports = router;
