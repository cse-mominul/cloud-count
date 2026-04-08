const express = require("express");
const Product = require("../models/Product");
const Invoice = require("../models/Invoice");
const Customer = require("../models/Customer");
const Activity = require("../models/Activity");
const Expense = require("../models/Expense");
const { auth } = require("../middleware/auth");
const { resolveVendorContext, vendorFilter } = require("../middleware/vendorContext");

const router = express.Router();

// Dashboard stats: total stock, low stock alerts, profit/loss, category breakdown, recent activity
router.get("/dashboard", auth, resolveVendorContext, async (req, res) => {
  try {
    const productMatch = vendorFilter(req, {});
    const invoiceMatch = vendorFilter(req, {});
    const customerMatch = vendorFilter(req, {});
    const expenseMatch = vendorFilter(req, {});
    const lowStockMatch = vendorFilter(req, {
      stock: { $lte: 5 },
      isActive: true
    });
    const recentActivityPromise = Activity.getRecentActivities(5);

    const [
      totalStockAgg,
      inventoryCostAgg,
      categoryAgg,
      lowStockItems,
      invoiceAgg,
      dueAgg,
      recentActivities,
      monthlyRevenue,
      monthlyExpenses,
      totalExpensesAgg  // CRITICAL: Add total expenses aggregation
    ] = await Promise.all([
      Product.aggregate([
        { $match: productMatch },
        { $group: { _id: null, totalStock: { $sum: "$stock" } } }
      ]),
      Product.aggregate([
        { $match: productMatch },
        { 
          $group: { 
            _id: null, 
            totalInventoryCost: { $sum: { $multiply: ["$costPrice", "$stock"] } } 
          } 
        }
      ]),
      Product.aggregate([
        { $match: productMatch },
        {
          $group: {
            _id: { $ifNull: ["$category", "Uncategorized"] },
            totalStock: { $sum: "$stock" }
          }
        },
        { $sort: { totalStock: -1 } }
      ]),
      Product.find(lowStockMatch).select("name stock lowStockThreshold"),
      Invoice.aggregate([
        { $match: invoiceMatch },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAmount" },
            totalCost: { $sum: "$totalCost" },
            totalProfit: { $sum: { $subtract: ["$totalAmount", "$totalCost"] } }
          }
        }
      ]),
      // CRITICAL: Calculate total customer dues by summing all customer.totalDue fields
      // This ensures consistency with payment updates which modify customer.totalDue
      Customer.aggregate([
        { $match: customerMatch },
        {
          $group: {
            _id: null,
            totalDue: { $sum: "$totalDue" }
          }
        }
      ]),
      recentActivityPromise,
      // Get monthly revenue for last 6 months using compatible date aggregation
      Invoice.aggregate([
        {
          $match: {
            ...invoiceMatch,
            createdAt: { $gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" }
            },
            revenue: { $sum: "$totalAmount" },
            cost: { $sum: "$totalCost" },
            profit: { $sum: "$profit" }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ]),
      // Get monthly expenses for last 6 months using compatible date aggregation
      Expense.aggregate([
        {
          $match: {
            ...expenseMatch,
            date: { $gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) },
            status: 'approved'
          }
        },
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              month: { $month: "$date" }
            },
            expenses: { $sum: "$amount" }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ]),
      // CRITICAL: Get TOTAL expenses for profit calculation
      Expense.aggregate([
        {
          $match: vendorFilter(req, { status: 'approved' })
        },
        {
          $group: {
            _id: null,
            totalExpenses: { $sum: "$amount" }
          }
        }
      ])
    ]);

    const totalStock = totalStockAgg[0]?.totalStock || 0;
    const totalInventoryCost = inventoryCostAgg[0]?.totalInventoryCost || 0;

    const revenue = invoiceAgg[0]?.totalRevenue || 0;
    const cost = invoiceAgg[0]?.totalCost || 0;
    const totalExpenses = totalExpensesAgg[0]?.totalExpenses || 0; // CRITICAL: Use total expenses aggregation

    console.log('Dashboard - Profit Calculation:', {
      revenue: revenue,
      cost: cost,
      totalExpenses: totalExpenses,
      calculation: `(${revenue} - ${cost}) - ${totalExpenses}`,
      finalProfit: (revenue - cost) - totalExpenses
    });

    // Net profit should subtract cost *and* all expenses
    const profit = (revenue - cost) - totalExpenses;

    const totalDue = dueAgg[0]?.totalDue || 0;

    // Add formatted descriptions to activities
    const recentActivity = recentActivities.map(activity => ({
      ...activity.toObject(),
      formattedDescription: activity.getFormattedDescription()
    }));

    const categoryStock = categoryAgg.map((c) => ({
      category: c._id,
      totalStock: c.totalStock
    }));

    // Combine monthly data for business status chart
    const businessStatus = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Create monthly data for last 6 months
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date();
      monthDate.setMonth(monthDate.getMonth() - i);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth() + 1; // MongoDB months are 1-based
      
      const monthRevenue = monthlyRevenue.find(m => 
        m._id && m._id.year === year && m._id.month === month
      ) || { revenue: 0, cost: 0, profit: 0 };
      
      const monthExpenses = monthlyExpenses.find(m => 
        m._id && m._id.year === year && m._id.month === month
      ) || { expenses: 0 };
      
      const netProfit = monthRevenue.profit - monthExpenses.expenses;
      
      businessStatus.push({
        month: monthNames[monthDate.getMonth()],
        revenue: monthRevenue.revenue,
        expenses: monthExpenses.expenses,
        netProfit: netProfit
      });
    }

    return res.json({
      totalStock,
      totalInventoryCost,
      lowStockCount: lowStockItems.length,
      lowStockItems,
      revenue,
      cost,
      profit,
      loss: profit < 0 ? Math.abs(profit) : 0,
      totalDue,
      totalExpenses,  // CRITICAL: Include total expenses in response for frontend
      categoryStock,
      recentActivity,
      profitByProduct: [],
      businessStatus
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load stats" });
  }
});

module.exports = router;

