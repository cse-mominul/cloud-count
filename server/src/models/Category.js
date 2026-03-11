const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

categorySchema.index({ vendorId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Category", categorySchema);

