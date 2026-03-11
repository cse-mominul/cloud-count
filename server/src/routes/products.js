const express = require("express");
const Product = require("../models/Product");
const Invoice = require("../models/Invoice");
const StockLog = require("../models/StockLog");
const Activity = require("../models/Activity");
const Settings = require("../models/Settings");
const { sendEventNotification } = require("../utils/telegramNotifications");
const { auth, requireRole, isAdmin } = require("../middleware/auth");

const router = express.Router();

const SERIAL_CATEGORIES = ["Mobile", "Electronics"];

// Get all products
router.get("/", auth, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    return res.json(products);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load products" });
  }
});

// NEW: Product suggestions for auto-complete
router.get("/suggestions", auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const suggestions = await Product.find({
      $or: [
        { name: { $regex: q, $options: "i" } },
        { sku: { $regex: q, $options: "i" } }
      ]
    })
    .limit(5)
    .select("name category costPrice salePrice sku lowStockThreshold");
    return res.json(suggestions);
  } catch (err) {
    return res.status(500).json({ message: "Search failed" });
  }
});

// Create product (admin, super_admin, manager only) - Staff cannot create
router.post("/", auth, requireRole("admin", "super_admin", "manager"), async (req, res) => {
  try {
    const {
      name,
      sku,
      category,
      description,
      costPrice,
      salePrice,
      stock,
      lowStockThreshold,
      serialNumbers
    } = req.body;

    if (!name || costPrice == null || salePrice == null) {
      return res
        .status(400)
        .json({ message: "Name, costPrice and salePrice are required" });
    }

    let cleanedSerials = Array.isArray(serialNumbers)
      ? Array.from(
          new Set(
            serialNumbers
              .map((s) => String(s).trim())
              .filter((s) => s.length > 0)
          )
        )
      : [];

    const isSerialCategory =
      category && SERIAL_CATEGORIES.includes(category.trim());

    let finalStock = Number(stock);
    if (Number.isNaN(finalStock) || finalStock < 0) {
      finalStock = 0;
    }

    if (isSerialCategory) {
      if (cleanedSerials.length === 0) {
        return res.status(400).json({
          message:
            "Serial numbers are required for Mobile/Electronics products"
        });
      }
      finalStock = cleanedSerials.length;
    }

    const product = await Product.create({
      name,
      sku,
      category,
      description,
      costPrice,
      salePrice,
      stock: finalStock,
      lowStockThreshold,
      serialNumbers: cleanedSerials
    });

    // Log product creation activity
    await Activity.logActivity({
      action: 'product_created',
      description: `${req.user.role} added new product: ${name} (${finalStock} units)`,
      details: { 
        targetId: product._id,
        name,
        category,
        stock: finalStock,
        costPrice,
        salePrice
      },
      user: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      targetId: product._id,
      targetType: 'Product',
      severity: 'medium'
    });

    return res.status(201).json(product);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to create product" });
  }
});

// Update product (admin, super_admin, manager only) - Staff cannot update
router.put("/:id", auth, requireRole("admin", "super_admin", "manager"), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (updates.name !== undefined) {
      product.name = updates.name;
    }
    if (updates.sku !== undefined) {
      product.sku = updates.sku;
    }
    if (updates.category !== undefined) {
      product.category = updates.category;
    }
    if (updates.description !== undefined) {
      product.description = updates.description;
    }
    if (updates.costPrice != null) {
      product.costPrice = updates.costPrice;
    }
    if (updates.salePrice != null) {
      product.salePrice = updates.salePrice;
    }
    if (updates.lowStockThreshold != null) {
      product.lowStockThreshold = updates.lowStockThreshold;
    }

    if (Array.isArray(updates.serialNumbers)) {
      product.serialNumbers = Array.from(
        new Set(
          updates.serialNumbers
            .map((s) => String(s).trim())
            .filter((s) => s.length > 0)
        )
      );
    }

    const isSerialCategory =
      product.category && SERIAL_CATEGORIES.includes(product.category.trim());

    if (isSerialCategory) {
      const serials = Array.isArray(product.serialNumbers)
        ? product.serialNumbers
        : [];
      product.stock = serials.length;
    } else if (updates.stock != null) {
      let newStock = Number(updates.stock);
      if (Number.isNaN(newStock) || newStock < 0) {
        newStock = 0;
      }
      product.stock = newStock;
    }

    await product.save();

    // Check for low stock and send notification
    try {
      const settings = await Settings.getSettings();
      const threshold = product.lowStockThreshold || settings.lowStockThreshold || 5;
      
      if (product.stock <= threshold) {
        // Send low stock notification
        sendEventNotification('product_low_stock', {
          name: product.name,
          stock: product.stock,
          sku: product.sku,
          threshold: threshold
        }).catch(err => {
          console.log('Low stock notification failed:', err.message);
        });
      }
    } catch (error) {
      console.log('Error checking low stock:', error.message);
    }

    // Log product update activity
    await Activity.logActivity({
      action: 'product_updated',
      description: `${req.user.role} updated product: ${product.name}`,
      details: { 
        targetId: product._id,
        name: product.name,
        updates,
        newStock: product.stock
      },
      user: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      targetId: product._id,
      targetType: 'Product',
      severity: 'medium'
    });

    return res.json(product);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update product" });
  }
});

// Product history (stock logs from invoices)
router.get("/:id/history", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const invoices = await Invoice.find({ "items.product": id })
      .sort({ issuedAt: -1 })
      .lean();

    const logs = [];
    for (const inv of invoices) {
      const item = (inv.items || []).find(
        (it) => String(it.product) === String(id)
      );
      if (item && (item.quantity || 0) > 0) {
        logs.push({
          type: "sale",
          quantity: item.quantity,
          invoiceId: inv._id,
          issuedAt: inv.issuedAt
        });
      }
    }

    return res.json({ product, logs });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load product history" });
  }
});

// Delete product (admin, super_admin only) - Manager and Staff cannot delete
router.delete("/:id", auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndDelete(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Log product deletion activity
    await Activity.logActivity({
      action: 'product_deleted',
      description: `${req.user.role} deleted product: ${product.name}`,
      details: { 
        targetId: product._id,
        name: product.name,
        category: product.category,
        stock: product.stock
      },
      user: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      targetId: product._id,
      targetType: 'Product',
      severity: 'high'
    });

    return res.json({ message: "Product deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to delete product" });
  }
});

// Get stock logs for a product
router.get("/:id/logs", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const logs = await StockLog.getProductHistory(id);
    return res.json({ product, logs });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load stock logs" });
  }
});

// Helper function to log stock changes
const logStockChange = async (productId, quantityChange, action, user, notes = '', invoice = null) => {
  try {
    const product = await Product.findById(productId);
    if (!product) return;

    const remainingQty = product.stock;
    await StockLog.logStockChange({
      product: productId,
      quantityChange,
      remainingQty,
      action,
      user: user.id,
      userName: user.name,
      userRole: user.role,
      notes,
      invoice
    });
  } catch (err) {
    console.error('Error logging stock change:', err);
  }
};

module.exports = router;

