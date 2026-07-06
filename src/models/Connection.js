const mongoose = require("mongoose");

const connectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    platform: {
      type: String,
      enum: ["facebook", "instagram", "youtube", "tiktok"],
      required: true,
    },

    platformUserId: String,
    name: String,
    username: String,
    avatarUrl: String,

    pageId: String,
    pageName: String,
    pageAccessToken: String,

    accessToken: String,
    refreshToken: String,

    connected: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

connectionSchema.index({ userId: 1, platform: 1 }, { unique: true });

module.exports = mongoose.model("Connection", connectionSchema);