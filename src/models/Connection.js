const mongoose = require("mongoose");

const connectionSchema =
  new mongoose.Schema(
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      platform: {
        type: String,
        enum: [
          "instagram",
          "facebook",
          "youtube",
          "tiktok",
        ],
        required: true,
      },

      connected: {
        type: Boolean,
        default: true,
      },

      accessToken: {
        type: String,
        default: "",
        select: false,
      },

      refreshToken: {
        type: String,
        default: "",
        select: false,
      },

      tokenExpiryDate: {
        type: Date,
        default: null,
      },

      // Facebook
      pageId: {
        type: String,
        default: "",
      },

      pageName: {
        type: String,
        default: "",
      },

      pageAccessToken: {
        type: String,
        default: "",
        select: false,
      },

      // Instagram
      instagramAccountId: {
        type: String,
        default: "",
      },

      instagramUsername: {
        type: String,
        default: "",
      },

      instagramRtmpUrl: {
        type: String,
        default: "",
      },

      instagramStreamKey: {
        type: String,
        default: "",
        select: false,
      },

      // YouTube
      youtubeChannelId: {
        type: String,
        default: "",
      },

      youtubeChannelTitle: {
        type: String,
        default: "",
      },

      youtubeChannelThumbnail: {
        type: String,
        default: "",
      },

      youtubeBroadcastId: {
        type: String,
        default: "",
      },

      youtubeStreamId: {
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

      youtubeWatchUrl: {
        type: String,
        default: "",
      },

     youtubeChannelId: {
  type: String,
  default: "",
},

youtubeChannelTitle: {
  type: String,
  default: "",
},

youtubeChannelThumbnail: {
  type: String,
  default: "",
},

youtubeBroadcastId: {
  type: String,
  default: "",
},

youtubeStreamId: {
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

youtubeWatchUrl: {
  type: String,
  default: "",
},

youtubeLiveStatus: {
  type: String,
  enum: [
    "idle",
    "created",
    "streaming",
    "ready",
    "live",
    "complete",
    "failed",
  ],
  default: "idle",
},

tokenExpiryDate: {
  type: Date,
  default: null,
},

      platformUserId: {
        type: String,
        default: "",
      },

      platformUsername: {
        type: String,
        default: "",
      },

      metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
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