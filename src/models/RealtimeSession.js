const mongoose = require("mongoose");

const realtimeSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    twinId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Twin",
      required: true,
      index: true,
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      index: true,
    },

    language: {
      type: String,
      default: "English",
    },

    mode: {
      type: String,
      enum: ["test", "live"],
      default: "test",
    },

    status: {
      type: String,
      enum: ["creating", "active", "closed", "failed"],
      default: "creating",
    },

    socketToken: {
      type: String,
      required: true,
      unique: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: {
        expires: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "RealtimeSession",
  realtimeSessionSchema
);