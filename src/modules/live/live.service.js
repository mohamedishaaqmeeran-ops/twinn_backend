const fs = require(
  "fs"
);

const Connection =
  require(
    "../../models/Connection"
  );

const ffmpegService =
  require(
    "./ffmpeg.service"
  );

/* =========================================================
   SUPPORTED PLATFORMS
========================================================= */

const SUPPORTED_PLATFORMS = [
  "instagram",
  "youtube",
  "rumble",
  "kick",
  "twitch",
  "twitter",
];

/* =========================================================
   PLATFORM FIELD CONFIGURATION
========================================================= */

const PLATFORM_CONFIG = {
  instagram: {
    name:
      "Instagram",

    rtmpUrlField:
      "instagramRtmpUrl",

    streamKeyField:
      "instagramStreamKey",

    liveStatusField:
      "instagramLiveStatus",
  },

  youtube: {
    name:
      "YouTube",

    rtmpUrlField:
      "youtubeStreamUrl",

    streamKeyField:
      "youtubeStreamKey",

    liveStatusField:
      "youtubeLiveStatus",
  },

  rumble: {
    name:
      "Rumble",

    rtmpUrlField:
      "rumbleRtmpUrl",

    streamKeyField:
      "rumbleStreamKey",

    liveStatusField:
      "rumbleLiveStatus",
  },

  kick: {
    name:
      "Kick",

    rtmpUrlField:
      "kickRtmpUrl",

    streamKeyField:
      "kickStreamKey",

    liveStatusField:
      "kickLiveStatus",
  },

  twitch: {
    name:
      "Twitch",

    rtmpUrlField:
      "twitchRtmpUrl",

    streamKeyField:
      "twitchStreamKey",

    liveStatusField:
      "twitchLiveStatus",
  },

  twitter: {
    name:
      "X / Twitter",

    rtmpUrlField:
      "twitterRtmpUrl",

    streamKeyField:
      "twitterStreamKey",

    liveStatusField:
      "twitterLiveStatus",
  },
};

/* =========================================================
   HELPERS
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

  return value === "x"
    ? "twitter"
    : value;
};

const normalizePlatforms = (
  platforms
) => {
  const list =
    Array.isArray(
      platforms
    )
      ? platforms
      : String(
          platforms || ""
        )
          .split(",")
          .map(
            (
              platform
            ) =>
              platform.trim()
          );

  return [
    ...new Set(
      list
        .map(
          normalizePlatform
        )
        .filter(Boolean)
    ),
  ];
};

const validatePlatforms = (
  platforms
) => {
  if (
    !platforms.length
  ) {
    throw new Error(
      "Select at least one platform."
    );
  }

  const unsupported =
    platforms.filter(
      (
        platform
      ) =>
        !SUPPORTED_PLATFORMS.includes(
          platform
        )
    );

  if (
    unsupported.length
  ) {
    throw new Error(
      `Unsupported platforms: ${unsupported.join(
        ", "
      )}`
    );
  }
};

const buildDestinationUrl = (
  rtmpUrl,
  streamKey
) => {
  const normalizedUrl =
    String(
      rtmpUrl || ""
    )
      .trim()
      .replace(
        /\/+$/,
        ""
      );

  const normalizedKey =
    String(
      streamKey || ""
    )
      .trim()
      .replace(
        /^\/+/,
        ""
      );

  if (
    !normalizedUrl ||
    !normalizedKey
  ) {
    throw new Error(
      "RTMP URL or stream key is missing."
    );
  }

  return (
    `${normalizedUrl}/` +
    `${normalizedKey}`
  );
};

const getSelectedStreamKeyFields = (
  platforms
) => {
  return platforms
    .map(
      (
        platform
      ) =>
        `+${
          PLATFORM_CONFIG[
            platform
          ].streamKeyField
        }`
    )
    .join(" ");
};

const deleteTemporaryFile = (
  filePath
) => {
  if (!filePath) {
    return;
  }

  fs.unlink(
    filePath,
    (
      error
    ) => {
      if (
        error &&
        error.code !==
          "ENOENT"
      ) {
        console.error(
          "DELETE TEMP VIDEO ERROR:",
          error.message
        );
      }
    }
  );
};

/* =========================================================
   UPDATE LIVE STATUS
========================================================= */

const updateConnectionStatus =
  async ({
    connectionId,
    platform,
    status,
    startedAt,
    stoppedAt,
    errorMessage,
  }) => {
    const config =
      PLATFORM_CONFIG[
        platform
      ];

    if (!config) {
      return;
    }

    const update = {
      [config.liveStatusField]:
        status,
    };

    if (startedAt) {
      update.lastLiveStartedAt =
        startedAt;
    }

    if (stoppedAt) {
      update.lastLiveStoppedAt =
        stoppedAt;
    }

    const metadataUpdate = {
      [`metadata.live.${platform}.status`]:
        status,

      [`metadata.live.${platform}.updatedAt`]:
        new Date(),
    };

    if (errorMessage) {
      metadataUpdate[
        `metadata.live.${platform}.error`
      ] =
        String(
          errorMessage
        ).slice(
          0,
          2000
        );
    } else {
      metadataUpdate[
        `metadata.live.${platform}.error`
      ] = "";
    }

    await Connection.updateOne(
      {
        _id:
          connectionId,
      },
      {
        $set: {
          ...update,
          ...metadataUpdate,
        },
      }
    );
  };

/* =========================================================
   LOAD CONNECTIONS AND PRIVATE STREAM KEYS
========================================================= */

const loadConnections =
  async (
    userId,
    platforms
  ) => {
    const selectFields =
      getSelectedStreamKeyFields(
        platforms
      );

    const connections =
      await Connection.find(
        {
          userId,

          platform: {
            $in:
              platforms,
          },

          connected:
            true,
        }
      ).select(
        selectFields
      );

    return connections;
  };

/* =========================================================
   VERIFY CONNECTION CREDENTIALS
========================================================= */

const prepareDestinations =
  (
    platforms,
    connections
  ) => {
    const connectionMap =
      new Map(
        connections.map(
          (
            connection
          ) => [
            normalizePlatform(
              connection.platform
            ),
            connection,
          ]
        )
      );

    return platforms.map(
      (
        platform
      ) => {
        const config =
          PLATFORM_CONFIG[
            platform
          ];

        const connection =
          connectionMap.get(
            platform
          );

        if (!connection) {
          throw new Error(
            `${config.name} is not connected.`
          );
        }

        const rtmpUrl =
          connection[
            config.rtmpUrlField
          ];

        const streamKey =
          connection[
            config.streamKeyField
          ];

        if (
          !rtmpUrl ||
          !streamKey
        ) {
          throw new Error(
            `${config.name} RTMP settings are incomplete.`
          );
        }

        return {
          platform,

          config,

          connection,

          outputUrl:
            buildDestinationUrl(
              rtmpUrl,
              streamKey
            ),
        };
      }
    );
  };

/* =========================================================
   START MULTI-PLATFORM LIVE
========================================================= */

exports.startLive =
  async ({
    userId,
    platforms,
    input,
    sourceType =
      "file",
    loop =
      false,
    videoBitrate =
      4500,
    audioBitrate =
      128,
    width =
      1280,
    height =
      720,
    fps =
      30,
    preset =
      "veryfast",
    temporaryFile =
      false,
  }) => {
    if (!userId) {
      throw new Error(
        "User ID is required."
      );
    }

    if (!input) {
      throw new Error(
        "Video input is required."
      );
    }

    const normalizedPlatforms =
      normalizePlatforms(
        platforms
      );

    validatePlatforms(
      normalizedPlatforms
    );

    const alreadyRunning =
      normalizedPlatforms.filter(
        (
          platform
        ) =>
          ffmpegService.isStreaming(
            userId,
            platform
          )
      );

    if (
      alreadyRunning.length
    ) {
      throw new Error(
        `Streams already running: ${alreadyRunning.join(
          ", "
        )}`
      );
    }

    const connections =
      await loadConnections(
        userId,
        normalizedPlatforms
      );

    const destinations =
      prepareDestinations(
        normalizedPlatforms,
        connections
      );

    /*
     * Mark all selected platforms as starting.
     */
    await Promise.all(
      destinations.map(
        (
          destination
        ) =>
          updateConnectionStatus({
            connectionId:
              destination
                .connection
                ._id,

            platform:
              destination
                .platform,

            status:
              destination
                .platform ===
                "youtube"
                ? "streaming"
                : "starting",

            errorMessage:
              "",
          })
      )
    );

    const started = [];
    const failed = [];

    /*
     * One FFmpeg process is started per destination.
     *
     * This makes independent platform stopping possible.
     */
    for (
      const destination
      of destinations
    ) {
      try {
        const result =
          ffmpegService.startStream(
            {
              userId,

              platform:
                destination
                  .platform,

              input,

              outputUrl:
                destination
                  .outputUrl,

              sourceType,

              loop,

              videoBitrate,

              audioBitrate,

              width,

              height,

              fps,

              preset,

              onStarted:
                async () => {
                  await updateConnectionStatus(
                    {
                      connectionId:
                        destination
                          .connection
                          ._id,

                      platform:
                        destination
                          .platform,

                      status:
                        destination
                          .platform ===
                          "youtube"
                          ? "streaming"
                          : "streaming",

                      startedAt:
                        new Date(),

                      errorMessage:
                        "",
                    }
                  );
                },

              onError:
                async (
                  error
                ) => {
                  await updateConnectionStatus(
                    {
                      connectionId:
                        destination
                          .connection
                          ._id,

                      platform:
                        destination
                          .platform,

                      status:
                        "failed",

                      stoppedAt:
                        new Date(),

                      errorMessage:
                        error.message,
                    }
                  );
                },

              onExit:
                async ({
                  code,
                  signal,
                  stderr,
                }) => {
                  const wasSuccessful =
                    code === 0 ||
                    signal ===
                      "SIGTERM";

                  await updateConnectionStatus(
                    {
                      connectionId:
                        destination
                          .connection
                          ._id,

                      platform:
                        destination
                          .platform,

                      status:
                        wasSuccessful
                          ? "complete"
                          : "failed",

                      stoppedAt:
                        new Date(),

                      errorMessage:
                        wasSuccessful
                          ? ""
                          : stderr ||
                            `FFmpeg exited with code ${code}.`,
                    }
                  );
                },
            }
          );

        started.push({
          platform:
            destination
              .platform,

          pid:
            result.pid,

          startedAt:
            result.startedAt,
        });
      } catch (error) {
        failed.push({
          platform:
            destination
              .platform,

          message:
            error.message,
        });

        await updateConnectionStatus(
          {
            connectionId:
              destination
                .connection
                ._id,

            platform:
              destination
                .platform,

            status:
              "failed",

            stoppedAt:
              new Date(),

            errorMessage:
              error.message,
          }
        );
      }
    }

    if (
      !started.length
    ) {
      if (
        temporaryFile
      ) {
        deleteTemporaryFile(
          input
        );
      }

      throw new Error(
        failed
          .map(
            (
              item
            ) =>
              `${item.platform}: ${item.message}`
          )
          .join("; ") ||
          "No platform stream could be started."
      );
    }

    return {
      started,

      failed,

      input,

      temporaryFile,
    };
  };

/* =========================================================
   STOP ONE PLATFORM
========================================================= */

exports.stopPlatform =
  async ({
    userId,
    platform,
  }) => {
    const normalizedPlatform =
      normalizePlatform(
        platform
      );

    if (
      !SUPPORTED_PLATFORMS.includes(
        normalizedPlatform
      )
    ) {
      throw new Error(
        "Unsupported platform."
      );
    }

    const connection =
      await Connection.findOne(
        {
          userId,

          platform:
            normalizedPlatform,
        }
      );

    const result =
      await ffmpegService.stopStream(
        userId,
        normalizedPlatform
      );

    if (connection) {
      await updateConnectionStatus(
        {
          connectionId:
            connection._id,

          platform:
            normalizedPlatform,

          status:
            "complete",

          stoppedAt:
            new Date(),

          errorMessage:
            "",
        }
      );
    }

    return {
      platform:
        normalizedPlatform,

      ...result,
    };
  };

/* =========================================================
   STOP ALL PLATFORMS
========================================================= */

exports.stopAll =
  async (
    userId
  ) => {
    const active =
      ffmpegService.getUserProcesses(
        userId
      );

    const results =
      await ffmpegService.stopAllForUser(
        userId
      );

    const activePlatforms =
      active.map(
        (
          entry
        ) =>
          entry.platform
      );

    if (
      activePlatforms.length
    ) {
      const connections =
        await Connection.find(
          {
            userId,

            platform: {
              $in:
                activePlatforms,
            },
          }
        );

      await Promise.all(
        connections.map(
          (
            connection
          ) =>
            updateConnectionStatus(
              {
                connectionId:
                  connection._id,

                platform:
                  normalizePlatform(
                    connection
                      .platform
                  ),

                status:
                  "complete",

                stoppedAt:
                  new Date(),

                errorMessage:
                  "",
              }
            )
        )
      );
    }

    return results;
  };

/* =========================================================
   GET LIVE STATUS
========================================================= */

exports.getLiveStatus =
  async (
    userId
  ) => {
    const connections =
      await Connection.find(
        {
          userId,

          platform: {
            $in:
              SUPPORTED_PLATFORMS,
          },
        }
      )
        .select(
          [
            "platform",
            "connected",
            "instagramLiveStatus",
            "youtubeLiveStatus",
            "rumbleLiveStatus",
            "kickLiveStatus",
            "twitchLiveStatus",
            "twitterLiveStatus",
            "lastLiveStartedAt",
            "lastLiveStoppedAt",
          ].join(" ")
        )
        .lean();

    const runtime =
      ffmpegService.getUserProcesses(
        userId
      );

    const runtimeMap =
      new Map(
        runtime.map(
          (
            entry
          ) => [
            entry.platform,
            entry,
          ]
        )
      );

    return connections.map(
      (
        connection
      ) => {
        const platform =
          normalizePlatform(
            connection.platform
          );

        const config =
          PLATFORM_CONFIG[
            platform
          ];

        const runtimeEntry =
          runtimeMap.get(
            platform
          );

        return {
          platform,

          connected:
            connection.connected !==
            false,

          databaseStatus:
            connection[
              config
                .liveStatusField
            ] || "idle",

          processActive:
            Boolean(
              runtimeEntry
                ?.active
            ),

          pid:
            runtimeEntry
              ?.pid ||
            null,

          processStartedAt:
            runtimeEntry
              ?.startedAt ||
            null,

          lastLiveStartedAt:
            connection
              .lastLiveStartedAt ||
            null,

          lastLiveStoppedAt:
            connection
              .lastLiveStoppedAt ||
            null,
        };
      }
    );
  };

/* =========================================================
   RESET STALE STATUS
========================================================= */

exports.resetStaleStatuses =
  async () => {
    const updates =
      Object.entries(
        PLATFORM_CONFIG
      ).map(
        ([
          platform,
          config,
        ]) =>
          Connection.updateMany(
            {
              platform,

              [config.liveStatusField]: {
                $in: [
                  "starting",
                  "streaming",
                  "live",
                  "ready",
                ],
              },
            },
            {
              $set: {
                [config.liveStatusField]:
                  "idle",
              },
            }
          )
      );

    await Promise.all(
      updates
    );
  };

exports.normalizePlatform =
  normalizePlatform;

exports.normalizePlatforms =
  normalizePlatforms;

exports.supportedPlatforms =
  SUPPORTED_PLATFORMS;