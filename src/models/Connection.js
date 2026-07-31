const mongoose = require(
  "mongoose"
);

/* =========================================================
   SHARED LIVE STATUS VALUES
========================================================= */

const LIVE_STATUS_VALUES = [
  "idle",
  "starting",
  "created",
  "streaming",
  "ready",
  "live",
  "complete",
  "failed",
];

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
          "linkedin",
          "tiktok",
          "rumble",
          "kick",
          "twitter",
          "twitch",
          "loco",
          "nimo",
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

      connectionType: {
        type:
          String,

        enum: [
          "manual-rtmp",
          "oauth",
          "oauth-rtmp",
        ],

        default:
          "manual-rtmp",
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

      channelName: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      channelUrl: {
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
         GENERIC RTMP DETAILS
      ===================================================== */

      rtmpUrl: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      streamKey: {
        type:
          String,

        default:
          "",

        select:
          false,
      },

      rtmpConfigured: {
        type:
          Boolean,

        default:
          false,
      },

      liveStatus: {
        type:
          String,

        enum:
          LIVE_STATUS_VALUES,

        default:
          "idle",
      },

      /* =====================================================
         OPTIONAL OAUTH TOKENS
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

      facebookRtmpUrl: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      facebookStreamKey: {
        type:
          String,

        default:
          "",

        select:
          false,
      },

      facebookChannelUrl: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      facebookLiveStatus: {
        type:
          String,

        enum:
          LIVE_STATUS_VALUES,

        default:
          "idle",
      },

      locoRtmpUrl: {
  type: String,
  trim: true,
  default: "",
},

locoStreamKey: {
  type: String,
  select: false,
  default: "",
},

locoChannelUrl: {
  type: String,
  trim: true,
  default: "",
},

locoLiveStatus: {
  type: String,
  enum: LIVE_STATUS_VALUES,
  default: "idle",
},

      /* =====================================================
         NIMO TV
      ===================================================== */

      nimoRtmpUrl: {
        type: String,
        trim: true,
        default: "",
      },

      nimoStreamKey: {
        type: String,
        select: false,
        default: "",
      },

      nimoChannelUrl: {
        type: String,
        trim: true,
        default: "",
      },

      nimoLiveStatus: {
        type: String,
        enum: LIVE_STATUS_VALUES,
        default: "idle",
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

      instagramChannelUrl: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      instagramLiveStatus: {
        type:
          String,

        enum:
          LIVE_STATUS_VALUES,

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

      youtubeRtmpUrl: {
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

      youtubeChannelUrl: {
        type:
          String,

        default:
          "",

        trim:
          true,
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

        enum:
          LIVE_STATUS_VALUES,

        default:
          "idle",
      },

      /* =====================================================
         LINKEDIN
      ===================================================== */

      linkedinProfileId: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      linkedinRtmpUrl: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      linkedinStreamKey: {
        type:
          String,

        default:
          "",

        select:
          false,
      },

      linkedinChannelUrl: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      linkedinLiveStatus: {
        type:
          String,

        enum:
          LIVE_STATUS_VALUES,

        default:
          "idle",
      },

      /* =====================================================
         TIKTOK
      ===================================================== */

      tiktokRtmpUrl: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      tiktokStreamKey: {
        type:
          String,

        default:
          "",

        select:
          false,
      },

      tiktokChannelUrl: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      tiktokLiveStatus: {
        type:
          String,

        enum:
          LIVE_STATUS_VALUES,

        default:
          "idle",
      },

      /* =====================================================
         RUMBLE
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

        enum:
          LIVE_STATUS_VALUES,

        default:
          "idle",
      },

      /* =====================================================
         KICK
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

        enum:
          LIVE_STATUS_VALUES,

        default:
          "idle",
      },

      /* =====================================================
         TWITCH
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

        enum:
          LIVE_STATUS_VALUES,

        default:
          "idle",
      },

      /* =====================================================
         TWITTER / X
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

        enum:
          LIVE_STATUS_VALUES,

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
   SYNCHRONIZE GENERIC RTMP FIELDS
========================================================= */

connectionSchema.pre(
  "save",
  function syncGenericRtmpFields() {
    const platform =
      this.platform;

    const platformRtmpField =
      `${platform}RtmpUrl`;

    const platformStreamKeyField =
      `${platform}StreamKey`;

    const platformChannelUrlField =
      `${platform}ChannelUrl`;

    const platformLiveStatusField =
      `${platform}LiveStatus`;

    if (
      this[
        platformRtmpField
      ] &&
      !this.rtmpUrl
    ) {
      this.rtmpUrl =
        this[
          platformRtmpField
        ];
    }

    if (
      this[
        platformStreamKeyField
      ] &&
      !this.streamKey
    ) {
      this.streamKey =
        this[
          platformStreamKeyField
        ];
    }

    if (
      this[
        platformChannelUrlField
      ] &&
      !this.channelUrl
    ) {
      this.channelUrl =
        this[
          platformChannelUrlField
        ];
    }

    if (
      this[
        platformLiveStatusField
      ]
    ) {
      this.liveStatus =
        this[
          platformLiveStatusField
        ];
    }

    this.rtmpConfigured =
      Boolean(
        this.rtmpUrl &&
        this.streamKey
      );

  }
);

/* =========================================================
   REMOVE PRIVATE FIELDS
========================================================= */

const PRIVATE_FIELDS = [
  "accessToken",
  "refreshToken",
  "pageAccessToken",
  "streamKey",
  "instagramStreamKey",
  "facebookStreamKey",
  "youtubeStreamKey",
  "linkedinStreamKey",
  "tiktokStreamKey",
  "rumbleStreamKey",
  "kickStreamKey",
  "twitchStreamKey",
  "twitterStreamKey",
  "locoStreamKey",
  "nimoStreamKey",
];

const removePrivateFields =
  (
    returnedObject
  ) => {
    PRIVATE_FIELDS.forEach(
      (
        field
      ) => {
        delete returnedObject[
          field
        ];
      }
    );

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