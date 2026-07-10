const mongoose = require("mongoose");

const marketplaceAvatarSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    image: {
      type: String,
      required: true,
    },

    previewVideo: {
      type: String,
      default: "",
    },

    description: {
      type: String,
      required: true,
    },

    category: {
      type: String,
      enum: [
        "Business",
        "Fashion",
        "Fitness",
        "Technology",
        "Education",
        "Lifestyle",
        "Gaming",
        "Luxury",
      ],
      required: true,
    },

    credits: {
      type: Number,
      required: true,
      min: 0,
    },

    voice: {
      type: String,
      default: "Professional",
    },

    featured: {
      type: Boolean,
      default: false,
    },

    premium: {
      type: Boolean,
      default: false,
    },

    active: {
      type: Boolean,
      default: true,
    },

    licenseType: {
      type: String,
      enum: ["original", "licensed"],
      default: "original",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "MarketplaceAvatar",
  marketplaceAvatarSchema
);