const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("./src/models/User");
const Settings = require("./src/models/Settings");

const seedSuperAdmin = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/sohel-gadgets");
    console.log("Connected to MongoDB");

    const adminEmail = "admin@sohelgadgets.com";
    const defaultPassword = "admin123";
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Check if Super Admin already exists
    const existingUser = await User.findOne({ email: adminEmail });

    if (existingUser) {
      console.log(`User with email ${adminEmail} already exists. Updating to Super Admin...`);
      
      // Update existing user to Super Admin if not already
      if (existingUser.role !== "super_admin") {
        existingUser.role = "super_admin";
        existingUser.passwordHash = hashedPassword;
        existingUser.name = "Super Admin";
        
        await existingUser.save();
        console.log("✅ Existing user upgraded to Super Admin!");
      } else {
        console.log("✅ Super Admin already exists with correct role!");
      }
    } else {
      // Create new super admin
      const superAdmin = new User({
        name: "Super Admin",
        email: adminEmail,
        passwordHash: hashedPassword,
        role: "super_admin"
      });
      
      await superAdmin.save();
      console.log("✅ New Super Admin Created!");
    }

    console.log(`\n🔐 Default Credentials:`);
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${defaultPassword}`);
    console.log(`\n⚠️  Please change the password after first login!\n`);

    // Initialize/Update default settings with new fields
    const existingSettings = await Settings.findOne();
    const defaultSettings = {
      companyName: "Sohel Gadgets",
      siteTitle: "Sohel Gadgets - Inventory Management",
      siteIcon: "📱",
      companyLogo: "",
      theme: "dark",
      primaryColor: "#10b981",
      secondaryColor: "#64748b",
      currency: "৳",
      timezone: "Asia/Dhaka",
      dateFormat: "dd/MM/yyyy",
      lowStockThreshold: 5,
      enableNotifications: true,
      backupFrequency: "weekly",
      // New company fields
      companyAddress: "123 Main Street, Dhaka, Bangladesh",
      companyPhone: "+880 1234-567890",
      companyEmail: "contact@sohelgadgets.com",
      invoiceTerms: "1. Payment is due within 30 days of invoice date.\n2. Late payments are subject to a 1.5% monthly interest charge.\n3. All goods are non-returnable after 7 days.\n4. Prices are subject to change without notice.\n5. Goods remain our property until full payment is received."
    };

    if (!existingSettings) {
      await Settings.create(defaultSettings);
      console.log("✅ Default Settings Created!");
    } else {
      // Update existing settings with any missing new fields
      let updated = false;
      for (const [key, value] of Object.entries(defaultSettings)) {
        if (existingSettings[key] === undefined || existingSettings[key] === null) {
          existingSettings[key] = value;
          updated = true;
        }
      }
      
      if (updated) {
        await existingSettings.save();
        console.log("✅ Settings updated with new fields!");
      } else {
        console.log("✅ Default settings already exist and are up to date!");
      }
    }

    console.log("\n🎉 Seeding completed successfully!");
    console.log("🚀 You can now start the application!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
};

// Run the seed function
seedSuperAdmin();