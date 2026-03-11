const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true
    },
    businessEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true
    },
    phoneNumber: {
      type: String,
      trim: true
    },
    logo: {
      type: String,
      default: ""
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    },
    ownerUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vendor", vendorSchema);
