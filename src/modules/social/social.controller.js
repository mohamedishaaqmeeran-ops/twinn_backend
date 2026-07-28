const Connection = require(
  "../../models/Connection"
);

/* =========================================================
   PLATFORM CONFIGURATION
========================================================= */

const MANUAL_RTMP_PLATFORMS = [
  "instagram",
  "facebook",
  "youtube",
  "linkedin",
  "tiktok",
  "rumble",
  "kick",
  "twitch",
  "twitter",
];

const SUPPORTED_PLATFORMS = [
  ...MANUAL_RTMP_PLATFORMS,
  
];

const MANUAL_PLATFORM_CONFIG = {
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
};

/* =========================================================
   NORMALIZE PLATFORM
========================================================= */

const normalizePlatform =
  (
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

    return value;
  };

/* =========================================================
   VALIDATE RTMP URL
========================================================= */

const isValidRtmpUrl =
  (
    value
  ) => {
    if (!value) {
      return false;
    }

    return (
      value.startsWith(
        "rtmp://"
      ) ||
      value.startsWith(
        "rtmps://"
      )
    );
  };

/* =========================================================
   VALIDATE HTTP URL
========================================================= */

const isValidHttpUrl =
  (
    value
  ) => {
    if (!value) {
      return true;
    }

    return (
      value.startsWith(
        "http://"
      ) ||
      value.startsWith(
        "https://"
      )
    );
  };

/* =========================================================
   GET PLATFORM CONFIG
========================================================= */

const getManualPlatformConfig =
  (
    platform
  ) => {
    return MANUAL_PLATFORM_CONFIG[
      platform
    ];
  };

/* =========================================================
   CREATE SAFE CONNECTION RESPONSE
========================================================= */

const createSafeConnection =
  (
    connection
  ) => {
    const platform =
      normalizePlatform(
        connection.platform
      );

    const config =
      getManualPlatformConfig(
        platform
      );

    if (!config) {
      return {
        ...connection,

        platform,

        rtmpConfigured:
          false,

        liveStatus:
          connection.liveStatus ||
          "idle",
      };
    }

    const platformRtmpUrl =
      connection[
        config.rtmpUrlField
      ] ||
      connection.rtmpUrl ||
      "";

    const platformChannelUrl =
      connection[
        config.channelUrlField
      ] ||
      connection.channelUrl ||
      "";

    const platformLiveStatus =
      connection[
        config.liveStatusField
      ] ||
      connection.liveStatus ||
      "idle";

    return {
      ...connection,

      platform,

      connected:
        Boolean(
          connection.connected
        ),

      connectionType:
        connection.connectionType ||
        connection.metadata
          ?.connectionType ||
        "manual-rtmp",

      channelName:
        connection.channelName ||
        connection.name ||
        config.name,

      channelUrl:
        platformChannelUrl,

      avatarUrl:
        connection.avatarUrl ||
        connection.profilePictureUrl ||
        "",

      profilePictureUrl:
        connection.profilePictureUrl ||
        connection.avatarUrl ||
        "",

      rtmpConfigured:
        Boolean(
          platformRtmpUrl
        ),

      liveStatus:
        platformLiveStatus,

      [`${platform}RtmpConfigured`]:
        Boolean(
          platformRtmpUrl
        ),
    };
  };

/* =========================================================
   MANUAL RTMP INFORMATION
========================================================= */

exports.startOAuth =
  (
    req,
    res
  ) => {
    const platform =
      normalizePlatform(
        req.params.platform
      );

    const config =
      getManualPlatformConfig(
        platform
      );

    if (!config) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "Unsupported platform.",
        });
    }

    return res
      .status(400)
      .json({
        success:
          false,

        platform,

        connectionType:
          "manual-rtmp",

        dashboardUrl:
          config.dashboardUrl,

        message:
          `${config.name} uses manual RTMP connection. Enter the RTMP URL and stream key in the connection form.`,
      });
  };

/* =========================================================
   DISABLE OAUTH CALLBACK
========================================================= */

exports.oauthCallback =
  (
    req,
    res
  ) => {
    const frontendUrl =
      process.env.FRONTEND_URL ||
      "https://twinn.live";

    return res.redirect(
      `${frontendUrl}/app/connect?status=failed&message=${encodeURIComponent(
        "OAuth is disabled. Configure the platform using an RTMP URL and stream key."
      )}`
    );
  };

/* =========================================================
   GET USER CONNECTIONS
========================================================= */

exports.getConnections =
  async (
    req,
    res
  ) => {
    try {
      const connections =
        await Connection.find({
          userId:
            req.user.id,
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

      const safeConnections =
        connections.map(
          createSafeConnection
        );

      return res.json({
        success:
          true,

        data:
          safeConnections,

        connections:
          safeConnections,
      });
    } catch (error) {
      console.error(
        "GET CONNECTIONS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            error.message ||
            "Unable to load social connections.",
        });
    }
  };

/* =========================================================
   OPEN PLATFORM DASHBOARD
========================================================= */

exports.openManualPlatform =
  (
    req,
    res
  ) => {
    try {
      const platform =
        normalizePlatform(
          req.params.platform
        );

      const config =
        getManualPlatformConfig(
          platform
        );

      if (!config) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Unsupported manual RTMP platform.",
          });
      }

      return res.redirect(
        config.dashboardUrl
      );
    } catch (error) {
      console.error(
        "OPEN PLATFORM DASHBOARD ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            error.message ||
            "Unable to open the platform dashboard.",
        });
    }
  };

/* =========================================================
   SAVE MANUAL RTMP SETTINGS
========================================================= */

exports.saveManualRtmp =
  async (
    req,
    res
  ) => {
    try {
      const platform =
        normalizePlatform(
          req.params.platform
        );

      const config =
        getManualPlatformConfig(
          platform
        );

      if (!config) {
        return res
          .status(400)
          .json({
            success:
              false,

           message:
  "Manual RTMP is supported for Instagram, Facebook, YouTube, TikTok, LinkedIn, Rumble, Kick, Twitch and X/Twitter.",
          });
      }

      const rtmpUrl =
        String(
          req.body.rtmpUrl ||
          ""
        ).trim();

      const streamKey =
        String(
          req.body.streamKey ||
          ""
        ).trim();

      const channelUrl =
        String(
          req.body.channelUrl ||
          ""
        ).trim();

      const username =
        String(
          req.body.username ||
          req.body.platformUsername ||
          ""
        ).trim();

      const channelName =
        String(
          req.body.channelName ||
          req.body.name ||
          username ||
          config.name
        ).trim();

      const avatarUrl =
        String(
          req.body.avatarUrl ||
          req.body.profilePictureUrl ||
          ""
        ).trim();

      const platformUserId =
        String(
          req.body.platformUserId ||
          ""
        ).trim();

      if (
        !rtmpUrl ||
        !streamKey
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              `${config.name} RTMP URL and stream key are required.`,
          });
      }

      if (
        !isValidRtmpUrl(
          rtmpUrl
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              `${config.name} RTMP URL must start with rtmp:// or rtmps://.`,
          });
      }

      if (
        !isValidHttpUrl(
          channelUrl
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              `${config.name} channel URL must start with http:// or https://.`,
          });
      }

      if (
        !isValidHttpUrl(
          avatarUrl
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              `${config.name} profile picture URL must start with http:// or https://.`,
          });
      }

      const normalizedRtmpUrl =
        rtmpUrl.replace(
          /\/+$/,
          ""
        );

      const normalizedStreamKey =
        streamKey.replace(
          /^\/+/,
          ""
        );

      const updateFields = {
        userId:
          req.user.id,

        platform,

        connected:
          true,

        connectionType:
          "manual-rtmp",

        platformUserId,

        platformUsername:
          username,

        username:
          username ||
          channelName,

        name:
          channelName,

        channelName,

        channelUrl,

        avatarUrl,

        profilePictureUrl:
          avatarUrl,

        /*
         * Generic RTMP fields used by the
         * FFmpeg live-streaming service.
         */
        rtmpUrl:
          normalizedRtmpUrl,

        streamKey:
          normalizedStreamKey,

        rtmpConfigured:
          true,

        liveStatus:
          "idle",

        /*
         * Platform-specific fields retained
         * for backward compatibility.
         */
        [config.rtmpUrlField]:
          normalizedRtmpUrl,

        [config.streamKeyField]:
          normalizedStreamKey,

        [config.channelUrlField]:
          channelUrl,

        [config.liveStatusField]:
          "idle",

        lastLiveStartedAt:
          null,

        lastLiveStoppedAt:
          null,

        metadata: {
          connectionType:
            "manual-rtmp",

          platform,

          platformName:
            config.name,

          username,

          channelName,

          dashboardUrl:
            config.dashboardUrl,

          configuredAt:
            new Date(),
        },
      };

      /*
       * Add platform-specific profile values
       * for compatibility with existing UI.
       */

      if (
        platform ===
        "instagram"
      ) {
        updateFields.instagramUsername =
          username;
      }

      if (
        platform ===
        "facebook"
      ) {
        updateFields.pageName =
          channelName;
      }

      if (
        platform ===
        "youtube"
      ) {
        updateFields.youtubeChannelTitle =
          channelName;

        updateFields.youtubeChannelThumbnail =
          avatarUrl;

        updateFields.youtubeStreamUrl =
          normalizedRtmpUrl;
      }

      const connection =
        await Connection.findOneAndUpdate(
          {
            userId:
              req.user.id,

            platform,
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

      return res.json({
        success:
          true,

        message:
          `${config.name} RTMP settings saved successfully.`,

        data: {
          id:
            connection._id,

          platform,

          connected:
            true,

          connectionType:
            "manual-rtmp",

          rtmpConfigured:
            true,

          platformUserId:
            connection.platformUserId ||
            "",

          username:
            connection.username ||
            "",

          platformUsername:
            connection.platformUsername ||
            "",

          name:
            connection.name ||
            config.name,

          channelName:
            connection.channelName ||
            connection.name ||
            config.name,

          channelUrl:
            connection.channelUrl ||
            connection[
              config.channelUrlField
            ] ||
            "",

          avatarUrl:
            connection.avatarUrl ||
            connection.profilePictureUrl ||
            "",

          profilePictureUrl:
            connection.profilePictureUrl ||
            connection.avatarUrl ||
            "",

          liveStatus:
            connection.liveStatus ||
            connection[
              config.liveStatusField
            ] ||
            "idle",
        },
      });
    } catch (error) {
      console.error(
        "SAVE MANUAL RTMP ERROR:",
        error
      );

      if (
        error.code ===
        11000
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            message:
              "This platform is already connected. Refresh the page and update the existing connection.",
          });
      }

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            error.message ||
            "Unable to save RTMP settings.",
        });
    }
  };

/* =========================================================
   LEGACY INSTAGRAM RTMP HANDLER
========================================================= */

exports.saveInstagramRtmp =
  async (
    req,
    res
  ) => {
    req.params.platform =
      "instagram";

    return exports.saveManualRtmp(
      req,
      res
    );
  };

/* =========================================================
   GET SINGLE CONNECTION
========================================================= */

exports.getConnection =
  async (
    req,
    res
  ) => {
    try {
      const platform =
        normalizePlatform(
          req.params.platform
        );

      if (
        !SUPPORTED_PLATFORMS.includes(
          platform
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Unsupported social platform.",
          });
      }

      const connection =
        await Connection.findOne({
          userId:
            req.user.id,

          platform,
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

      if (!connection) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              `${platform} connection was not found.`,
          });
      }

      return res.json({
        success:
          true,

        data:
          createSafeConnection(
            connection
          ),
      });
    } catch (error) {
      console.error(
        "GET CONNECTION ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            error.message ||
            "Unable to load the connection.",
        });
    }
  };

/* =========================================================
   UPDATE PROFILE DETAILS
========================================================= */

exports.updateConnectionProfile =
  async (
    req,
    res
  ) => {
    try {
      const platform =
        normalizePlatform(
          req.params.platform
        );

      const config =
        getManualPlatformConfig(
          platform
        );

      if (!config) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Unsupported manual RTMP platform.",
          });
      }

      const username =
        String(
          req.body.username ||
          req.body.platformUsername ||
          ""
        ).trim();

      const channelName =
        String(
          req.body.channelName ||
          req.body.name ||
          username ||
          config.name
        ).trim();

      const channelUrl =
        String(
          req.body.channelUrl ||
          ""
        ).trim();

      const avatarUrl =
        String(
          req.body.avatarUrl ||
          req.body.profilePictureUrl ||
          ""
        ).trim();

      if (
        !isValidHttpUrl(
          channelUrl
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Channel URL must start with http:// or https://.",
          });
      }

      if (
        !isValidHttpUrl(
          avatarUrl
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Profile picture URL must start with http:// or https://.",
          });
      }

      const updateFields = {
        username:
          username ||
          channelName,

        platformUsername:
          username,

        name:
          channelName,

        channelName,

        channelUrl,

        avatarUrl,

        profilePictureUrl:
          avatarUrl,

        [config.channelUrlField]:
          channelUrl,

        "metadata.username":
          username,

        "metadata.channelName":
          channelName,

        "metadata.profileUpdatedAt":
          new Date(),
      };

      if (
        platform ===
        "instagram"
      ) {
        updateFields.instagramUsername =
          username;
      }

      if (
        platform ===
        "facebook"
      ) {
        updateFields.pageName =
          channelName;
      }

      if (
        platform ===
        "youtube"
      ) {
        updateFields.youtubeChannelTitle =
          channelName;

        updateFields.youtubeChannelThumbnail =
          avatarUrl;
      }

      const connection =
        await Connection.findOneAndUpdate(
          {
            userId:
              req.user.id,

            platform,
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
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              `${config.name} connection was not found.`,
          });
      }

      return res.json({
        success:
          true,

        message:
          `${config.name} profile updated successfully.`,

        data: {
          id:
            connection._id,

          platform,

          username:
            connection.username ||
            "",

          channelName:
            connection.channelName ||
            connection.name ||
            "",

          channelUrl:
            connection.channelUrl ||
            "",

          avatarUrl:
            connection.avatarUrl ||
            "",
        },
      });
    } catch (error) {
      console.error(
        "UPDATE CONNECTION PROFILE ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            error.message ||
            "Unable to update connection profile.",
        });
    }
  };

/* =========================================================
   DELETE CONNECTION
========================================================= */

exports.deleteConnection =
  async (
    req,
    res
  ) => {
    try {
      const platform =
        normalizePlatform(
          req.params.platform
        );

      if (
        !SUPPORTED_PLATFORMS.includes(
          platform
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Unsupported social platform.",
          });
      }

      const deletedConnection =
        await Connection.findOneAndDelete(
          {
            userId:
              req.user.id,

            platform,
          }
        );

      if (!deletedConnection) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              `${platform} connection was not found.`,
          });
      }

      return res.json({
        success:
          true,

        message:
          `${platform} disconnected successfully.`,
      });
    } catch (error) {
      console.error(
        "DELETE CONNECTION ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            error.message ||
            "Unable to disconnect platform.",
        });
    }
  };