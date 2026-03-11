const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Activity = require("../models/Activity");
const { auth } = require("../middleware/auth");
const { resolveVendorContext, vendorFilter } = require("../middleware/vendorContext");

const router = express.Router();

// Role-based access control middleware
const requireAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "super_admin")) {
    return res.status(403).json({ message: "Access denied. Admin role required." });
  }
  next();
};

// Get all users (admin/super_admin only)
router.get("/", auth, resolveVendorContext, requireAdmin, async (req, res) => {
  try {
    const users = await User.find(vendorFilter(req)).select("-passwordHash").sort({ createdAt: -1 });
    return res.json({ users });
  } catch (err) {
    console.error("Failed to fetch users:", err);
    return res.status(500).json({ message: "Failed to fetch users" });
  }
});

// Create new user (admin/super_admin only)
router.post("/", auth, resolveVendorContext, requireAdmin, async (req, res) => {
  try {
    const { name, email, password, role, vendorId: requestedVendorId } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Name, email, password, and role are required" });
    }

    // Validate role
    const validRoles = ["super_admin", "admin", "manager", "staff"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // Only super_admin can create super_admin users
    if (role === "super_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Only super admin can create super admin users" });
    }

    // Check if user already exists
    const targetVendorId = req.user.role === "super_admin"
      ? (requestedVendorId || req.vendorId || null)
      : req.vendorId;

    if (req.user.role !== "super_admin" && !targetVendorId) {
      return res.status(400).json({ message: "Vendor context is required to create user" });
    }

    const existingUser = await User.findOne({ email, vendorId: targetVendorId });
    if (existingUser) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      vendorId: targetVendorId,
      name,
      email,
      passwordHash,
      role
    });

    // Log activity for user creation
    await Activity.logActivity({
      action: 'user_created',
      description: `${req.user.role} created new user: ${name} (${role})`,
      details: { 
        targetId: user._id,
        name,
        email,
        role
      },
      user: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      targetId: user._id,
      targetType: 'User',
      severity: 'medium'
    });

    console.log('Activity logged for user creation:', { name, email, role });

    return res.status(201).json({
      message: "User created successfully",
      user: {
        id: user._id,
        vendorId: user.vendorId,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    console.error("Failed to create user:", err);
    return res.status(500).json({ message: "Failed to create user" });
  }
});

// Update user (admin/super_admin only)
router.put("/:id", auth, resolveVendorContext, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, role } = req.body;

    const user = await User.findOne(vendorFilter(req, { _id: id }));
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent self-modification of role by non-super_admin
    if (user._id.toString() === req.user.id && req.user.role !== "super_admin") {
      if (role && role !== user.role) {
        return res.status(403).json({ message: "You cannot change your own role" });
      }
    }

    // Only super_admin can assign super_admin role
    if (role === "super_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Only super admin can assign super admin role" });
    }

    // Prevent admin from modifying super_admin
    if (user.role === "super_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Cannot modify super admin users" });
    }

    const updateData = {};
    
    if (email) {
      // Check if email is already taken by another user
      const existingUser = await User.findOne(vendorFilter(req, { email, _id: { $ne: id } }));
      if (existingUser) {
        return res.status(400).json({ message: "Email is already in use by another user" });
      }
      updateData.email = email;
    }

    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    if (role) {
      const validRoles = ["super_admin", "admin", "manager", "staff"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      updateData.role = role;
    }

    const updatedUser = await User.findOneAndUpdate(
      vendorFilter(req, { _id: id }),
      updateData,
      { new: true }
    ).select("-passwordHash");

    // Log activity for user update
    await Activity.logActivity({
      action: 'user_updated',
      description: `${req.user.role} updated user: ${updatedUser.name}`,
      details: { 
        targetId: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        updates: updateData
      },
      user: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      targetId: updatedUser._id,
      targetType: 'User',
      severity: 'low'
    });

    console.log('Activity logged for user update:', { userId: id, updates: Object.keys(updateData) });

    return res.json({
      message: "User updated successfully",
      user: updatedUser
    });
  } catch (err) {
    console.error("Failed to update user:", err);
    return res.status(500).json({ message: "Failed to update user" });
  }
});

// Delete user (admin/super_admin only)
router.delete("/:id", auth, resolveVendorContext, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }

    const user = await User.findOne(vendorFilter(req, { _id: id }));
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent admin from deleting super_admin
    if (user.role === "super_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Cannot delete super admin users" });
    }

    // Store user details for logging before deletion
    const userDetails = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    await User.findOneAndDelete(vendorFilter(req, { _id: id }));

    // Log activity for user deletion
    await Activity.logActivity({
      action: 'user_deleted',
      description: `${req.user.role} deleted user: ${userDetails.name}`,
      details: userDetails,
      user: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      targetId: userDetails.id,
      targetType: 'User',
      severity: 'high'
    });

    console.log('Activity logged for user deletion:', userDetails);

    return res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Failed to delete user:", err);
    return res.status(500).json({ message: "Failed to delete user" });
  }
});

module.exports = router;
