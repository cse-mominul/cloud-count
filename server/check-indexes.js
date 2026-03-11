const mongoose = require('mongoose');

mongoose.connect('mongodb://admin:password123@localhost:27017/sohel_gadgets?authSource=admin')
  .then(async () => {
    console.log('Connected to MongoDB');
    const collections = await mongoose.connection.db.listCollections().toArray();
    for (const collection of collections) {
      const indexes = await mongoose.connection.db.collection(collection.name).listIndexes().toArray();
      console.log('Collection:', collection.name);
      indexes.forEach(idx => {
        console.log('  Index:', JSON.stringify(idx.key), 'Unique:', idx.unique || false, 'Name:', idx.name);
      });
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('Connection error:', err);
    process.exit(1);
  });
