const express = require("express");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Vendor = require("../models/Vendor");
const User = require("../models/User");
const { auth, requireRole } = require("../middleware/auth");

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../uploads/vendors");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "vendor-" + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const extname = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowed.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error("Only image files are allowed"));
  }
});

// GET /api/admin/vendors
router.get("/", auth, requireRole("super_admin"), async (req, res) => {
  try {
    const vendors = await Vendor.find().sort({ createdAt: -1 });
    return res.json({ vendors });
  } catch (err) {
    console.error("Failed to fetch vendors:", err);
    return res.status(500).json({ message: "Failed to fetch vendors" });
  }
});

// POST /api/admin/vendors
router.post("/", auth, requireRole("super_admin"), upload.single("logo"), async (req, res) => {
  try {
    const { companyName, businessEmail, phoneNumber, temporaryPassword } = req.body;

    if (!companyName || !businessEmail || !temporaryPassword) {
      return res.status(400).json({
        message: "Company Name, Business Email, and Temporary Password are required"
      });
    }

    const existingVendor = await Vendor.findOne({ businessEmail: businessEmail.trim().toLowerCase() });
    if (existingVendor) {
      return res.status(409).json({ message: "Vendor with this email already exists" });
    }

    const existingUser = await User.findOne({ email: businessEmail.trim().toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: "A user with this email already exists" });
    }

    const logoPath = req.file ? `/uploads/vendors/${req.file.filename}` : "";

    const vendor = await Vendor.create({
      companyName: companyName.trim(),
      businessEmail: businessEmail.trim().toLowerCase(),
      phoneNumber: phoneNumber?.trim() || "",
      logo: logoPath,
      status: "active"
    });

    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const ownerUser = await User.create({
      vendorId: vendor._id,
      name: `${vendor.companyName} Admin`,
      email: vendor.businessEmail,
      passwordHash,
      role: "admin"
    });

    vendor.ownerUser = ownerUser._id;
    await vendor.save();

    return res.status(201).json({
      message: "Vendor created successfully",
      vendor
    });
  } catch (err) {
    console.error("Failed to create vendor:", err);
    return res.status(500).json({ message: "Failed to create vendor" });
  }
});

// PUT /api/admin/vendors/:id
router.put("/:id", auth, requireRole("super_admin"), upload.single("logo"), async (req, res) => {
  try {
    const { id } = req.params;
    const { companyName, businessEmail, phoneNumber, status } = req.body;

    const vendor = await Vendor.findById(id);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    if (businessEmail && businessEmail.trim().toLowerCase() !== vendor.businessEmail) {
      const exists = await Vendor.findOne({
        businessEmail: businessEmail.trim().toLowerCase(),
        _id: { $ne: id }
      });
      if (exists) {
        return res.status(409).json({ message: "Vendor email already in use" });
      }
    }

    const oldBusinessEmail = vendor.businessEmail;

    if (companyName !== undefined) vendor.companyName = companyName.trim();
    if (businessEmail !== undefined) vendor.businessEmail = businessEmail.trim().toLowerCase();
    if (phoneNumber !== undefined) vendor.phoneNumber = phoneNumber.trim();
    if (status === "active" || status === "inactive") vendor.status = status;
    if (req.file) vendor.logo = `/uploads/vendors/${req.file.filename}`;

    await vendor.save();

    if (vendor.ownerUser) {
      const owner = await User.findById(vendor.ownerUser);
      if (owner) {
        owner.name = `${vendor.companyName} Admin`;
        if (vendor.businessEmail !== oldBusinessEmail) {
          owner.email = vendor.businessEmail;
        }
        await owner.save();
      }
    }

    return res.json({ message: "Vendor updated successfully", vendor });
  } catch (err) {
    console.error("Failed to update vendor:", err);
    return res.status(500).json({ message: "Failed to update vendor" });
  }
});

// PATCH /api/admin/vendors/:id/deactivate
router.patch("/:id/deactivate", auth, requireRole("super_admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const vendor = await Vendor.findById(id);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    vendor.status = "inactive";
    await vendor.save();

    return res.json({ message: "Vendor deactivated successfully", vendor });
  } catch (err) {
    console.error("Failed to deactivate vendor:", err);
    return res.status(500).json({ message: "Failed to deactivate vendor" });
  }
});

module.exports = router;
