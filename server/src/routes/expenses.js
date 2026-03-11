const express = require("express");
const Expense = require("../models/Expense");
const Activity = require("../models/Activity");
const { auth, requireRole, isAdmin } = require("../middleware/auth");
const { resolveVendorContext, vendorFilter } = require("../middleware/vendorContext");

const router = express.Router();

// Helper function to log activity
const logActivity = async (action, description, user, details = {}) => {
  try {
    await Activity.logActivity({
      action,
      description,
      details,
      user: user.id,
      userName: user.name,
      userRole: user.role,
      ipAddress: details.ipAddress || '',
      userAgent: details.userAgent || '',
      targetId: details.targetId,
      targetType: 'Expense'
    });
  } catch (err) {
    console.error('Error logging activity:', err);
  }
};

// Get all expenses with filters
router.get("/", auth, resolveVendorContext, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      category, 
      status, 
      page = 1, 
      limit = 20 
    } = req.query;
    
    const query = vendorFilter(req, {});
    
    // Date range filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    // Category filter
    if (category) query.category = category;
    
    // Status filter
    if (status) query.status = status;
    
    const skip = (page - 1) * limit;
    
    const expenses = await Expense.find(query)
      .populate('user', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Expense.countDocuments(query);
    
    return res.json({
      expenses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load expenses" });
  }
});

// Get expense statistics
router.get("/stats", auth, resolveVendorContext, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();
    
    const [totalExpenses, expensesByCategory, recentExpenses] = await Promise.all([
      Expense.getTotalExpenses(start, end, vendorFilter(req, {})),
      Expense.getExpensesByCategory(start, end, vendorFilter(req, {})),
      Expense.getRecentExpenses(5, vendorFilter(req, {}))
    ]);
    
    return res.json({
      totalExpenses,
      expensesByCategory,
      recentExpenses
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load expense statistics" });
  }
});

// Create expense (admin, super_admin, manager)
router.post("/", auth, resolveVendorContext, requireRole("admin", "super_admin", "manager"), async (req, res) => {
  try {
    const {
      reason,
      amount,
      category,
      date,
      description,
      receipt
    } = req.body;
    
    if (!req.vendorId) {
      return res.status(400).json({ message: "Vendor context is required to create expenses" });
    }

    const expense = new Expense({
      vendorId: req.vendorId,
      reason,
      amount,
      category,
      date: new Date(date),
      description,
      receipt,
      user: req.user.id,
      userName: req.user.name,
      userRole: req.user.role
    });
    
    await expense.save();
    
    // Log activity
    await logActivity(
      'expense_created',
      `Created expense: ${reason} - ৳${amount}`,
      req.user,
      { 
        targetId: expense._id,
        amount,
        category,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    );
    
    return res.status(201).json(expense);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to create expense" });
  }
});

// Update expense (admin, super_admin only)
router.put("/:id", auth, resolveVendorContext, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      reason,
      amount,
      category,
      date,
      description,
      receipt,
      status
    } = req.body;
    
    const expense = await Expense.findOne(vendorFilter(req, { _id: id }));
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }
    
    const oldData = { ...expense.toObject() };
    
    expense.reason = reason;
    expense.amount = amount;
    expense.category = category;
    expense.date = new Date(date);
    expense.description = description;
    expense.receipt = receipt;
    
    if (status && req.user.role !== 'staff') {
      expense.status = status;
      if (status === 'approved' && oldData.status !== 'approved') {
        expense.approvedBy = req.user.id;
        expense.approvedAt = new Date();
      }
    }
    
    await expense.save();
    
    // Log activity
    await logActivity(
      'expense_updated',
      `Updated expense: ${reason} - ৳${amount}`,
      req.user,
      { 
        targetId: expense._id,
        oldData,
        newData: expense.toObject(),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    );
    
    return res.json(expense);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update expense" });
  }
});

// Delete expense (admin, super_admin only)
router.delete("/:id", auth, resolveVendorContext, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const expense = await Expense.findOneAndDelete(vendorFilter(req, { _id: id }));
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }
    
    // Log activity
    await logActivity(
      'expense_deleted',
      `Deleted expense: ${expense.reason} - ৳${expense.amount}`,
      req.user,
      { 
        targetId: expense._id,
        deletedData: expense.toObject(),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    );
    
    return res.json({ message: "Expense deleted successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to delete expense" });
  }
});

module.exports = router;
