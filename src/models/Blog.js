const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
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

    excerpt: {
      type: String,
      required: true,
    },

    content: {
      type: String,
      required: true,
    },

    coverImage: {
      type: String,
      default: "",
    },

    coverImagePublicId: {
      type: String,
      default: "",
    },

    category: {
      type: String,
      default: "General",
    },

    tags: [
      {
        type: String,
      },
    ],

    featured: {
      type: Boolean,
      default: false,
    },

    published: {
      type: Boolean,
      default: true,
    },

    readTime: {
      type: Number,
      default: 5,
    },

    views: {
      type: Number,
      default: 0,
    },

    seoTitle: String,

    seoDescription: String,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Blog",
  blogSchema
);