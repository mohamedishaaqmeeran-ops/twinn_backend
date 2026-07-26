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
          "rumble",
          "kick",
          "twitter",
          "twitch",
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

      instagramLiveStatus: {
        type:
          String,

        enum: [
          "idle",
          "starting",
          "streaming",
          "complete",
          "failed",
        ],

        default:
          "idle",
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
         RUMBLE RTMP
      ===================================================== */

      rumbleRtmpUrl: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      rumbleStreamKey: {
        type:
          String,

        default:
          "",

        trim:
          true,

        select:
          false,
      },

      rumbleChannelUrl: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      rumbleLiveStatus: {
        type:
          String,

        enum: [
          "idle",
          "starting",
          "streaming",
          "complete",
          "failed",
        ],

        default:
          "idle",
      },

      /* =====================================================
         KICK RTMP
      ===================================================== */

      kickRtmpUrl: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      kickStreamKey: {
        type:
          String,

        default:
          "",

        trim:
          true,

        select:
          false,
      },

      kickChannelUrl: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      kickLiveStatus: {
        type:
          String,

        enum: [
          "idle",
          "starting",
          "streaming",
          "complete",
          "failed",
        ],

        default:
          "idle",
      },

      /* =====================================================
         TWITCH RTMP
      ===================================================== */

      twitchRtmpUrl: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      twitchStreamKey: {
        type:
          String,

        default:
          "",

        trim:
          true,

        select:
          false,
      },

      twitchChannelUrl: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      twitchLiveStatus: {
        type:
          String,

        enum: [
          "idle",
          "starting",
          "streaming",
          "complete",
          "failed",
        ],

        default:
          "idle",
      },

      /* =====================================================
         TWITTER / X RTMP
      ===================================================== */

      twitterRtmpUrl: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      twitterStreamKey: {
        type:
          String,

        default:
          "",

        trim:
          true,

        select:
          false,
      },

      twitterChannelUrl: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      twitterLiveStatus: {
        type:
          String,

        enum: [
          "idle",
          "starting",
          "streaming",
          "complete",
          "failed",
        ],

        default:
          "idle",
      },

      /* =====================================================
         LIVE TIMESTAMPS
      ===================================================== */

      lastLiveStartedAt: {
        type:
          Date,

        default:
          null,
      },

      lastLiveStoppedAt: {
        type:
          Date,

        default:
          null,
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
   UNIQUE USER + PLATFORM
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
   REMOVE PRIVATE FIELDS
========================================================= */

const removePrivateFields =
  (
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

    delete returnedObject
      .rumbleStreamKey;

    delete returnedObject
      .kickStreamKey;

    delete returnedObject
      .twitchStreamKey;

    delete returnedObject
      .twitterStreamKey;

    return returnedObject;
  };

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
        return removePrivateFields(
          returnedObject
        );
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
        return removePrivateFields(
          returnedObject
        );
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