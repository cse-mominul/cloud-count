const express = require("express");
const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const Invoice = require("../models/Invoice");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Activity = require("../models/Activity");
const Settings = require("../models/Settings");
const { auth, requireRole } = require("../middleware/auth");
const { resolveVendorContext, vendorFilter } = require("../middleware/vendorContext");

const router = express.Router();

const SERIAL_CATEGORIES = ["Mobile", "Electronics"];

// List invoices (optionally filter by customer or search)
router.get("/", auth, resolveVendorContext, async (req, res) => {
  try {
    const { customerId, search, limit, skip, startDate, endDate } = req.query;
    const query = vendorFilter(req, {});
    if (customerId) {
      query.customer = customerId;
    }
    if (search && search.trim().length > 0) {
      const s = search.trim();
      // find customers whose name matches search (case-insensitive)
      const customers = await Customer.find({ name: new RegExp(s, "i") }).select("_id");
      const customerIds = customers.map((c) => c._id);
      const orConditions = [];
      if (customerIds.length > 0) {
        orConditions.push({ customer: { $in: customerIds } });
      }
      // search invoiceNumber case-insensitive
      orConditions.push({ invoiceNumber: new RegExp(s, "i") });
      query.$or = orConditions;
    }

    // apply date range filters on createdAt if provided (startDate, endDate expected in ISO yyyy-mm-dd)
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const d = new Date(endDate);
        d.setHours(23, 59, 59, 999);
        query.createdAt.$lte = d;
      }
    }

    // parse pagination params as integers
    const limitInt = limit ? parseInt(limit, 10) : undefined;
    const skipInt = skip ? parseInt(skip, 10) : undefined;

    let q = Invoice.find(query)
      .populate("customer", "name email phone")
      .sort({ createdAt: -1 });

    if (Number.isInteger(skipInt) && skipInt > 0) q = q.skip(skipInt);
    if (Number.isInteger(limitInt) && limitInt > 0) q = q.limit(limitInt);

    const [invoices, total] = await Promise.all([
      q.exec(),
      Invoice.countDocuments(query)
    ]);

    // provide total count for pagination in frontend and expose header for CORS
    res.set("x-total-count", String(total));
    res.set("Access-Control-Expose-Headers", "x-total-count");
    return res.json(invoices);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load invoices" });
  }
});

// Create invoice (and update stock + customer due) - All authenticated users can create sales
router.post("/", auth, resolveVendorContext, async (req, res) => {
  try {
    if (!req.vendorId) {
      return res.status(400).json({ message: "Vendor context is required to create invoices" });
    }

    const {
      customerId,
      items,
      paidAmount = 0,
      notes,
      discountType,
      discountValue
    } = req.body;
    if (!customerId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Customer and at least one item are required" });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    let subtotal = 0;
    let totalCost = 0;
    const invoiceItems = [];

    for (const item of items) {
      const product = await Product.findOne(vendorFilter(req, { _id: item.productId }));
      if (!product) {
        return res.status(400).json({ message: `Product not found: ${item.productId}` });
      }
      let quantity = Number(item.quantity) || 0;
      if (quantity <= 0) {
        return res.status(400).json({ message: "Quantity must be greater than zero" });
      }

      const isSerialCategory =
        product.category && SERIAL_CATEGORIES.includes(product.category.trim());

      let serialNumber = null;
      if (isSerialCategory) {
        if (!item.serialNumber) {
          return res.status(400).json({
            message: `Serial/IMEI number is required for ${product.name}`
          });
        }
        if (
          !Array.isArray(product.serialNumbers) ||
          !product.serialNumbers.includes(item.serialNumber)
        ) {
          return res.status(400).json({
            message: `Selected serial is not available for ${product.name}`
          });
        }
        serialNumber = item.serialNumber;
        quantity = 1;
      }
      if (product.stock < quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
      }

      const unitPriceRaw =
        item.unitPrice != null && item.unitPrice !== ""
          ? Number(item.unitPrice)
          : product.salePrice;
      if (!Number.isFinite(unitPriceRaw) || unitPriceRaw <= 0) {
        return res.status(400).json({
          message: `Invalid unit price for ${product.name}`
        });
      }
      const salePrice = unitPriceRaw;
      const costPrice = product.costPrice;
      const lineTotal = salePrice * quantity;

      subtotal += lineTotal;
      totalCost += costPrice * quantity;

      invoiceItems.push({
        product: product._id,
        name: product.name,
        quantity,
        salePrice,
        costPrice,
        lineTotal,
        serialNumber: serialNumber || undefined
      });

      if (isSerialCategory) {
        product.serialNumbers = (product.serialNumbers || []).filter(
          (s) => s !== serialNumber
        );
        product.stock = product.serialNumbers.length;
      } else {
        product.stock -= quantity;
      }
      await product.save();
    }

    const discountTypeNorm =
      discountType === "percent" || discountType === "flat"
        ? discountType
        : "flat";
    const discountValueNum = Number(discountValue) || 0;
    let discountAmount = 0;
    if (discountValueNum > 0 && subtotal > 0) {
      if (discountTypeNorm === "percent") {
        discountAmount = (subtotal * discountValueNum) / 100;
      } else {
        discountAmount = discountValueNum;
      }
      if (discountAmount > subtotal) {
        discountAmount = subtotal;
      }
    }

    const totalAmount = subtotal - discountAmount;

    const profit = totalAmount - totalCost;
    const dueAmount = Math.max(totalAmount - paidAmount, 0);
    const status =
      dueAmount === 0 ? "paid" : paidAmount > 0 ? "partial" : "unpaid";

    // update customer due
    customer.totalDue += dueAmount;
    await customer.save();

    const invoice = await Invoice.create({
      vendorId: req.vendorId,
      customer: customer._id,
      items: invoiceItems,
      discountType: discountTypeNorm,
      discountValue: discountValueNum,
      discountAmount,
      totalAmount,
      totalCost,
      profit,
      paidAmount,
      dueAmount,
      status,
      notes
    });

    const populated = await invoice.populate("customer", "name email phone");

    // Log invoice creation activity
    await Activity.logActivity({
      action: 'invoice_created',
      description: `Created new invoice #${invoice._id.toString().slice(-6)} for ${customer.name}`,
      details: { 
        targetId: invoice._id,
        invoiceId: invoice._id,
        customerId: customer._id,
        customerName: customer.name,
        totalAmount,
        itemCount: items.length,
        status
      },
      user: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      targetId: invoice._id,
      targetType: 'Invoice',
      severity: 'medium'
    });

    return res.status(201).json(populated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to create invoice" });
  }
});

// Get single invoice
router.get("/:id", auth, resolveVendorContext, async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findOne(vendorFilter(req, { _id: id })).populate("customer", "name email phone address");
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    return res.json(invoice);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load invoice" });
  }
});

// Update invoice (paidAmount, notes) and sync customer totalDue
router.patch("/:id", auth, resolveVendorContext, async (req, res) => {
  try {
    const { id } = req.params;
    const { paidAmount, notes } = req.body;
    const invoice = await Invoice.findOne(vendorFilter(req, { _id: id }));
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const oldDueAmount = invoice.dueAmount;
    const newPaidAmount =
      paidAmount !== undefined ? Number(paidAmount) : invoice.paidAmount;
    const newDueAmount = Math.max(
      invoice.totalAmount - (Number.isFinite(newPaidAmount) ? newPaidAmount : 0),
      0
    );
    const newStatus =
      newDueAmount === 0 ? "paid" : newPaidAmount > 0 ? "partial" : "unpaid";

    invoice.paidAmount = Number.isFinite(newPaidAmount) ? newPaidAmount : invoice.paidAmount;
    invoice.dueAmount = newDueAmount;
    invoice.status = newStatus;
    if (notes !== undefined) invoice.notes = notes;
    await invoice.save();

    const customer = await Customer.findById(invoice.customer);
    if (customer) {
      customer.totalDue = Math.max(
        0,
        (customer.totalDue || 0) - oldDueAmount + newDueAmount
      );
      await customer.save();
    }

    const populated = await Invoice.findOne(vendorFilter(req, { _id: id })).populate(
      "customer",
      "name email phone"
    );
    return res.json(populated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update invoice" });
  }
});

// Generate PDF for invoice
router.get("/:id/pdf", auth, resolveVendorContext, async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findOne(vendorFilter(req, { _id: id })).populate("customer", "name email phone address");
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Get company settings
    const settings = await Settings.getSettings();

    const doc = new PDFDocument({ margin: 40 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${invoice._id}.pdf`
    );

    doc.pipe(res);

    // Professional Header
    doc.fontSize(24).text("INVOICE", { align: "right" });
    doc.fontSize(16).text(`#${String(invoice._id).slice(-6).toUpperCase()}`, { align: "right" });
    doc.fontSize(10).text(
      invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString() : new Date().toLocaleDateString(),
      { align: "right" }
    );
    doc.moveDown(1.5);

    // Company Logo (if available)
    if (settings.companyLogo) {
      try {
        const logoPath = path.join(__dirname, "..", settings.companyLogo);
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 40, doc.y, { width: 80 });
          doc.moveDown(0.5);
        }
      } catch (error) {
        console.log("Could not load company logo:", error);
      }
    }

    // Company Info
    doc.fontSize(20).text(settings.companyName, { align: "left" });
    doc.fontSize(10).text(settings.companyAddress, { align: "left" });
    doc.text(settings.companyPhone, { align: "left" });
    doc.text(settings.companyEmail, { align: "left" });
    doc.moveDown(1.5);

    // Customer Info
    doc.fontSize(12).text("Bill To:", { underline: true });
    doc.fontSize(11).text(invoice.customer.name);
    doc.text(invoice.customer.phone || "—");
    doc.text(invoice.customer.email || "—");
    if (invoice.customer.address) {
      doc.text(invoice.customer.address);
    }
    doc.moveDown(1.5);

    // Items Table
    doc.fontSize(12).text("Product Name/Description", 40, doc.y, { continued: true })
      .text("Price", 300, doc.y, { continued: true })
      .text("QTY", 380, doc.y, { continued: true })
      .text("Total", 450, doc.y);

    doc.moveTo(40, doc.y + 5).lineTo(550, doc.y + 5).stroke();
    doc.moveDown(0.5);

    // Table Items
    invoice.items.forEach((item) => {
      doc.fontSize(10);
      const y = doc.y;
      doc.text(item.name, 40, y, { width: 250 });
      if (item.serialNumber) {
        doc.fontSize(8).text(`Serial: ${item.serialNumber}`, 40, doc.y, { width: 250 });
        doc.fontSize(10);
      }
      doc.text(settings.currency + item.salePrice.toFixed(2), 300, y);
      doc.text(item.quantity.toString(), 380, y);
      doc.text(settings.currency + item.lineTotal.toFixed(2), 450, y);
      doc.moveDown(0.8);
    });

    doc.moveTo(40, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1);

    // Summary
    const summaryY = doc.y;
    doc.fontSize(11).text("Subtotal:", 350, summaryY);
    doc.text(settings.currency + invoice.totalAmount.toFixed(2), 450, summaryY);
    
    doc.text("Paid:", 350, summaryY + 20);
    doc.text(settings.currency + invoice.paidAmount.toFixed(2), 450, summaryY + 20);
    
    doc.fontSize(12).text("Due Amount:", 350, summaryY + 40);
    doc.text(settings.currency + invoice.dueAmount.toFixed(2), 450, summaryY + 40);
    
    doc.moveTo(350, summaryY + 55).lineTo(550, summaryY + 55).stroke();
    
    // Status
    doc.fontSize(10).text(`Status: ${invoice.status.toUpperCase()}`, 350, summaryY + 65);
    
    doc.moveDown(2);

    // Terms & Conditions
    if (settings.invoiceTerms) {
      doc.fontSize(11).text("Terms & Conditions:", { underline: true });
      doc.fontSize(9).text(settings.invoiceTerms, { align: "justify" });
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(8).text(
      `Thank you for your business! | ${settings.companyName} | ${settings.companyPhone} | ${settings.companyEmail}`,
      { align: "center" }
    );

    doc.end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to generate PDF" });
  }
});

// Delete invoice - Manager+ can delete, Staff can only view
router.delete("/:id", auth, resolveVendorContext, requireRole("admin", "super_admin", "manager"), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the invoice
    const invoice = await Invoice.findOne(vendorFilter(req, { _id: id })).populate('customer');
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    console.log("Deleting invoice:", invoice.invoiceNumber, "for customer:", invoice.customer?.name);

    // Start a session for atomic operations
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Restore stock quantities for all items
      for (const item of invoice.items) {
        const product = await Product.findOne(vendorFilter(req, { _id: item.product }));
        if (product) {
          const oldStock = product.stock;
          const quantityToAdd = item.quantity;
          
          // Add the quantity back to product stock
          product.stock = oldStock + quantityToAdd;
          
          // Handle serial numbers if applicable
          if (item.serialNumber && SERIAL_CATEGORIES.includes(product.category)) {
            const currentSerials = Array.isArray(product.serialNumbers) ? product.serialNumbers : [];
            if (currentSerials.includes(item.serialNumber)) {
              // Remove the serial number from the list
              product.serialNumbers = currentSerials.filter(s => s !== item.serialNumber);
            }
          }
          
          await product.save();
          console.log(`Restored ${quantityToAdd} units to product: ${product.name} (was ${oldStock}, now ${product.stock})`);
        }
      }

      // 2. Update customer due amount (if invoice had due amount)
      if (invoice.customer && invoice.dueAmount > 0) {
        const customer = await Customer.findById(invoice.customer._id);
        if (customer) {
          const oldDue = customer.totalDue || 0;
          customer.totalDue = Math.max(0, oldDue - invoice.dueAmount);
          await customer.save();
          console.log(`Updated customer due: ${customer.name} (was ${oldDue}, now ${customer.totalDue})`);
        }
      }

      // 3. Log activity before deletion
      await Activity.logActivity({
        action: 'invoice_deleted',
        description: `Deleted invoice #${invoice.invoiceNumber} for customer ${invoice.customer?.name}`,
        details: {
          targetId: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          customerName: invoice.customer?.name,
          customerId: invoice.customer?.customerId,
          totalAmount: invoice.totalAmount,
          dueAmount: invoice.dueAmount,
          items: invoice.items.map(item => ({
            productName: item.name,
            quantity: item.quantity,
            salePrice: item.salePrice
          }))
        },
        user: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        targetId: invoice._id,
        targetType: 'Invoice',
        severity: 'high'
      });

      // 4. Delete the invoice
      await Invoice.findOneAndDelete(vendorFilter(req, { _id: id }));
      
      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      console.log("Invoice deleted successfully:", invoice.invoiceNumber);

      return res.json({
        message: "Invoice deleted successfully",
        invoice: {
          id: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          customerName: invoice.customer?.name
        }
      });

    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      session.endSession();
      
      console.error("Error deleting invoice:", error);
      return res.status(500).json({ 
        message: "Failed to delete invoice", 
        details: error.message 
      });
    }

  } catch (err) {
    console.error("Invoice deletion error:", err);
    return res.status(500).json({ 
      message: "Failed to delete invoice",
      details: err.message 
    });
  }
});

module.exports = router;

