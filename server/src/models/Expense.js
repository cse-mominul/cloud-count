const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  reason: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    required: true,
    enum: [
      'utilities',
      'rent',
      'salaries',
      'maintenance',
      'supplies',
      'marketing',
      'transportation',
      'equipment',
      'other'
    ]
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  description: {
    type: String,
    maxlength: 500,
    default: ''
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
  receipt: {
    type: String, // URL to receipt image or document
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1, date: -1 });
expenseSchema.index({ user: 1, date: -1 });

// Static methods
expenseSchema.statics.getTotalExpenses = async function(startDate, endDate) {
  const match = {};
  if (startDate || endDate) {
    match.date = {};
    if (startDate) match.date.$gte = startDate;
    if (endDate) match.date.$lte = endDate;
  }
  
  const result = await this.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  
  return result.length > 0 ? result[0].total : 0;
};

expenseSchema.statics.getExpensesByCategory = async function(startDate, endDate) {
  const match = {};
  if (startDate || endDate) {
    match.date = {};
    if (startDate) match.date.$gte = startDate;
    if (endDate) match.date.$lte = endDate;
  }
  
  return await this.aggregate([
    { $match: match },
    { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } }
  ]);
};

expenseSchema.statics.getRecentExpenses = async function(limit = 10) {
  return await this.find()
    .populate('user', 'name email')
    .sort({ date: -1 })
    .limit(limit);
};

module.exports = mongoose.model('Expense', expenseSchema);
