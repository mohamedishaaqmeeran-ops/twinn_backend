const mongoose = require(
  "mongoose"
);

/* =========================================================
   CONNECTION SCHEMA
========================================================= */

const connectionSchema =
  new mongoose.Schema(
    {
      /* =====================================================
         OWNER
      ===================================================== */

      userId: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref:
          "User",

        required:
          true,

        index:
          true,
      },

      /* =====================================================
         PLATFORM
      ===================================================== */

      platform: {
        type:
          String,

        enum: [
          "instagram",
          "facebook",
          "youtube",
          "tiktok",
        ],

        required:
          true,

        lowercase:
          true,

        trim:
          true,
      },

      connected: {
        type:
          Boolean,

        default:
          true,
      },

      /* =====================================================
         COMMON ACCOUNT DETAILS
      ===================================================== */

      platformUserId: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      platformUsername: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      username: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      name: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      avatarUrl: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      profilePictureUrl: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      /* =====================================================
         OAUTH TOKENS
      ===================================================== */

      accessToken: {
        type:
          String,

        default:
          "",

        select:
          false,
      },

      refreshToken: {
        type:
          String,

        default:
          "",

        select:
          false,
      },

      tokenExpiryDate: {
        type:
          Date,

        default:
          null,
      },

      /* =====================================================
         FACEBOOK
      ===================================================== */

      pageId: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      pageName: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      pageAccessToken: {
        type:
          String,

        default:
          "",

        select:
          false,
      },

      /* =====================================================
         INSTAGRAM
      ===================================================== */

      instagramAccountId: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      instagramUsername: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      instagramRtmpUrl: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      instagramStreamKey: {
        type:
          String,

        default:
          "",

        select:
          false,
      },

      /* =====================================================
         YOUTUBE CHANNEL
      ===================================================== */

      youtubeChannelId: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      youtubeChannelTitle: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      youtubeChannelThumbnail: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      /* =====================================================
         YOUTUBE LIVE
      ===================================================== */

      youtubeBroadcastId: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      youtubeStreamId: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      youtubeStreamUrl: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      youtubeStreamKey: {
        type:
          String,

        default:
          "",

        select:
          false,
      },

      youtubeWatchUrl: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      youtubeLiveStatus: {
        type:
          String,

        enum: [
          "idle",
          "created",
          "streaming",
          "ready",
          "live",
          "complete",
          "failed",
        ],

        default:
          "idle",
      },

      /* =====================================================
         ADDITIONAL PLATFORM DATA
      ===================================================== */

      metadata: {
        type:
          mongoose.Schema.Types
            .Mixed,

        default:
          {},
      },
    },
    {
      timestamps:
        true,

      minimize:
        false,

      versionKey:
        "__v",
    }
  );

/* =========================================================
   INDEXES
========================================================= */

connectionSchema.index(
  {
    userId:
      1,

    platform:
      1,
  },
  {
    unique:
      true,
  }
);

/* =========================================================
   SAFE JSON OUTPUT
========================================================= */

connectionSchema.set(
  "toJSON",
  {
    transform:
      (
        document,
        returnedObject
      ) => {
        delete returnedObject
          .accessToken;

        delete returnedObject
          .refreshToken;

        delete returnedObject
          .pageAccessToken;

        delete returnedObject
          .instagramStreamKey;

        delete returnedObject
          .youtubeStreamKey;

        return returnedObject;
      },
  }
);

connectionSchema.set(
  "toObject",
  {
    transform:
      (
        document,
        returnedObject
      ) => {
        delete returnedObject
          .accessToken;

        delete returnedObject
          .refreshToken;

        delete returnedObject
          .pageAccessToken;

        delete returnedObject
          .instagramStreamKey;

        delete returnedObject
          .youtubeStreamKey;

        return returnedObject;
      },
  }
);

/* =========================================================
   MODEL
========================================================= */

module.exports =
  mongoose.models.Connection ||
  mongoose.model(
    "Connection",
    connectionSchema
  );