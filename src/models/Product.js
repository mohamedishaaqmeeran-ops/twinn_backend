const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    category: {
      type: String,
      default: "General",
    },

    brand: {
      type: String,
      default: "",
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    salePrice: {
      type: Number,
      default: 0,
    },

    stock: {
      type: Number,
      default: 0,
      min: 0,
    },

    images: [
      {
        type: String,
      },
    ],

    tags: [
      {
        type: String,
      },
    ],

    status: {
      type: String,
      enum: ["draft", "active", "inactive"],
      default: "active",
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    // AI Twin
    script: {
      type: String,
      default: "",
    },

    offer: {
      type: String,
      default: "",
    },

    objectionHandling: {
      type: String,
      default: "",
    },

    // Analytics
    sales: {
      type: Number,
      default: 0,
    },

    views: {
      type: Number,
      default: 0,
    },

    rating: {
      type: Number,
      default: 0,
    },

    totalReviews: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Product", productSchema);