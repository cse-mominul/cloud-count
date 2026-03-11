const express = require("express");
const Invoice = require("../models/Invoice");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Expense = require("../models/Expense");
const { auth, requireRole } = require("../middleware/auth");
const { resolveVendorContext, vendorFilter } = require("../middleware/vendorContext");

const router = express.Router();

// Helper function to get date range
const getDateRange = (filter) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  
  switch (filter) {
    case 'today':
      return { issuedAt: { $gte: startOfDay } };
    case 'week':
      return { issuedAt: { $gte: startOfWeek } };
    case '7days': {
      const past = new Date();
      past.setDate(now.getDate() - 7);
      return { issuedAt: { $gte: past } };
    }
    case 'month':
      return { issuedAt: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) } };
    case 'last30': {
      const past = new Date();
      past.setDate(now.getDate() - 30);
      return { issuedAt: { $gte: past } };
    }
    default:
      return {};
  }
};

// Sales Report
router.get("/sales", auth, resolveVendorContext, async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    const invoiceQuery = vendorFilter(req, {});
    
    if (period && period !== 'custom') {
      Object.assign(invoiceQuery, getDateRange(period));
    } else if (startDate && endDate) {
      invoiceQuery.issuedAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const invoices = await Invoice.find(invoiceQuery)
      .populate("customer", "name")
      .sort({ issuedAt: -1 });

    const totalSales = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const totalDue = invoices.reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);
    const invoiceCount = invoices.length;

    // Group by customer for detailed breakdown
    const customerBreakdown = invoices.reduce((acc, inv) => {
      const customerName = inv.customer?.name || 'Unknown';
      if (!acc[customerName]) {
        acc[customerName] = { sales: 0, paid: 0, due: 0, count: 0 };
      }
      acc[customerName].sales += inv.totalAmount || 0;
      acc[customerName].paid += inv.paidAmount || 0;
      acc[customerName].due += inv.dueAmount || 0;
      acc[customerName].count += 1;
      return acc;
    }, {});

    return res.json({
      summary: {
        totalSales,
        totalPaid,
        totalDue,
        invoiceCount
      },
      customerBreakdown,
      invoices: invoices.map(inv => ({
        id: inv._id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customer?.name,
        totalAmount: inv.totalAmount,
        paidAmount: inv.paidAmount,
        dueAmount: inv.dueAmount,
        status: inv.status,
        issuedAt: inv.issuedAt
      }))
    });
  } catch (err) {
    console.error("Sales report error:", err);
    return res.status(500).json({ message: "Failed to generate sales report" });
  }
});

// Stock Report
router.get("/stock", auth, resolveVendorContext, async (req, res) => {
  try {
    const products = await Product.find(vendorFilter(req, {})).sort({ name: 1 });
    
    const totalItems = products.length;
    const totalStockValue = products.reduce((sum, product) => {
      return sum + ((product.stock || 0) * (product.costPrice || 0));
    }, 0);
    
    const lowStockItems = products.filter(product => 
      (product.stock || 0) <= (product.lowStockThreshold || 5)
    );
    
    const outOfStockItems = products.filter(product => (product.stock || 0) === 0);

    // Group by category
    const categoryBreakdown = products.reduce((acc, product) => {
      const category = product.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = { count: 0, totalValue: 0, lowStock: 0 };
      }
      acc[category].count += 1;
      acc[category].totalValue += (product.stock || 0) * (product.costPrice || 0);
      acc[category].lowStock += (product.stock || 0) <= (product.lowStockThreshold || 5) ? 1 : 0;
      return acc;
    }, {});

    return res.json({
      summary: {
        totalItems,
        totalStockValue,
        lowStockCount: lowStockItems.length,
        outOfStockCount: outOfStockItems.length
      },
      categoryBreakdown,
      products: products.map(product => ({
        id: product._id,
        name: product.name,
        category: product.category,
        stock: product.stock || 0,
        costPrice: product.costPrice || 0,
        salePrice: product.salePrice || 0,
        stockValue: (product.stock || 0) * (product.costPrice || 0),
        lowStockThreshold: product.lowStockThreshold || 5,
        isLowStock: (product.stock || 0) <= (product.lowStockThreshold || 5),
        isOutOfStock: (product.stock || 0) === 0
      }))
    });
  } catch (err) {
    console.error("Stock report error:", err);
    return res.status(500).json({ message: "Failed to generate stock report" });
  }
});

// Profit/Loss Statement
router.get("/profit-loss", auth, resolveVendorContext, async (req, res) => {
  try {
    const { period, startDate, endDate, page = 1, limit = 10 } = req.query;
    console.log('Profit-Loss Request Params:', { period, startDate, endDate, page, limit });
    let dateQuery = {};
    let start, end;

    if (period && period !== 'custom') {
      const range = getDateRange(period);
      dateQuery = {
        ...range,
        status: { $ne: 'cancelled' }  // Exclude cancelled invoices
      };
      start = range.$gte;
      end = range.$lte;
    } else if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      // Set end date to end of day to include all invoices on that date
      end.setHours(23, 59, 59, 999);
      dateQuery = {
        issuedAt: { $gte: start, $lte: end },
        status: { $ne: 'cancelled' }  // Exclude cancelled invoices
      };
    } else {
      // Default: exclude cancelled invoices
      dateQuery = { status: { $ne: 'cancelled' } };
    }

    Object.assign(dateQuery, vendorFilter(req, {}));

    console.log('Date Query:', dateQuery);

    // count total invoices matching filter for pagination
    const totalCount = await Invoice.countDocuments(dateQuery);
    console.log('Total Invoice Count:', totalCount);

    // fetch actual invoices for debugging
    const debugInvoices = await Invoice.find(dateQuery).limit(5);
    console.log('Sample invoices for debugging:', debugInvoices.length, debugInvoices.map(i => ({ id: i._id, num: i.invoiceNumber, amount: i.totalAmount })));

    // compute overall totals (not just current page)
    const totalsAgg = await Invoice.aggregate([
      { $match: dateQuery },
      { $group: {
          _id: null,
          totalSales: { $sum: "$totalAmount" },
          totalCost: { $sum: "$totalCost" }
        }
      }
    ]);
    const totalSales = totalsAgg[0]?.totalSales || 0;
    const totalCost = totalsAgg[0]?.totalCost || 0;
    const grossProfit = totalSales - totalCost;

    const invoices = await Invoice.find(dateQuery)
      .populate("customer", "name")
      .sort({ issuedAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // Get expenses for the same period
    let totalExpenses = 0;
    try {
      const expenseAgg = await Expense.aggregate([
        {
          $match: vendorFilter(req, {
            status: 'approved',
            ...(start && end ? {
              date: { $gte: start, $lte: end }
            } : {})
          })
        },
        {
          $group: {
            _id: null,
            totalExpenses: { $sum: "$amount" }
          }
        }
      ]);
      totalExpenses = expenseAgg[0]?.totalExpenses || 0;
    } catch (err) {
      console.error('Error fetching expenses:', err);
      totalExpenses = 0;
    }

    const netProfit = grossProfit - totalExpenses;

    // Calculate profit margin
    const profitMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;

    // Monthly trend (last 6 months)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const monthInvoices = await Invoice.find(
        vendorFilter(req, {
          issuedAt: { $gte: monthStart, $lte: monthEnd }
        })
      );

      const monthSales = monthInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
      const monthCost = monthInvoices.reduce((sum, inv) => sum + (inv.totalCost || 0), 0);
      const monthProfit = monthSales - monthCost;

      monthlyTrend.push({
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        sales: monthSales,
        cost: monthCost,
        profit: monthProfit
      });
    }

    return res.json({
      summary: {
        totalSales,
        totalCost,
        grossProfit,
        totalExpenses,
        netProfit,
        profitMargin: profitMargin.toFixed(2)
      },
      monthlyTrend,
      invoices: invoices.map(inv => {
        const revenue = Number(inv.totalAmount || 0);
        const cost = Number(inv.totalCost || 0);
        const profit = revenue - cost;
        
        return {
          invoiceId: inv._id,
          invoiceNumber: inv.invoiceNumber,
          customerName: inv.customer?.name || 'Unknown Customer',
          revenue: revenue,
          cost: cost,
          profit: profit,
          date: inv.issuedAt
        };
      }),
      page: Number(page),
      limit: Number(limit),
      totalCount,
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (err) {
    console.error("Profit/Loss report error:", err);
    return res.status(500).json({ message: "Failed to generate profit/loss report" });
  }
});

// Expense Report (placeholder for now)
router.get("/expenses", auth, resolveVendorContext, async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    
    // TODO: Implement expense tracking model
    // For now, returning placeholder data
    return res.json({
      message: "Expense tracking is not yet implemented.",
      note: "This feature will be available in a future update.",
      period,
      startDate,
      endDate
    });
  } catch (err) {
    console.error("Expense report error:", err);
    return res.status(500).json({ message: "Failed to generate expense report" });
  }
});

module.exports = router;
