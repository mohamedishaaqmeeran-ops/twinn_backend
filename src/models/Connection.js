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
      enum: [
        "facebook",
        "instagram",
        "youtube",
        "tiktok",
      ],
      required: true,
    },

    platformUserId: String,
    username: String,
    name: String,
    avatarUrl: String,

    pageId: String,
    pageName: String,
    pageAccessToken: String,

    accessToken: String,
    refreshToken: String,

    instagramRtmpUrl: {
      type: String,
      default: "",
    },

    instagramStreamKey: {
      type: String,
      default: "",
      select: false,
    },

    facebookLiveVideoId: {
      type: String,
      default: "",
    },

    youtubeStreamUrl: {
      type: String,
      default: "",
    },

    youtubeStreamKey: {
      type: String,
      default: "",
      select: false,
    },

    connected: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

connectionSchema.index(
  {
    userId: 1,
    platform: 1,
  },
  {
    unique: true,
  }
);

module.exports = mongoose.model(
  "Connection",
  connectionSchema
);