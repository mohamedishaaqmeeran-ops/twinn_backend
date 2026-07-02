const mongoose = require("mongoose");

const connectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    platform: {
      type: String,
      enum: ["facebook", "instagram", "youtube", "tiktok"],
      required: true
    },

    platformUserId: {
      type: String
    },

    name: {
      type: String
    },

    accessToken: {
      type: String
    },

    refreshToken: {
      type: String
    },

    connected: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Connection", connectionSchema);