const jwt = require(
  "jsonwebtoken"
);

const socialService =
  require(
    "./social.service"
  );

const Connection =
  require(
    "../../models/Connection"
  );

/* =========================================================
   PLATFORM CONFIGURATION
========================================================= */

const OAUTH_PLATFORMS = [
  "instagram",
  "facebook",
  "youtube",
];

const MANUAL_RTMP_PLATFORMS = [
  "rumble",
  "kick",
  "twitch",
  "twitter",
];

const SUPPORTED_PLATFORMS = [
  ...OAUTH_PLATFORMS,
  ...MANUAL_RTMP_PLATFORMS,
  "tiktok",
];

const MANUAL_PLATFORM_CONFIG = {
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
      "X / Twitter",

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
   VALIDATE CHANNEL URL
========================================================= */

const isValidChannelUrl =
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
   GET MANUAL PLATFORM CONFIG
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
   START SOCIAL OAUTH
========================================================= */

exports.startOAuth =
  (
    req,
    res
  ) => {
    try {
      const platform =
        normalizePlatform(
          req.params.platform
        );

      if (
        !OAUTH_PLATFORMS.includes(
          platform
        )
      ) {
        const config =
          getManualPlatformConfig(
            platform
          );

        if (config) {
          return res
            .status(400)
            .json({
              success:
                false,

              connectionType:
                "manual-rtmp",

              platform,

              message:
                `${config.name} uses manual RTMP connection. Enter the RTMP URL and stream key in the connection form.`,
            });
        }

        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Unsupported OAuth platform.",
          });
      }

      if (
        !process.env.JWT_SECRET
      ) {
        throw new Error(
          "JWT_SECRET is missing."
        );
      }

      const state =
        jwt.sign(
          {
            userId:
              req.user.id,

            platform,
          },
          process.env
            .JWT_SECRET,
          {
            expiresIn:
              "10m",
          }
        );

      const url =
        socialService.getOAuthURL(
          platform,
          state
        );

      return res.redirect(
        url
      );
    } catch (error) {
      console.error(
        "START OAUTH ERROR:",
        error
      );

      return res
        .status(400)
        .json({
          success:
            false,

          message:
            error.message ||
            "Unable to start social login.",
        });
    }
  };

/* =========================================================
   SOCIAL OAUTH CALLBACK
========================================================= */

exports.oauthCallback =
  async (
    req,
    res
  ) => {
    try {
      const platform =
        normalizePlatform(
          req.params.platform
        );

      const {
        code,
        state,
      } = req.query;

      const frontendUrl =
        process.env.FRONTEND_URL ||
        "https://twinn.live";

      if (
        !OAUTH_PLATFORMS.includes(
          platform
        )
      ) {
        throw new Error(
          "Unsupported OAuth callback platform."
        );
      }

      if (!code) {
        const message =
          req.query
            .error_message ||
          req.query
            .error_description ||
          req.query.error ||
          "No authorization code received.";

        return res.redirect(
          `${frontendUrl}/app/connect?status=failed&message=${encodeURIComponent(
            message
          )}`
        );
      }

      if (!state) {
        throw new Error(
          "OAuth state is missing."
        );
      }

      if (
        !process.env.JWT_SECRET
      ) {
        throw new Error(
          "JWT_SECRET is missing."
        );
      }

      const decoded =
        jwt.verify(
          state,
          process.env
            .JWT_SECRET
        );

      if (
        !decoded?.userId
      ) {
        throw new Error(
          "OAuth user information is missing."
        );
      }

      if (
        decoded.platform &&
        decoded.platform !==
          platform
      ) {
        throw new Error(
          "OAuth platform mismatch."
        );
      }

      await socialService.handleCallback(
        platform,
        code,
        decoded.userId
      );

      return res.redirect(
        `${frontendUrl}/app/connect?status=connected&platform=${encodeURIComponent(
          platform
        )}`
      );
    } catch (error) {
      console.error(
        "OAUTH CALLBACK ERROR:",
        error
      );

      const frontendUrl =
        process.env.FRONTEND_URL ||
        "https://twinn.live";

      return res.redirect(
        `${frontendUrl}/app/connect?status=failed&message=${encodeURIComponent(
          error.message ||
            "Social connection failed."
        )}`
      );
    }
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
              "-instagramStreamKey",
              "-youtubeStreamKey",
              "-rumbleStreamKey",
              "-kickStreamKey",
              "-twitchStreamKey",
              "-twitterStreamKey",
            ].join(" ")
          )
          .sort({
            createdAt:
              -1,
          })
          .lean();

      const safeConnections =
        connections.map(
          (
            connection
          ) => {
            const platform =
              normalizePlatform(
                connection.platform
              );

            const manualConfig =
              getManualPlatformConfig(
                platform
              );

            const manualRtmpConfigured =
              manualConfig
                ? Boolean(
                    connection[
                      manualConfig
                        .rtmpUrlField
                    ]
                  )
                : false;

            const manualChannelUrl =
              manualConfig
                ? connection[
                    manualConfig
                      .channelUrlField
                  ] || ""
                : "";

            const manualLiveStatus =
              manualConfig
                ? connection[
                    manualConfig
                      .liveStatusField
                  ] || "idle"
                : "idle";

            return {
              ...connection,

              platform,

              instagramRtmpConfigured:
                Boolean(
                  connection
                    .instagramRtmpUrl
                ),

              youtubeRtmpConfigured:
                Boolean(
                  connection
                    .youtubeStreamUrl
                ),

              rumbleRtmpConfigured:
                Boolean(
                  connection
                    .rumbleRtmpUrl
                ),

              kickRtmpConfigured:
                Boolean(
                  connection
                    .kickRtmpUrl
                ),

              twitchRtmpConfigured:
                Boolean(
                  connection
                    .twitchRtmpUrl
                ),

              twitterRtmpConfigured:
                Boolean(
                  connection
                    .twitterRtmpUrl
                ),

              rtmpConfigured:
                platform ===
                "instagram"
                  ? Boolean(
                      connection
                        .instagramRtmpUrl
                    )
                  : platform ===
                    "youtube"
                  ? Boolean(
                      connection
                        .youtubeStreamUrl
                    )
                  : manualRtmpConfigured,

              channelUrl:
                manualChannelUrl,

              liveStatus:
                platform ===
                "youtube"
                  ? connection
                      .youtubeLiveStatus ||
                    "idle"
                  : platform ===
                    "instagram"
                  ? connection
                      .instagramLiveStatus ||
                    "idle"
                  : manualLiveStatus,
            };
          }
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
   SAVE INSTAGRAM RTMP SETTINGS
========================================================= */

exports.saveInstagramRtmp =
  async (
    req,
    res
  ) => {
    try {
      const rtmpUrl =
        String(
          req.body
            .rtmpUrl || ""
        ).trim();

      const streamKey =
        String(
          req.body
            .streamKey || ""
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
              "Instagram RTMP URL and stream key are required.",
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
              "Instagram RTMP URL must start with rtmp:// or rtmps://.",
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

      const connection =
        await Connection.findOneAndUpdate(
          {
            userId:
              req.user.id,

            platform:
              "instagram",

            connected:
              true,
          },
          {
            $set: {
              instagramRtmpUrl:
                normalizedRtmpUrl,

              instagramStreamKey:
                normalizedStreamKey,

              instagramLiveStatus:
                "idle",

              metadata: {
                connectionType:
                  "oauth-rtmp",

                rtmpConfiguredAt:
                  new Date(),
              },
            },
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
              "Connect Instagram before saving RTMP settings.",
          });
      }

      return res.json({
        success:
          true,

        message:
          "Instagram RTMP settings saved successfully.",

        data: {
          id:
            connection._id,

          platform:
            "instagram",

          connected:
            true,

          rtmpConfigured:
            true,
        },
      });
    } catch (error) {
      console.error(
        "SAVE INSTAGRAM RTMP ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            error.message ||
            "Unable to save Instagram RTMP settings.",
        });
    }
  };

/* =========================================================
   OPEN MANUAL PLATFORM DASHBOARD
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
        "OPEN MANUAL PLATFORM ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            error.message ||
            "Unable to open platform dashboard.",
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
              "Manual RTMP is supported only for Rumble, Kick, Twitch and X/Twitter.",
          });
      }

      const rtmpUrl =
        String(
          req.body
            .rtmpUrl || ""
        ).trim();

      const streamKey =
        String(
          req.body
            .streamKey || ""
        ).trim();

      const channelUrl =
        String(
          req.body
            .channelUrl || ""
        ).trim();

      const username =
        String(
          req.body
            .username || ""
        ).trim();

      const channelName =
        String(
          req.body
            .channelName ||
          username ||
          config.name
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
        !isValidChannelUrl(
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

        username:
          username ||
          channelName,

        platformUsername:
          username,

        name:
          channelName,

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

          channelName,

          configuredAt:
            new Date(),
        },
      };

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

          rtmpConfigured:
            true,

          username:
            connection
              .username || "",

          name:
            connection.name ||
            config.name,

          channelUrl:
            connection[
              config
                .channelUrlField
            ] || "",

          liveStatus:
            connection[
              config
                .liveStatusField
            ] || "idle",
        },
      });
    } catch (error) {
      console.error(
        "SAVE MANUAL RTMP ERROR:",
        error
      );

      if (
        error.code === 11000
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

      /*
       * Use socialService for OAuth platforms.
       * This keeps YouTube token revocation working.
       */
      if (
        OAUTH_PLATFORMS.includes(
          platform
        )
      ) {
        const deletedConnection =
          await socialService.deleteConnection(
            req.user.id,
            platform
          );

        if (
          !deletedConnection
        ) {
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
      }

      /*
       * Delete manual RTMP and locally stored platforms.
       */
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