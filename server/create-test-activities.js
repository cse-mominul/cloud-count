const mongoose = require('mongoose');
const Activity = require('./src/models/Activity');

// Connect to MongoDB
mongoose.connect('mongodb://admin:password123@localhost:27017/sohel_gadgets?authSource=admin', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Create test activities
const createTestActivities = async () => {
  try {
    // Clear existing activities
    await Activity.deleteMany({});
    console.log('Cleared existing activities');

    // Create test activities
    const testActivities = [
      {
        action: 'user_created',
        description: 'New user account created',
        details: { userName: 'John Doe', email: 'john@example.com' },
        user: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        userName: 'Admin User',
        userRole: 'admin',
        severity: 'low'
      },
      {
        action: 'product_created',
        description: 'New product added to inventory',
        details: { productName: 'Laptop', sku: 'LAP001', price: 999.99 },
        user: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        userName: 'Admin User',
        userRole: 'admin',
        severity: 'medium'
      },
      {
        action: 'invoice_created',
        description: 'New invoice generated',
        details: { invoiceNumber: 'INV-001', amount: 1500.00, customerName: 'ABC Corp' },
        user: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        userName: 'Admin User',
        userRole: 'admin',
        severity: 'high'
      },
      {
        action: 'login',
        description: 'User logged into the system',
        details: { loginTime: new Date() },
        user: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        userName: 'Admin User',
        userRole: 'admin',
        severity: 'low'
      },
      {
        action: 'settings_updated',
        description: 'System settings were updated',
        details: { setting: 'Tax Rate', oldValue: '10%', newValue: '12%' },
        user: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        userName: 'Admin User',
        userRole: 'admin',
        severity: 'critical'
      },
      {
        action: 'product_deleted',
        description: 'Product removed from inventory',
        details: { productName: 'Old Phone', sku: 'OLD001' },
        user: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        userName: 'Admin User',
        userRole: 'admin',
        severity: 'high'
      },
      {
        action: 'expense_created',
        description: 'New expense recorded',
        details: { amount: 250.00, category: 'Office Supplies', reason: 'Stationery purchase' },
        user: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        userName: 'Admin User',
        userRole: 'admin',
        severity: 'medium'
      },
      {
        action: 'customer_created',
        description: 'New customer registered',
        details: { customerName: 'XYZ Company', email: 'contact@xyz.com' },
        user: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        userName: 'Admin User',
        userRole: 'admin',
        severity: 'low'
      },
      {
        action: 'payment_received',
        description: 'Payment received for invoice',
        details: { invoiceNumber: 'INV-001', amount: 1500.00, paymentMethod: 'Bank Transfer' },
        user: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        userName: 'Admin User',
        userRole: 'admin',
        severity: 'medium'
      },
      {
        action: 'user_deleted',
        description: 'User account deleted',
        details: { userName: 'Test User', email: 'test@example.com' },
        user: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        userName: 'Admin User',
        userRole: 'admin',
        severity: 'high'
      }
    ];

    // Insert activities with different timestamps
    for (let i = 0; i < testActivities.length; i++) {
      const activity = testActivities[i];
      // Set different dates for testing pagination
      activity.createdAt = new Date(Date.now() - (i * 24 * 60 * 60 * 1000)); // Each activity is i days old
      await Activity.create(activity);
    }

    console.log('Created 10 test activities');
    
    // Verify count
    const count = await Activity.countDocuments();
    console.log(`Total activities in database: ${count}`);

    // Show first few activities
    const activities = await Activity.find().sort({ createdAt: -1 }).limit(3);
    console.log('Latest activities:', activities.map(a => ({ action: a.action, description: a.description, createdAt: a.createdAt })));

  } catch (error) {
    console.error('Error creating test activities:', error);
  } finally {
    await mongoose.disconnect();
  }
};

createTestActivities();
