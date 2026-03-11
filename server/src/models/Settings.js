const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      default: "Sohel Gadgets",
      trim: true
    },
    siteTitle: {
      type: String,
      default: "Sohel Gadgets - Inventory Management",
      trim: true
    },
    siteIcon: {
      type: String,
      default: "📱",
      trim: true
    },
    companyLogo: {
      type: String,
      default: "",
      trim: true
    },
    theme: {
      type: String,
      enum: ["light", "dark"],
      default: "dark"
    },
    primaryColor: {
      type: String,
      default: "#10b981",
      trim: true
    },
    secondaryColor: {
      type: String,
      default: "#64748b",
      trim: true
    },
    currency: {
      type: String,
      default: "৳",
      trim: true
    },
    timezone: {
      type: String,
      default: "Asia/Dhaka",
      trim: true
    },
    dateFormat: {
      type: String,
      default: "dd/MM/yyyy",
      trim: true
    },
    lowStockThreshold: {
      type: Number,
      default: 5
    },
    enableNotifications: {
      type: Boolean,
      default: true
    },
    backupFrequency: {
      type: String,
      enum: ["daily", "weekly", "monthly"],
      default: "weekly"
    },
    // New fields for invoice
    companyAddress: {
      type: String,
      default: "123 Main Street, Dhaka, Bangladesh",
      trim: true
    },
    companyPhone: {
      type: String,
      default: "+880 1234-567890",
      trim: true
    },
    companyEmail: {
      type: String,
      default: "contact@sohelgadgets.com",
      trim: true
    },
    invoiceTerms: {
      type: String,
      default: "1. Payment is due within 30 days of invoice date.\n2. Late payments are subject to a 1.5% monthly interest charge.\n3. All goods are non-returnable after 7 days.\n4. Prices are subject to change without notice.\n5. Goods remain our property until full payment is received.",
      trim: true
    },
    loginPageTitle: {
      type: String,
      default: "Staff & Admin Login",
      trim: true
    },
    showForgotPassword: {
      type: Boolean,
      default: true
    },
    telegramBotToken: {
      type: String,
      default: "",
      trim: true
    },
    telegramChatId: {
      type: String,
      default: "",
      trim: true
    },
    isTelegramEnabled: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// There should only be one settings document in the database
settingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

settingsSchema.statics.updateSettings = async function(updateData) {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create(updateData);
  } else {
    settings = await this.findOneAndUpdate({}, updateData, { new: true, upsert: true });
  }
  return settings;
};

module.exports = mongoose.model("Settings", settingsSchema);
