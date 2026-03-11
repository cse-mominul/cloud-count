const mongoose = require('mongoose');

const stockLogSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantityChange: {
    type: Number,
    required: true // Positive for addition, negative for removal
  },
  remainingQty: {
    type: Number,
    required: true
  },
  action: {
    type: String,
    enum: ['initial_stock', 'sale', 'purchase', 'adjustment', 'return'],
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userRole: {
    type: String,
    enum: ['super_admin', 'admin', 'manager', 'staff'],
    required: true
  },
  notes: {
    type: String,
    default: ''
  },
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
stockLogSchema.index({ product: 1, createdAt: -1 });
stockLogSchema.index({ user: 1, createdAt: -1 });

// Static method to log stock changes
stockLogSchema.statics.logStockChange = async function(data) {
  const log = new this(data);
  return await log.save();
};

// Static method to get product stock history
stockLogSchema.statics.getProductHistory = async function(productId, limit = 50) {
  return await this.find({ product: productId })
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model('StockLog', stockLogSchema);
