const express = require("express");
const Category = require("../models/Category");
const Product = require("../models/Product");
const { auth, requireRole } = require("../middleware/auth");
const { resolveVendorContext, vendorFilter } = require("../middleware/vendorContext");

const router = express.Router();

// Get all categories
router.get("/", auth, resolveVendorContext, async (req, res) => {
  try {
    const categories = await Category.find(vendorFilter(req)).sort({ name: 1 });
    return res.json(categories);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load categories" });
  }
});

// Create category (admin, super_admin, manager only) - Staff cannot create
router.post("/", auth, resolveVendorContext, requireRole("admin", "super_admin", "manager"), async (req, res) => {
  try {
    if (!req.vendorId) {
      return res.status(400).json({ message: "Vendor context is required to create categories" });
    }

    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    const existing = await Category.findOne(vendorFilter(req, { name: name.trim() }));
    if (existing) {
      return res.status(400).json({ message: "Category with this name already exists" });
    }

    const category = await Category.create({
      vendorId: req.vendorId,
      name: name.trim(),
      description
    });

    return res.status(201).json(category);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to create category" });
  }
});

// Update category (admin, super_admin, manager only) – Staff cannot update
router.put("/:id", auth, resolveVendorContext, requireRole("admin", "super_admin", "manager"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const category = await Category.findOne(vendorFilter(req, { _id: id }));
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const oldName = category.name;

    if (name && name.trim() !== category.name) {
      const existing = await Category.findOne(vendorFilter(req, {
        _id: { $ne: id },
        name: name.trim()
      }));
      if (existing) {
        return res.status(400).json({ message: "Another category with this name already exists" });
      }
      category.name = name.trim();
    }

    if (description !== undefined) {
      category.description = description;
    }

    await category.save();

    if (oldName !== category.name) {
      await Product.updateMany(
        vendorFilter(req, { category: oldName }),
        { $set: { category: category.name } }
      );
    }

    return res.json(category);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update category" });
  }
});

// Delete category (admin, super_admin only) – Manager and Staff cannot delete
router.delete("/:id", auth, resolveVendorContext, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findOne(vendorFilter(req, { _id: id }));
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const linkedCount = await Product.countDocuments(vendorFilter(req, { category: category.name }));
    if (linkedCount > 0) {
      return res.status(400).json({
        message: `Cannot delete category while ${linkedCount} product(s) are linked to it`
      });
    }

    await Category.findOneAndDelete(vendorFilter(req, { _id: id }));
    return res.json({ message: "Category deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to delete category" });
  }
});

module.exports = router;

