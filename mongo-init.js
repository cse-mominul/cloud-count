// MongoDB initialization script for Sohel Gadgets
db = db.getSiblingDB('sohel_gadgets');

// Create collections with indexes
db.createCollection('users');
db.users.createIndex({ email: 1 }, { unique: true });

db.createCollection('products');
db.products.createIndex({ name: 1 });
db.products.createIndex({ sku: 1 });
db.products.createIndex({ category: 1 });
db.products.createIndex({ stock: 1 });

db.createCollection('customers');
db.customers.createIndex({ name: 1 });
db.customers.createIndex({ email: 1 });
db.customers.createIndex({ phone: 1 });

db.createCollection('invoices');
db.invoices.createIndex({ customer: 1 });
db.invoices.createIndex({ createdAt: -1 });
db.invoices.createIndex({ status: 1 });

db.createCollection('expenses');
db.expenses.createIndex({ date: -1 });
db.expenses.createIndex({ category: 1 });
db.expenses.createIndex({ user: 1 });

db.createCollection('categories');
db.categories.createIndex({ name: 1 }, { unique: true });

db.createCollection('settings');

db.createCollection('activities');
db.activities.createIndex({ createdAt: -1 });
db.activities.createIndex({ user: 1 });
db.activities.createIndex({ action: 1 });

print('Database initialized successfully');
