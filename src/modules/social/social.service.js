// modules/social/social.service.js

const Connection = require(
  "../../models/Connection"
);

/* =========================================================
   SUPPORTED MANUAL RTMP PLATFORMS
========================================================= */

const MANUAL_RTMP_PLATFORMS = [
  "instagram",
  "facebook",
  "youtube",
  "linkedin",
  "rumble",
  "kick",
  "twitch",
  "twitter",
];

/*
 * TikTok can be added here later when the user
 * has access to a TikTok RTMP URL and stream key.
 */
const SUPPORTED_PLATFORMS = [
  ...MANUAL_RTMP_PLATFORMS,
  "tiktok",
];

/* =========================================================
   PLATFORM CONFIGURATION
========================================================= */

const PLATFORM_CONFIG = {
  instagram: {
    name:
      "Instagram",

    dashboardUrl:
      "https://www.instagram.com/",

    rtmpUrlField:
      "instagramRtmpUrl",

    streamKeyField:
      "instagramStreamKey",

    channelUrlField:
      "instagramChannelUrl",

    liveStatusField:
      "instagramLiveStatus",
  },

  facebook: {
    name:
      "Facebook",

    dashboardUrl:
      "https://www.facebook.com/live/producer",

    rtmpUrlField:
      "facebookRtmpUrl",

    streamKeyField:
      "facebookStreamKey",

    channelUrlField:
      "facebookChannelUrl",

    liveStatusField:
      "facebookLiveStatus",
  },

  youtube: {
    name:
      "YouTube",

    dashboardUrl:
      "https://studio.youtube.com/",

    rtmpUrlField:
      "youtubeRtmpUrl",

    streamKeyField:
      "youtubeStreamKey",

    channelUrlField:
      "youtubeChannelUrl",

    liveStatusField:
      "youtubeLiveStatus",
  },

  linkedin: {
    name:
      "LinkedIn",

    dashboardUrl:
      "https://www.linkedin.com/video/golive/manage/",

    rtmpUrlField:
      "linkedinRtmpUrl",

    streamKeyField:
      "linkedinStreamKey",

    channelUrlField:
      "linkedinChannelUrl",

    liveStatusField:
      "linkedinLiveStatus",
  },

  rumble: {
    name:
      "Rumble",

    dashboardUrl:
      "https://rumble.com/account/livestreams",

    rtmpUrlField:
      "rumbleRtmpUrl",

    streamKeyField:
      "rumbleStreamKey",

    channelUrlField:
      "rumbleChannelUrl",

    liveStatusField:
      "rumbleLiveStatus",
  },

  kick: {
    name:
      "Kick",

    dashboardUrl:
      "https://kick.com/dashboard/settings/stream",

    rtmpUrlField:
      "kickRtmpUrl",

    streamKeyField:
      "kickStreamKey",

    channelUrlField:
      "kickChannelUrl",

    liveStatusField:
      "kickLiveStatus",
  },

  twitch: {
    name:
      "Twitch",

    dashboardUrl:
      "https://dashboard.twitch.tv/settings/stream",

    rtmpUrlField:
      "twitchRtmpUrl",

    streamKeyField:
      "twitchStreamKey",

    channelUrlField:
      "twitchChannelUrl",

    liveStatusField:
      "twitchLiveStatus",
  },

  twitter: {
    name:
      "Twitter / X",

    dashboardUrl:
      "https://studio.x.com",

    rtmpUrlField:
      "twitterRtmpUrl",

    streamKeyField:
      "twitterStreamKey",

    channelUrlField:
      "twitterChannelUrl",

    liveStatusField:
      "twitterLiveStatus",
  },

  tiktok: {
    name:
      "TikTok",

    dashboardUrl:
      "https://www.tiktok.com/studio/download",

    rtmpUrlField:
      "tiktokRtmpUrl",

    streamKeyField:
      "tiktokStreamKey",

    channelUrlField:
      "tiktokChannelUrl",

    liveStatusField:
      "tiktokLiveStatus",
  },
};

/* =========================================================
   NORMALIZE PLATFORM
========================================================= */

const normalizePlatform = (
  platform
) => {
  const value =
    String(
      platform || ""
    )
      .trim()
      .toLowerCase();

  if (
    value === "x"
  ) {
    return "twitter";
  }

  if (
    value === "twitter/x" ||
    value === "x/twitter"
  ) {
    return "twitter";
  }

  return value;
};

/* =========================================================
   VALIDATE PLATFORM
========================================================= */

const validatePlatform = (
  platform,
  {
    allowTikTok =
      true,
  } = {}
) => {
  const normalizedPlatform =
    normalizePlatform(
      platform
    );

  const supportedPlatforms =
    allowTikTok
      ? SUPPORTED_PLATFORMS
      : MANUAL_RTMP_PLATFORMS;

  if (
    !supportedPlatforms.includes(
      normalizedPlatform
    )
  ) {
    throw new Error(
      `Unsupported platform: ${
        normalizedPlatform ||
        "unknown"
      }.`
    );
  }

  return normalizedPlatform;
};

/* =========================================================
   ENSURE VALUE
========================================================= */

const ensureValue = (
  value,
  message
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    throw new Error(
      message
    );
  }

  return value;
};

/* =========================================================
   VALIDATE RTMP URL
========================================================= */

const isValidRtmpUrl = (
  value
) => {
  const normalizedValue =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();

  return (
    normalizedValue.startsWith(
      "rtmp://"
    ) ||
    normalizedValue.startsWith(
      "rtmps://"
    )
  );
};

/* =========================================================
   VALIDATE HTTP URL
========================================================= */

const isValidHttpUrl = (
  value
) => {
  if (!value) {
    return true;
  }

  const normalizedValue =
    String(
      value
    )
      .trim()
      .toLowerCase();

  return (
    normalizedValue.startsWith(
      "http://"
    ) ||
    normalizedValue.startsWith(
      "https://"
    )
  );
};

/* =========================================================
   NORMALIZE RTMP URL
========================================================= */

const normalizeRtmpUrl = (
  value
) => {
  return String(
    value || ""
  )
    .trim()
    .replace(
      /\/+$/,
      ""
    );
};

/* =========================================================
   NORMALIZE STREAM KEY
========================================================= */

const normalizeStreamKey = (
  value
) => {
  return String(
    value || ""
  )
    .trim()
    .replace(
      /^\/+/,
      ""
    );
};

/* =========================================================
   GET PLATFORM CONFIGURATION
========================================================= */

const getPlatformConfig = (
  platform
) => {
  const normalizedPlatform =
    validatePlatform(
      platform
    );

  const config =
    PLATFORM_CONFIG[
      normalizedPlatform
    ];

  if (!config) {
    throw new Error(
      `Configuration is missing for ${normalizedPlatform}.`
    );
  }

  return {
    platform:
      normalizedPlatform,

    ...config,
  };
};

/* =========================================================
   BUILD COMPLETE RTMP DESTINATION
========================================================= */

const buildRtmpDestination = ({
  rtmpUrl,
  streamKey,
}) => {
  const normalizedRtmpUrl =
    normalizeRtmpUrl(
      rtmpUrl
    );

  const normalizedStreamKey =
    normalizeStreamKey(
      streamKey
    );

  ensureValue(
    normalizedRtmpUrl,
    "RTMP URL is required."
  );

  ensureValue(
    normalizedStreamKey,
    "Stream key is required."
  );

  if (
    !isValidRtmpUrl(
      normalizedRtmpUrl
    )
  ) {
    throw new Error(
      "RTMP URL must start with rtmp:// or rtmps://."
    );
  }

  return (
    `${normalizedRtmpUrl}/` +
    `${normalizedStreamKey}`
  );
};

/* =========================================================
   BUILD SAFE CONNECTION OBJECT
========================================================= */

const buildSafeConnection = (
  connection
) => {
  if (!connection) {
    return null;
  }

  const rawConnection =
    typeof connection.toObject ===
    "function"
      ? connection.toObject()
      : {
          ...connection,
        };

  const platform =
    normalizePlatform(
      rawConnection.platform
    );

  const config =
    PLATFORM_CONFIG[
      platform
    ];

  const platformRtmpUrl =
    config
      ? rawConnection[
          config.rtmpUrlField
        ] ||
        rawConnection.rtmpUrl ||
        ""
      : rawConnection.rtmpUrl ||
        "";

  const platformChannelUrl =
    config
      ? rawConnection[
          config.channelUrlField
        ] ||
        rawConnection.channelUrl ||
        ""
      : rawConnection.channelUrl ||
        "";

  const platformLiveStatus =
    config
      ? rawConnection[
          config.liveStatusField
        ] ||
        rawConnection.liveStatus ||
        "idle"
      : rawConnection.liveStatus ||
        "idle";

  const privateFields = [
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
  ];

  privateFields.forEach(
    (
      field
    ) => {
      delete rawConnection[
        field
      ];
    }
  );

  return {
    ...rawConnection,

    platform,

    platformName:
      config?.name ||
      platform,

    connected:
      Boolean(
        rawConnection.connected
      ),

    connectionType:
      rawConnection.connectionType ||
      rawConnection.metadata
        ?.connectionType ||
      "manual-rtmp",

    username:
      rawConnection.username ||
      rawConnection.platformUsername ||
      "",

    channelName:
      rawConnection.channelName ||
      rawConnection.name ||
      config?.name ||
      platform,

    channelUrl:
      platformChannelUrl,

    avatarUrl:
      rawConnection.avatarUrl ||
      rawConnection.profilePictureUrl ||
      "",

    profilePictureUrl:
      rawConnection.profilePictureUrl ||
      rawConnection.avatarUrl ||
      "",

    rtmpConfigured:
      Boolean(
        platformRtmpUrl
      ),

    liveStatus:
      platformLiveStatus,

    dashboardUrl:
      config?.dashboardUrl ||
      "",
  };
};

/* =========================================================
   GET PLATFORM DASHBOARD
========================================================= */

exports.getPlatformDashboard = (
  platform
) => {
  const config =
    getPlatformConfig(
      platform
    );

  return {
    platform:
      config.platform,

    name:
      config.name,

    dashboardUrl:
      config.dashboardUrl,
  };
};

/* =========================================================
   LEGACY OAUTH METHOD
========================================================= */

/*
 * OAuth has been disabled for all platforms.
 * Keep this method temporarily so old controllers do not
 * crash if they still call socialService.getOAuthURL().
 */
exports.getOAuthURL = (
  platform
) => {
  const config =
    getPlatformConfig(
      platform
    );

  throw new Error(
    `${config.name} OAuth is disabled. Configure the platform using its RTMP URL and stream key.`
  );
};

/* =========================================================
   LEGACY OAUTH CALLBACK
========================================================= */

exports.handleCallback =
  async (
    platform
  ) => {
    const config =
      getPlatformConfig(
        platform
      );

    throw new Error(
      `${config.name} OAuth callback is disabled. Use manual RTMP configuration.`
    );
  };

/* =========================================================
   SAVE MANUAL RTMP CONNECTION
========================================================= */

exports.saveManualRtmpConnection =
  async ({
    userId,
    platform,
    rtmpUrl,
    streamKey,
    username =
      "",
    channelName =
      "",
    channelUrl =
      "",
    avatarUrl =
      "",
    profilePictureUrl =
      "",
    platformUserId =
      "",
    metadata =
      {},
  }) => {
    ensureValue(
      userId,
      "User ID is required."
    );

    const config =
      getPlatformConfig(
        platform
      );

    const normalizedRtmpUrl =
      normalizeRtmpUrl(
        rtmpUrl
      );

    const normalizedStreamKey =
      normalizeStreamKey(
        streamKey
      );

    const normalizedUsername =
      String(
        username || ""
      ).trim();

    const normalizedChannelName =
      String(
        channelName ||
        normalizedUsername ||
        config.name
      ).trim();

    const normalizedChannelUrl =
      String(
        channelUrl || ""
      ).trim();

    const normalizedAvatarUrl =
      String(
        avatarUrl ||
        profilePictureUrl ||
        ""
      ).trim();

    ensureValue(
      normalizedRtmpUrl,
      `${config.name} RTMP URL is required.`
    );

    ensureValue(
      normalizedStreamKey,
      `${config.name} stream key is required.`
    );

    if (
      !isValidRtmpUrl(
        normalizedRtmpUrl
      )
    ) {
      throw new Error(
        `${config.name} RTMP URL must start with rtmp:// or rtmps://.`
      );
    }

    if (
      !isValidHttpUrl(
        normalizedChannelUrl
      )
    ) {
      throw new Error(
        `${config.name} channel URL must start with http:// or https://.`
      );
    }

    if (
      !isValidHttpUrl(
        normalizedAvatarUrl
      )
    ) {
      throw new Error(
        `${config.name} profile picture URL must start with http:// or https://.`
      );
    }

    const updateFields = {
      userId,

      platform:
        config.platform,

      connected:
        true,

      connectionType:
        "manual-rtmp",

      platformUserId:
        String(
          platformUserId || ""
        ).trim(),

      platformUsername:
        normalizedUsername,

      username:
        normalizedUsername ||
        normalizedChannelName,

      name:
        normalizedChannelName,

      channelName:
        normalizedChannelName,

      channelUrl:
        normalizedChannelUrl,

      avatarUrl:
        normalizedAvatarUrl,

      profilePictureUrl:
        normalizedAvatarUrl,

      rtmpUrl:
        normalizedRtmpUrl,

      streamKey:
        normalizedStreamKey,

      rtmpConfigured:
        true,

      liveStatus:
        "idle",

      [config.rtmpUrlField]:
        normalizedRtmpUrl,

      [config.streamKeyField]:
        normalizedStreamKey,

      [config.channelUrlField]:
        normalizedChannelUrl,

      [config.liveStatusField]:
        "idle",

      lastLiveStartedAt:
        null,

      lastLiveStoppedAt:
        null,

      metadata: {
        ...metadata,

        connectionType:
          "manual-rtmp",

        platform:
          config.platform,

        platformName:
          config.name,

        username:
          normalizedUsername,

        channelName:
          normalizedChannelName,

        dashboardUrl:
          config.dashboardUrl,

        configuredAt:
          new Date(),
      },
    };

    /*
     * Save platform-specific profile fields for compatibility.
     */

    if (
      config.platform ===
      "instagram"
    ) {
      updateFields.instagramUsername =
        normalizedUsername;
    }

    if (
      config.platform ===
      "facebook"
    ) {
      updateFields.pageName =
        normalizedChannelName;
    }

    if (
      config.platform ===
      "youtube"
    ) {
      updateFields.youtubeChannelTitle =
        normalizedChannelName;

      updateFields.youtubeChannelThumbnail =
        normalizedAvatarUrl;

      /*
       * Keep youtubeStreamUrl for compatibility with
       * existing live-stream code.
       */
      updateFields.youtubeStreamUrl =
        normalizedRtmpUrl;
    }

    const connection =
      await Connection.findOneAndUpdate(
        {
          userId,

          platform:
            config.platform,
        },
        {
          $set:
            updateFields,
        },
        {
          new:
            true,

          upsert:
            true,

          runValidators:
            true,

          setDefaultsOnInsert:
            true,
        }
      );

    return buildSafeConnection(
      connection
    );
  };

/* =========================================================
   GET ALL USER CONNECTIONS
========================================================= */

exports.getConnections =
  async (
    userId
  ) => {
    ensureValue(
      userId,
      "User ID is required."
    );

    const connections =
      await Connection.find({
        userId,
      })
        .select(
          [
            "-accessToken",
            "-refreshToken",
            "-pageAccessToken",
            "-streamKey",
            "-instagramStreamKey",
            "-facebookStreamKey",
            "-youtubeStreamKey",
            "-linkedinStreamKey",
            "-tiktokStreamKey",
            "-rumbleStreamKey",
            "-kickStreamKey",
            "-twitchStreamKey",
            "-twitterStreamKey",
          ].join(
            " "
          )
        )
        .sort({
          createdAt:
            -1,
        })
        .lean();

    return connections.map(
      buildSafeConnection
    );
  };

/* =========================================================
   GET SINGLE USER CONNECTION
========================================================= */

exports.getConnection =
  async (
    userId,
    platform
  ) => {
    ensureValue(
      userId,
      "User ID is required."
    );

    const normalizedPlatform =
      validatePlatform(
        platform
      );

    const connection =
      await Connection.findOne({
        userId,

        platform:
          normalizedPlatform,
      })
        .select(
          [
            "-accessToken",
            "-refreshToken",
            "-pageAccessToken",
            "-streamKey",
            "-instagramStreamKey",
            "-facebookStreamKey",
            "-youtubeStreamKey",
            "-linkedinStreamKey",
            "-tiktokStreamKey",
            "-rumbleStreamKey",
            "-kickStreamKey",
            "-twitchStreamKey",
            "-twitterStreamKey",
          ].join(
            " "
          )
        )
        .lean();

    return buildSafeConnection(
      connection
    );
  };

/* =========================================================
   GET CONNECTION WITH STREAM KEY
========================================================= */

/*
 * This method must only be called internally by the
 * FFmpeg/live streaming service.
 *
 * Never return this result directly to the frontend.
 */
exports.getConnectionWithSecrets =
  async (
    userId,
    platform
  ) => {
    ensureValue(
      userId,
      "User ID is required."
    );

    const config =
      getPlatformConfig(
        platform
      );

    const connection =
      await Connection.findOne({
        userId,

        platform:
          config.platform,

        connected:
          true,
      }).select(
        [
          "+streamKey",
          `+${config.streamKeyField}`,
        ].join(
          " "
        )
      );

    if (!connection) {
      throw new Error(
        `${config.name} is not connected.`
      );
    }

    const rtmpUrl =
      connection[
        config.rtmpUrlField
      ] ||
      connection.rtmpUrl ||
      "";

    const streamKey =
      connection[
        config.streamKeyField
      ] ||
      connection.streamKey ||
      "";

    if (
      !rtmpUrl ||
      !streamKey
    ) {
      throw new Error(
        `${config.name} RTMP URL or stream key is missing.`
      );
    }

    return {
      connection,

      platform:
        config.platform,

      platformName:
        config.name,

      rtmpUrl:
        normalizeRtmpUrl(
          rtmpUrl
        ),

      streamKey:
        normalizeStreamKey(
          streamKey
        ),

      destination:
        buildRtmpDestination({
          rtmpUrl,

          streamKey,
        }),
    };
  };

/* =========================================================
   GET MULTIPLE STREAMING DESTINATIONS
========================================================= */

exports.getStreamingDestinations =
  async (
    userId,
    platforms
  ) => {
    ensureValue(
      userId,
      "User ID is required."
    );

    if (
      !Array.isArray(
        platforms
      ) ||
      platforms.length === 0
    ) {
      throw new Error(
        "At least one streaming platform is required."
      );
    }

    const normalizedPlatforms = [
      ...new Set(
        platforms.map(
          normalizePlatform
        )
      ),
    ];

    const destinations =
      await Promise.all(
        normalizedPlatforms.map(
          async (
            platform
          ) => {
            try {
              const result =
                await exports
                  .getConnectionWithSecrets(
                    userId,
                    platform
                  );

              return {
                success:
                  true,

                platform:
                  result.platform,

                platformName:
                  result.platformName,

                rtmpUrl:
                  result.rtmpUrl,

                streamKey:
                  result.streamKey,

                destination:
                  result.destination,

                connectionId:
                  result.connection._id,
              };
            } catch (error) {
              return {
                success:
                  false,

                platform,

                message:
                  error.message,
              };
            }
          }
        )
      );

    return destinations;
  };

/* =========================================================
   UPDATE CONNECTION PROFILE
========================================================= */

exports.updateConnectionProfile =
  async ({
    userId,
    platform,
    username,
    channelName,
    channelUrl,
    avatarUrl,
    profilePictureUrl,
  }) => {
    ensureValue(
      userId,
      "User ID is required."
    );

    const config =
      getPlatformConfig(
        platform
      );

    const normalizedUsername =
      String(
        username || ""
      ).trim();

    const normalizedChannelName =
      String(
        channelName ||
        normalizedUsername ||
        config.name
      ).trim();

    const normalizedChannelUrl =
      String(
        channelUrl || ""
      ).trim();

    const normalizedAvatarUrl =
      String(
        avatarUrl ||
        profilePictureUrl ||
        ""
      ).trim();

    if (
      !isValidHttpUrl(
        normalizedChannelUrl
      )
    ) {
      throw new Error(
        "Channel URL must start with http:// or https://."
      );
    }

    if (
      !isValidHttpUrl(
        normalizedAvatarUrl
      )
    ) {
      throw new Error(
        "Profile picture URL must start with http:// or https://."
      );
    }

    const updateFields = {
      platformUsername:
        normalizedUsername,

      username:
        normalizedUsername ||
        normalizedChannelName,

      name:
        normalizedChannelName,

      channelName:
        normalizedChannelName,

      channelUrl:
        normalizedChannelUrl,

      avatarUrl:
        normalizedAvatarUrl,

      profilePictureUrl:
        normalizedAvatarUrl,

      [config.channelUrlField]:
        normalizedChannelUrl,

      "metadata.username":
        normalizedUsername,

      "metadata.channelName":
        normalizedChannelName,

      "metadata.profileUpdatedAt":
        new Date(),
    };

    if (
      config.platform ===
      "instagram"
    ) {
      updateFields.instagramUsername =
        normalizedUsername;
    }

    if (
      config.platform ===
      "facebook"
    ) {
      updateFields.pageName =
        normalizedChannelName;
    }

    if (
      config.platform ===
      "youtube"
    ) {
      updateFields.youtubeChannelTitle =
        normalizedChannelName;

      updateFields.youtubeChannelThumbnail =
        normalizedAvatarUrl;
    }

    const connection =
      await Connection.findOneAndUpdate(
        {
          userId,

          platform:
            config.platform,
        },
        {
          $set:
            updateFields,
        },
        {
          new:
            true,

          runValidators:
            true,
        }
      );

    if (!connection) {
      throw new Error(
        `${config.name} connection was not found.`
      );
    }

    return buildSafeConnection(
      connection
    );
  };

/* =========================================================
   UPDATE LIVE STATUS
========================================================= */

exports.updateLiveStatus =
  async ({
    userId,
    platform,
    status,
    errorMessage =
      "",
  }) => {
    ensureValue(
      userId,
      "User ID is required."
    );

    const config =
      getPlatformConfig(
        platform
      );

    const allowedStatuses = [
      "idle",
      "starting",
      "created",
      "streaming",
      "ready",
      "live",
      "complete",
      "failed",
    ];

    if (
      !allowedStatuses.includes(
        status
      )
    ) {
      throw new Error(
        `Invalid live status: ${status}.`
      );
    }

    const updateFields = {
      liveStatus:
        status,

      [config.liveStatusField]:
        status,

      "metadata.lastStatusUpdateAt":
        new Date(),
    };

    if (
      errorMessage
    ) {
      updateFields[
        "metadata.lastLiveError"
      ] =
        String(
          errorMessage
        );
    }

    if (
      status === "starting" ||
      status === "streaming" ||
      status === "live"
    ) {
      updateFields.lastLiveStartedAt =
        new Date();
    }

    if (
      status === "complete" ||
      status === "failed" ||
      status === "idle"
    ) {
      updateFields.lastLiveStoppedAt =
        new Date();
    }

    const connection =
      await Connection.findOneAndUpdate(
        {
          userId,

          platform:
            config.platform,
        },
        {
          $set:
            updateFields,
        },
        {
          new:
            true,

          runValidators:
            true,
        }
      );

    if (!connection) {
      throw new Error(
        `${config.name} connection was not found.`
      );
    }

    return buildSafeConnection(
      connection
    );
  };

/* =========================================================
   DELETE CONNECTION
========================================================= */

exports.deleteConnection =
  async (
    userId,
    platform
  ) => {
    ensureValue(
      userId,
      "User ID is required."
    );

    const normalizedPlatform =
      validatePlatform(
        platform
      );

    return Connection.findOneAndDelete(
      {
        userId,

        platform:
          normalizedPlatform,
      }
    );
  };

/* =========================================================
   CHECK CONNECTION
========================================================= */

exports.isConnected =
  async (
    userId,
    platform
  ) => {
    ensureValue(
      userId,
      "User ID is required."
    );

    const normalizedPlatform =
      validatePlatform(
        platform
      );

    const connection =
      await Connection.exists({
        userId,

        platform:
          normalizedPlatform,

        connected:
          true,

        rtmpConfigured:
          true,
      });

    return Boolean(
      connection
    );
  };

/* =========================================================
   LEGACY YOUTUBE CLIENT METHOD
========================================================= */

/*
 * YouTube API OAuth is no longer used.
 * The existing YouTube live controller must stream with
 * FFmpeg using getConnectionWithSecrets() instead.
 */
exports.getYouTubeClientForUser =
  async (
    userId
  ) => {
    ensureValue(
      userId,
      "User ID is required."
    );

    const result =
      await exports
        .getConnectionWithSecrets(
          userId,
          "youtube"
        );

    return {
      connection:
        result.connection,

      platform:
        result.platform,

      rtmpUrl:
        result.rtmpUrl,

      streamKey:
        result.streamKey,

      destination:
        result.destination,

      youtube:
        null,

      oauth2Client:
        null,
    };
  };

/* =========================================================
   EXPORT HELPERS
========================================================= */

exports.normalizePlatform =
  normalizePlatform;

exports.validatePlatform =
  validatePlatform;

exports.getPlatformConfig =
  getPlatformConfig;

exports.buildRtmpDestination =
  buildRtmpDestination;

exports.buildSafeConnection =
  buildSafeConnection;

exports.isValidRtmpUrl =
  isValidRtmpUrl;

exports.isValidHttpUrl =
  isValidHttpUrl;

exports.MANUAL_RTMP_PLATFORMS =
  MANUAL_RTMP_PLATFORMS;

exports.SUPPORTED_PLATFORMS =
  SUPPORTED_PLATFORMS;

exports.PLATFORM_CONFIG =
  PLATFORM_CONFIG;