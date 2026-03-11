const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    sku: {
      type: String,
      trim: true,
      sparse: true
    },
    category: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    costPrice: {
      type: Number,
      required: true,
      min: 0
    },
    salePrice: {
      type: Number,
      required: true,
      min: 0
    },
    stock: {
      type: Number,
      required: true,
      min: 0
    },
    serialNumbers: {
      type: [String],
      default: []
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lowStockThreshold: {
      type: Number,
      default: 5
    },
    hiddenAlert: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

productSchema.index({ vendorId: 1, sku: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Product", productSchema);

