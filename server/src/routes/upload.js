const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { auth } = require("../middleware/auth");
const Settings = require("../models/Settings");

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../uploads/logos");
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with timestamp
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, "logo-" + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  // Only allow image files
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter
});

// Upload company logo
router.post("/logo", auth, upload.single("logo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Get current settings to clean up old logo
    const settings = await Settings.getSettings();
    
    // Delete old logo file if it exists
    if (settings.companyLogo) {
      const oldLogoPath = path.join(__dirname, "..", settings.companyLogo);
      if (fs.existsSync(oldLogoPath)) {
        fs.unlinkSync(oldLogoPath);
      }
    }

    // Save new logo path relative to server root
    const logoPath = req.file.path.replace(path.join(__dirname, ".."), "");
    
    // Update settings with new logo
    await Settings.updateSettings({ companyLogo: logoPath });

    res.json({ 
      message: "Logo uploaded successfully",
      logoPath: logoPath
    });
  } catch (error) {
    console.error("Logo upload error:", error);
    res.status(500).json({ message: "Failed to upload logo" });
  }
});

// Delete company logo
router.delete("/logo", auth, async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    
    // Delete logo file if it exists
    if (settings.companyLogo) {
      const logoPath = path.join(__dirname, "..", settings.companyLogo);
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
      }
    }

    // Update settings to remove logo
    await Settings.updateSettings({ companyLogo: "" });

    res.json({ message: "Logo deleted successfully" });
  } catch (error) {
    console.error("Logo deletion error:", error);
    res.status(500).json({ message: "Failed to delete logo" });
  }
});

// Serve logo files
router.get("/logo/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "../uploads/logos", filename);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ message: "Logo not found" });
  }
});

module.exports = router;
