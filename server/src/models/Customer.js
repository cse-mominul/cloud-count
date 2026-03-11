const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    customerId: {
      type: String,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      trim: true
    },
    address: {
      type: String,
      trim: true
    },
    totalDue: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { timestamps: true }
);

// Pre-save hook to generate customerId if not present
customerSchema.pre('save', async function(next) {
  if (this.isNew && !this.customerId) {
    try {
      // Find the highest existing customerId number
      const lastCustomer = await this.constructor
        .findOne({ vendorId: this.vendorId, customerId: { $regex: /^SG-\d+$/ } })
        .sort({ createdAt: -1 });
      
      let nextNumber = 1001; // Start from SG-1001
      
      if (lastCustomer && lastCustomer.customerId) {
        const lastNumber = parseInt(lastCustomer.customerId.split('-')[1]);
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }
      
      this.customerId = `SG-${nextNumber}`;
    } catch (error) {
      // Fallback to timestamp-based ID if there's an error
      this.customerId = `SG-${Date.now()}`;
    }
  }
  next();
});

customerSchema.statics.generateCustomerId = async function(vendorId) {
  try {
    const lastCustomer = await this
      .findOne({ vendorId, customerId: { $regex: /^SG-\d+$/ } })
      .sort({ createdAt: -1 });

    let nextNumber = 1001;

    if (lastCustomer && lastCustomer.customerId) {
      const lastNumber = parseInt(lastCustomer.customerId.split('-')[1]);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    return `SG-${nextNumber}`;
  } catch (error) {
    return `SG-${Date.now()}`;
  }
};

customerSchema.index({ vendorId: 1, customerId: 1 }, { unique: true, sparse: true });
customerSchema.index({ vendorId: 1, email: 1 }, { sparse: true });
customerSchema.index({ vendorId: 1, phone: 1 }, { sparse: true });

module.exports = mongoose.model("Customer", customerSchema);

