const express = require("express");
const Customer = require("../models/Customer");
const Invoice = require("../models/Invoice");
const Payment = require("../models/Payment");
const Activity = require("../models/Activity");
const { auth, requireRole } = require("../middleware/auth");
const { resolveVendorContext, vendorFilter } = require("../middleware/vendorContext");

const router = express.Router();

// List customers with optional search
router.get("/", auth, resolveVendorContext, async (req, res) => {
  try {
    const { search } = req.query;
    const filter = vendorFilter(req, {});

    if (search && search.trim().length > 0) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { name: regex }, 
        { phone: regex }, 
        { email: regex },
        { customerId: regex }
      ];
    }

    const customers = await Customer.find(filter).sort({ name: 1 });
    return res.json(customers);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load customers" });
  }
});

// Create customer - Manager+ can create, Staff can only view
router.post("/", auth, resolveVendorContext, requireRole("admin", "super_admin", "manager"), async (req, res) => {
  try {
    console.log("Customer creation request body:", req.body);

    if (!req.vendorId) {
      return res.status(400).json({ message: "Vendor context is required to create customers" });
    }
    
    const { name, email, phone, address } = req.body;
    
    // Validation
    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "Name is required" });
    }

    // Check for existing customer by email or phone
    let existingCustomer = null;
    if (email) {
      existingCustomer = await Customer.findOne(vendorFilter(req, { email: email.trim() }));
    }
    if (!existingCustomer && phone) {
      existingCustomer = await Customer.findOne(vendorFilter(req, { phone: phone.trim() }));
    }

    if (existingCustomer) {
      return res.status(409).json({ 
        message: "Customer already exists",
        customer: existingCustomer
      });
    }

    // Generate auto-incrementing customerId
    const count = await Customer.countDocuments(vendorFilter(req, {}));
    const newId = `SG-${1001 + count}`;
    console.log("Generated customerId:", newId, "based on count:", count);

    // Create new customer with generated ID
    const customerData = {
      customerId: newId,
      vendorId: req.vendorId,
      name: name.trim(),
      email: email?.trim() || undefined,
      phone: phone?.trim() || undefined,
      address: address?.trim() || undefined
    };

    console.log("Creating customer with data:", customerData);
    
    const customer = await Customer.create(customerData);
    console.log("Customer created successfully:", customer);

    // Log customer creation activity
    await Activity.logActivity({
      action: 'customer_created',
      description: `Added new customer: ${customer.name}`,
      details: { 
        targetId: customer._id,
        customerId: customer.customerId,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address
      },
      user: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      targetId: customer._id,
      targetType: 'Customer',
      severity: 'low'
    });

    return res.status(201).json({
      message: "Customer created successfully",
      customer
    });
    
  } catch (err) {
    console.error("Customer creation error:", err);
    
    // Handle validation errors specifically
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => ({
        field: error.path,
        message: error.message
      }));
      return res.status(400).json({ 
        message: "Validation failed", 
        errors,
        details: err.message
      });
    }
    
    // Handle duplicate key errors
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({ 
        message: `Customer with this ${field} already exists`,
        field,
        details: err.message
      });
    }
    
    return res.status(500).json({ 
      message: "Failed to create customer",
      details: err.message 
    });
  }
});

// Update customer - PUT method for full update
router.put("/:id", auth, resolveVendorContext, requireRole("admin", "super_admin", "manager"), async (req, res) => {
  try {
    console.log("Customer update request:", req.params.id, req.body);
    
    const { id } = req.params;
    const { name, phone, email, address } = req.body;
    
    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "Name is required" });
    }
    
    const customer = await Customer.findOne(vendorFilter(req, { _id: id }));
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // Store old data for activity logging
    const oldData = customer.toObject();
    
    // Check for duplicate email/phone (excluding current customer)
    if (email && email !== customer.email) {
      const emailExists = await Customer.findOne(vendorFilter(req, { 
        email: email.trim(), 
        _id: { $ne: id } 
      }));
      if (emailExists) {
        return res.status(409).json({ message: "Email already exists" });
      }
    }
    
    if (phone && phone !== customer.phone) {
      const phoneExists = await Customer.findOne(vendorFilter(req, { 
        phone: phone.trim(), 
        _id: { $ne: id } 
      }));
      if (phoneExists) {
        return res.status(409).json({ message: "Phone already exists" });
      }
    }

    // Update customer fields
    customer.name = name.trim();
    customer.email = email?.trim() || undefined;
    customer.phone = phone?.trim() || undefined;
    customer.address = address?.trim() || undefined;
    
    await customer.save();
    console.log("Customer updated successfully:", customer);

    // Log customer update activity
    await Activity.logActivity({
      action: 'customer_updated',
      description: `Updated customer: ${customer.name}`,
      details: { 
        targetId: customer._id,
        customerId: customer.customerId,
        oldData,
        newData: { name, email, phone, address }
      },
      user: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      targetId: customer._id,
      targetType: 'Customer',
      severity: 'low'
    });

    return res.json({
      message: "Customer updated successfully",
      customer
    });
    
  } catch (err) {
    console.error("Customer update error:", err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => ({
        field: error.path,
        message: error.message
      }));
      return res.status(400).json({ 
        message: "Validation failed", 
        errors,
        details: err.message
      });
    }
    
    return res.status(500).json({ 
      message: "Failed to update customer",
      details: err.message 
    });
  }
});

// Receive payment (FIFO invoice deduction by invoice ID)
router.post("/:id/payment", auth, resolveVendorContext, requireRole("admin", "super_admin", "manager"), async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const amt = Number(amount);
    
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }
    
    const customer = await Customer.findOne(vendorFilter(req, { _id: id }));
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }
    
    // Fetch invoices with due amount, sorted by createdAt (oldest first) for FIFO
    const invoicesWithDue = await Invoice.find(vendorFilter(req, {
      customer: id,
      dueAmount: { $gt: 0 }
    })).sort({ createdAt: 1 }).lean();
    
    // Deduct payment from invoices (FIFO)
    let remainingPayment = amt;
    const updatedInvoices = [];
    const invoiceIds = [];
    
    for (const invoice of invoicesWithDue) {
      if (remainingPayment <= 0) break;
      
      const deductAmount = Math.min(remainingPayment, invoice.dueAmount);
      const newDueAmount = invoice.dueAmount - deductAmount;
      const newStatus = newDueAmount === 0 ? 'paid' : invoice.status === 'unpaid' ? 'partial' : invoice.status;
      
      // Update invoice with new due amount and status
      await Invoice.findOneAndUpdate(
        vendorFilter(req, { _id: invoice._id }),
        {
          dueAmount: newDueAmount,
          paidAmount: (invoice.paidAmount || 0) + deductAmount,
          status: newStatus
        },
        { new: true }
      );
      
      updatedInvoices.push({
        invoiceId: invoice._id,
        amount: deductAmount,
        newDueAmount: newDueAmount
      });
      invoiceIds.push(invoice._id);
      remainingPayment -= deductAmount;
    }
    
    // Create payment record
    const payment = await Payment.create({
      vendorId: req.vendorId,
      customer: id,
      amount: amt,
      note: req.body.note?.trim()
    });
    
    // Update customer total due
    const oldTotalDue = customer.totalDue || 0;
    customer.totalDue = Math.max(0, oldTotalDue - amt);
    await customer.save();
    
    // Log payment received activity
    await Activity.logActivity({
      action: 'payment_received',
      description: `Received payment of ৳${amt} from ${customer.name} (${updatedInvoices.length} invoice(s) updated)`,
      details: {
        targetId: payment._id,
        amount: amt,
        customerId: customer._id,
        customerName: customer.name,
        invoicesUpdated: updatedInvoices.length,
        invoiceDetails: updatedInvoices,
        note: req.body.note?.trim()
      },
      user: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      targetId: customer._id,
      targetType: 'Customer',
      severity: 'medium'
    });
    
    return res.status(201).json({
      payment,
      customer,
      success: true,
      message: `Payment of ৳${amt} received successfully`,
      invoiceIds: invoiceIds,
      updatedInvoices: updatedInvoices,
      paymentSummary: {
        amount: amt,
        oldTotalDue: oldTotalDue,
        newTotalDue: customer.totalDue,
        invoicesUpdated: updatedInvoices.length
      }
    });
  } catch (err) {
    console.error('Payment error:', err);
    return res.status(500).json({ message: "Failed to record payment" });
  }
});

// Customer history with invoices and payments
router.get("/:id/history", auth, resolveVendorContext, async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findOne(vendorFilter(req, { _id: id }));
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const [invoices, payments] = await Promise.all([
      Invoice.find(vendorFilter(req, { customer: id })).sort({ issuedAt: -1 }).lean(),
      Payment.find(vendorFilter(req, { customer: id })).sort({ createdAt: -1 }).lean()
    ]);

    return res.json({
      customer,
      invoices,
      payments
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load history" });
  }
});

// Delete customer - Super Admin only
router.delete("/:id", auth, resolveVendorContext, requireRole("super_admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findOne(vendorFilter(req, { _id: id }));
    
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // Check if customer has any invoices
    const Invoice = require("../models/Invoice");
    const invoiceCount = await Invoice.countDocuments(vendorFilter(req, { customer: id }));
    
    if (invoiceCount > 0) {
      return res.status(400).json({ 
        message: "Cannot delete customer with existing invoices",
        invoiceCount 
      });
    }

    // Log customer deletion activity
    await Activity.logActivity({
      action: 'customer_deleted',
      description: `Deleted customer: ${customer.name}`,
      details: { 
        targetId: customer._id,
        customerId: customer.customerId,
        name: customer.name,
        email: customer.email,
        phone: customer.phone
      },
      user: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      targetId: customer._id,
      targetType: 'Customer',
      severity: 'high'
    });

    await Customer.findOneAndDelete(vendorFilter(req, { _id: id }));
    
    return res.json({
      message: "Customer deleted successfully",
      customer: {
        id: customer._id,
        customerId: customer.customerId,
        name: customer.name
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to delete customer" });
  }
});

// Migrate existing customers to add customerId (Super Admin only)
router.post("/migrate-ids", auth, resolveVendorContext, requireRole("super_admin"), async (req, res) => {
  try {
    // Find all customers without customerId
    const customersWithoutId = await Customer.find(
      vendorFilter(req, {
        $or: [
          { customerId: { $exists: false } },
          { customerId: { $in: [null, "", " "] } }
        ]
      })
    );

    if (customersWithoutId.length === 0) {
      return res.json({
        message: "All customers already have customer IDs",
        migrated: 0
      });
    }

    let migratedCount = 0;
    
    // Generate and assign customer IDs
    for (const customer of customersWithoutId) {
      const newCustomerId = await Customer.generateCustomerId(customer.vendorId);
      customer.customerId = newCustomerId;
      await customer.save();
      migratedCount++;
    }

    return res.json({
      message: `Successfully migrated ${migratedCount} customers`,
      migrated: migratedCount
    });
  } catch (err) {
    console.error("Migration error:", err);
    return res.status(500).json({ message: "Failed to migrate customers" });
  }
});

module.exports = router;

