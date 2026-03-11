const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
      default: null
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["super_admin", "admin", "manager", "staff"],
      default: "staff"
    },
    resetOtp: {
      type: String,
      default: null
    },
    resetOtpExpire: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

userSchema.index({ vendorId: 1, email: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("User", userSchema);

