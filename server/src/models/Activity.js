const mongoose = require('mongoose');
const { sendEventNotification } = require('../utils/telegramNotifications');

const activitySchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: [
      'user_created',
      'user_updated',
      'user_deleted',
      'product_created',
      'product_updated',
      'product_deleted',
      'category_created',
      'category_updated',
      'category_deleted',
      'customer_created',
      'customer_updated',
      'customer_deleted',
      'invoice_created',
      'invoice_updated',
      'invoice_deleted',
      'expense_created',
      'expense_updated',
      'expense_deleted',
      'vendor_created',
      'vendor_updated',
      'vendor_deactivated',
      'payment_received',
      'settings_updated',
      'login',
      'logout',
      'activity_deleted'
    ]
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  details: {
    type: mongoose.Schema.Types.Mixed, // Store additional details as JSON
    default: {}
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
  ipAddress: {
    type: String,
    default: ''
  },
  userAgent: {
    type: String,
    default: ''
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null // ID of the affected document
  },
  targetType: {
    type: String,
    enum: ['User', 'Product', 'Category', 'Customer', 'Invoice', 'Expense', 'Vendor', 'Settings'],
    default: null
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  }
}, {
  timestamps: true
});

// Index for efficient queries
activitySchema.index({ createdAt: -1 });
activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ action: 1, createdAt: -1 });
activitySchema.index({ severity: 1, createdAt: -1 });

// Static methods
activitySchema.statics.logActivity = async function(data) {
  const log = new this(data);
  
  // Debug: Log all activity creations
  console.log('Creating activity log:', {
    action: data.action,
    description: data.description,
    userName: data.userName,
    targetType: data.targetType,
    severity: data.severity
  });
  
  // Send Telegram notification for specific events
  try {
    // Only send notifications for important events
    const notificationEvents = [
      'invoice_created',
      'product_deleted', 
      'expense_created',
      'login'
    ];
    
    if (notificationEvents.includes(data.action)) {
      let notificationData = {
        ...data.details,
        createdBy: data.user ? { name: data.userName } : null,
        deletedBy: data.user ? { name: data.userName } : null,
        addedBy: data.user ? { name: data.userName } : null
      };
      
      // Add user info for login events
      if (data.action === 'login') {
        notificationData = {
          name: data.userName,
          email: data.details?.email || '',
          role: data.userRole
        };
      }
      
      // Send notification asynchronously (don't wait for it)
      sendEventNotification(data.action, notificationData).catch(err => {
        console.log('Telegram notification failed:', err.message);
      });
    }
  } catch (error) {
    console.log('Error sending Telegram notification:', error.message);
  }
  
  return await log.save();
};

activitySchema.statics.getRecentActivities = async function(limit = 10, userFilter = null) {
  const query = userFilter ? { user: userFilter } : {};
  return await this.find(query)
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit);
};

activitySchema.statics.getActivitiesByAction = async function(action, limit = 50) {
  return await this.find({ action })
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit);
};

activitySchema.statics.getActivityStats = async function(startDate, endDate) {
  const match = {};
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = startDate;
    if (endDate) match.createdAt.$lte = endDate;
  }
  
  return await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$action',
        count: { $sum: 1 },
        users: { $addToSet: '$userName' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

// Method to get formatted activity description
activitySchema.methods.getFormattedDescription = function() {
  const details = this.details || {};
  const actionDescriptions = {
    'user_created': `Created new user: ${details.name || 'Unknown'}`,
    'user_updated': `Updated user: ${details.name || 'Unknown'}`,
    'user_deleted': `Deleted user: ${details.name || 'Unknown'}`,
    'product_created': `Added new product: ${details.name || 'Unknown'}`,
    'product_updated': `Updated product: ${details.name || 'Unknown'}`,
    'product_deleted': `Deleted product: ${details.name || 'Unknown'}`,
    'category_created': `Created new category: ${details.name || 'Unknown'}`,
    'category_updated': `Updated category: ${details.name || 'Unknown'}`,
    'category_deleted': `Deleted category: ${details.name || 'Unknown'}`,
    'customer_created': `Added new customer: ${details.name || 'Unknown'}`,
    'customer_updated': `Updated customer: ${details.name || 'Unknown'}`,
    'customer_deleted': `Deleted customer: ${details.name || 'Unknown'}`,
    'invoice_created': `Created new invoice #${details.invoiceId ? details.invoiceId.toString().slice(-6) : 'Unknown'} for ${details.customerName || 'Unknown'}`,
    'invoice_updated': `Updated invoice #${details.invoiceId ? details.invoiceId.toString().slice(-6) : 'Unknown'}`,
    'invoice_deleted': `Deleted invoice #${details.invoiceId ? details.invoiceId.toString().slice(-6) : 'Unknown'}`,
    'expense_created': `Added new expense of ৳${details.amount || 0} for ${details.category || 'Unknown'}`,
    'expense_updated': `Updated expense: ${details.reason || 'Unknown'}`,
    'expense_deleted': `Deleted expense: ${details.reason || 'Unknown'}`,
    'vendor_created': `Created vendor: ${details.companyName || 'Unknown'}`,
    'vendor_updated': `Updated vendor: ${details.companyName || 'Unknown'}`,
    'vendor_deactivated': `Deactivated vendor: ${details.companyName || 'Unknown'}`,
    'payment_received': `Received payment of ৳${details.amount || 0} from ${details.customerName || 'Unknown'}`,
    'settings_updated': 'Updated system settings',
    'login': `User ${this.userName} logged in`,
    'logout': `User ${this.userName} logged out`
  };
  
  return actionDescriptions[this.action] || this.description;
};

module.exports = mongoose.model('Activity', activitySchema);
