const fs = require("fs");
const crypto = require("crypto");

const Connection = require("../../models/Connection");
const ffmpegService = require("./ffmpeg.service");

/* =========================================================
   SUPPORTED PLATFORMS
========================================================= */

const SUPPORTED_PLATFORMS = [
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

/* =========================================================
   PLATFORM FIELD CONFIGURATION
========================================================= */

const PLATFORM_CONFIG = {
  instagram: {
    name: "Instagram",
    rtmpUrlField: "instagramRtmpUrl",
    streamKeyField: "instagramStreamKey",
    liveStatusField: "instagramLiveStatus",
  },

  facebook: {
    name: "Facebook",
    rtmpUrlField: "facebookRtmpUrl",
    streamKeyField: "facebookStreamKey",
    liveStatusField: "facebookLiveStatus",
  },

  youtube: {
    name: "YouTube",
    rtmpUrlField: "youtubeStreamUrl",
    fallbackRtmpUrlField: "youtubeRtmpUrl",
    streamKeyField: "youtubeStreamKey",
    liveStatusField: "youtubeLiveStatus",
  },

  linkedin: {
    name: "LinkedIn",
    rtmpUrlField: "linkedinRtmpUrl",
    streamKeyField: "linkedinStreamKey",
    liveStatusField: "linkedinLiveStatus",
  },

  tiktok: {
    name: "TikTok",
    rtmpUrlField: "tiktokRtmpUrl",
    streamKeyField: "tiktokStreamKey",
    liveStatusField: "tiktokLiveStatus",
  },

  rumble: {
    name: "Rumble",
    rtmpUrlField: "rumbleRtmpUrl",
    streamKeyField: "rumbleStreamKey",
    liveStatusField: "rumbleLiveStatus",
  },

  kick: {
    name: "Kick",
    rtmpUrlField: "kickRtmpUrl",
    streamKeyField: "kickStreamKey",
    liveStatusField: "kickLiveStatus",
  },

  twitch: {
    name: "Twitch",
    rtmpUrlField: "twitchRtmpUrl",
    streamKeyField: "twitchStreamKey",
    liveStatusField: "twitchLiveStatus",
  },

  twitter: {
    name: "X / Twitter",
    rtmpUrlField: "twitterRtmpUrl",
    streamKeyField: "twitterStreamKey",
    liveStatusField: "twitterLiveStatus",
  },
};

/* =========================================================
   NORMALIZE PLATFORM
========================================================= */

const normalizePlatform = (platform) => {
  const value = String(platform || "")
    .trim()
    .toLowerCase();

  if (
    value === "x" ||
    value === "twitter/x" ||
    value === "x/twitter"
  ) {
    return "twitter";
  }

  return value;
};

/* =========================================================
   NORMALIZE PLATFORM LIST
========================================================= */

const normalizePlatforms = (platforms) => {
  const list = Array.isArray(platforms)
    ? platforms
    : String(platforms || "")
        .split(",")
        .map((platform) => platform.trim());

  return [
    ...new Set(
      list
        .map(normalizePlatform)
        .filter(Boolean)
    ),
  ];
};

/* =========================================================
   VALIDATE PLATFORM LIST
========================================================= */

const validatePlatforms = (platforms) => {
  if (!platforms.length) {
    throw new Error(
      "Select at least one platform."
    );
  }

  const unsupported = platforms.filter(
    (platform) =>
      !SUPPORTED_PLATFORMS.includes(platform)
  );

  if (unsupported.length) {
    throw new Error(
      `Unsupported platforms: ${unsupported.join(", ")}`
    );
  }

  return platforms;
};

/* =========================================================
   GENERATE LIVE SESSION ID
========================================================= */

const generateSessionId = () => {
  if (
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return (
    `${Date.now().toString(36)}-` +
    crypto
      .randomBytes(8)
      .toString("hex")
  );
};

/* =========================================================
   BUILD RTMP DESTINATION URL
========================================================= */

const buildDestinationUrl = (
  rtmpUrl,
  streamKey
) => {
  const normalizedUrl = String(
    rtmpUrl || ""
  )
    .trim()
    .replace(/\/+$/, "");

  const normalizedKey = String(
    streamKey || ""
  )
    .trim()
    .replace(/^\/+/, "");

  if (
    !normalizedUrl ||
    !normalizedKey
  ) {
    throw new Error(
      "RTMP URL or stream key is missing."
    );
  }

  if (
    !normalizedUrl.startsWith("rtmp://") &&
    !normalizedUrl.startsWith("rtmps://")
  ) {
    throw new Error(
      "RTMP URL must start with rtmp:// or rtmps://."
    );
  }

  return `${normalizedUrl}/${normalizedKey}`;
};

/* =========================================================
   GET REQUIRED PRIVATE DATABASE FIELDS
========================================================= */

const getSelectedSecretFields = (
  platforms
) => {
  const fields = new Set([
    "+streamKey",
    "+rtmpUrl",
    "platform",
    "connected",
    "rtmpConfigured",
    "channelName",
    "username",
  ]);

  for (const platform of platforms) {
    const config =
      PLATFORM_CONFIG[platform];

    fields.add(
      `+${config.streamKeyField}`
    );

    fields.add(
      config.rtmpUrlField
    );

    if (
      config.fallbackRtmpUrlField
    ) {
      fields.add(
        config.fallbackRtmpUrlField
      );
    }
  }

  return [...fields].join(" ");
};

/* =========================================================
   DELETE TEMPORARY FILE
========================================================= */

const deleteTemporaryFile = (
  filePath
) => {
  if (!filePath) {
    return;
  }

  fs.unlink(
    filePath,
    (error) => {
      if (
        error &&
        error.code !== "ENOENT"
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
   SAFE ERROR MESSAGE
========================================================= */

const safeMessage = (value) => {
  const raw =
    value?.message ||
    value?.error?.message ||
    String(value || "");

  if (
    typeof ffmpegService.maskRtmpSecrets ===
    "function"
  ) {
    return ffmpegService.maskRtmpSecrets(
      raw
    );
  }

  return raw.replace(
    /rtmps?:\/\/\S+/gi,
    "[RTMP_URL_HIDDEN]"
  );
};

/* =========================================================
   READ PLATFORM RTMP URL
========================================================= */

const readRtmpUrl = (
  connection,
  config
) => {
  return (
    connection?.[config.rtmpUrlField] ||
    (
      config.fallbackRtmpUrlField
        ? connection?.[
            config.fallbackRtmpUrlField
          ]
        : null
    ) ||
    connection?.rtmpUrl ||
    null
  );
};

/* =========================================================
   READ PLATFORM STREAM KEY
========================================================= */

const readStreamKey = (
  connection,
  config
) => {
  return (
    connection?.[
      config.streamKeyField
    ] ||
    connection?.streamKey ||
    null
  );
};

/* =========================================================
   UPDATE CONNECTION LIVE STATUS
========================================================= */

const updateConnectionStatus = async ({
  connectionId,
  platform,
  status,
  sessionId,
  startedAt,
  stoppedAt,
  errorMessage,
  pid,
}) => {
  const config =
    PLATFORM_CONFIG[platform];

  if (
    !config ||
    !connectionId
  ) {
    return;
  }

  const now =
    new Date();

  const update = {
    liveStatus:
      status,

    [config.liveStatusField]:
      status,

    [`metadata.live.${platform}.status`]:
      status,

    [`metadata.live.${platform}.updatedAt`]:
      now,

    [`metadata.live.${platform}.error`]:
      errorMessage
        ? safeMessage(
            errorMessage
          ).slice(0, 2000)
        : "",
  };

  if (sessionId) {
    update[
      `metadata.live.${platform}.sessionId`
    ] =
      String(sessionId);
  }

  if (pid) {
    update[
      `metadata.live.${platform}.pid`
    ] =
      Number(pid);
  }

  if (startedAt) {
    update.lastLiveStartedAt =
      startedAt;

    update[
      `metadata.live.${platform}.startedAt`
    ] =
      startedAt;
  }

  if (stoppedAt) {
    update.lastLiveStoppedAt =
      stoppedAt;

    update[
      `metadata.live.${platform}.stoppedAt`
    ] =
      stoppedAt;
  }

  await Connection.updateOne(
    {
      _id:
        connectionId,
    },
    {
      $set:
        update,
    }
  );
};

/* =========================================================
   LOAD CONNECTIONS WITH PRIVATE STREAM KEYS
========================================================= */

const loadConnections = async (
  userId,
  platforms
) => {
  const selectFields =
    getSelectedSecretFields(
      platforms
    );

  return Connection.find({
    userId,

    platform: {
      $in:
        platforms,
    },

    connected:
      true,
  }).select(
    selectFields
  );
};

/* =========================================================
   PREPARE STREAMING DESTINATIONS
========================================================= */

const prepareDestinations = (
  platforms,
  connections
) => {
  const connectionMap =
    new Map(
      connections.map(
        (connection) => [
          normalizePlatform(
            connection.platform
          ),

          connection,
        ]
      )
    );

  return platforms.map(
    (platform) => {
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
        readRtmpUrl(
          connection,
          config
        );

      const streamKey =
        readStreamKey(
          connection,
          config
        );

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

        connection,

        outputUrl:
          buildDestinationUrl(
            rtmpUrl,
            streamKey
          ),

        metadata: {
          connectionId:
            String(
              connection._id
            ),

          channelName:
            connection.channelName ||
            null,

          username:
            connection.username ||
            null,
        },
      };
    }
  );
};

/* =========================================================
   START MULTI-PLATFORM LIVE
========================================================= */

exports.startLive = async ({
  userId,

  platforms,

  input,

  sourceType =
    "file",

  loop =
    true,

  videoBitrate =
    2000,

  audioBitrate =
    96,

  width =
    720,

  height =
    1280,

  fps =
    30,

  keyframeInterval =
    2,

  preset =
    "ultrafast",

  includeAudio =
    true,

  reconnect =
    true,

  rollbackOnFailure =
    false,

  temporaryFile =
    false,

  sessionId =
    generateSessionId(),

  metadata =
    {},
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
      (platform) =>
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

  const prepared =
    prepareDestinations(
      normalizedPlatforms,
      connections
    );

  await Promise.all(
    prepared.map(
      (destination) =>
        updateConnectionStatus({
          connectionId:
            destination
              .connection
              ._id,

          platform:
            destination
              .platform,

          status:
            "starting",

          sessionId,

          errorMessage:
            "",
        })
    )
  );

  const connectionByPlatform =
    new Map(
      prepared.map(
        (destination) => [
          destination.platform,
          destination.connection,
        ]
      )
    );

  try {
    const result =
      await ffmpegService
        .startMultiStream({
          userId,

          input,

          sourceType,

          loop,

          sessionId,

          rollbackOnFailure,

          includeAudio,

          reconnect,

          defaultVideoBitrate:
            videoBitrate,

          defaultAudioBitrate:
            audioBitrate,

          defaultWidth:
            width,

          defaultHeight:
            height,

          defaultFps:
            fps,

          defaultKeyframeInterval:
            keyframeInterval,

          defaultPreset:
            preset,

          metadata: {
            ...metadata,

            temporaryFile:
              Boolean(
                temporaryFile
              ),
          },

          destinations:
            prepared.map(
              (destination) => ({
                platform:
                  destination.platform,

                outputUrl:
                  destination.outputUrl,

                metadata:
                  destination.metadata,
              })
            ),

          onPlatformStarted:
            async (
              payload
            ) => {
              const connection =
                connectionByPlatform.get(
                  payload.platform
                );

              await updateConnectionStatus({
                connectionId:
                  connection?._id,

                platform:
                  payload.platform,

                status:
                  "started",

                sessionId,

                pid:
                  payload.pid,

                errorMessage:
                  "",
              });
            },

          onPlatformStreaming:
            async (
              payload
            ) => {
              const connection =
                connectionByPlatform.get(
                  payload.platform
                );

              await updateConnectionStatus({
                connectionId:
                  connection?._id,

                platform:
                  payload.platform,

                status:
                  "streaming",

                sessionId,

                pid:
                  payload.pid,

                startedAt:
                  payload.connectedAt ||
                  new Date(),

                errorMessage:
                  "",
              });
            },

          onPlatformError:
            async (
              payload
            ) => {
              const connection =
                connectionByPlatform.get(
                  payload.platform
                );

              await updateConnectionStatus({
                connectionId:
                  connection?._id,

                platform:
                  payload.platform,

                status:
                  "failed",

                sessionId,

                stoppedAt:
                  new Date(),

                errorMessage:
                  payload.message ||
                  payload.error,
              });
            },

          onPlatformExit:
            async (
              payload
            ) => {
              const connection =
                connectionByPlatform.get(
                  payload.platform
                );

              const cleanExit =
                payload.code ===
                  0 ||
                payload.signal ===
                  "SIGTERM" ||
                payload.signal ===
                  "SIGKILL";

              await updateConnectionStatus({
                connectionId:
                  connection?._id,

                platform:
                  payload.platform,

                status:
                  cleanExit
                    ? "complete"
                    : "failed",

                sessionId,

                stoppedAt:
                  payload.stoppedAt ||
                  new Date(),

                errorMessage:
                  cleanExit
                    ? ""
                    : payload.errorMessage ||
                      payload.stderr ||
                      "FFmpeg stopped unexpectedly.",
              });
            },
        });

    return {
      success:
        result.success,

      partialSuccess:
        result.partialSuccess,

      sessionId:
        result.sessionId,

      total:
        result.total,

      started:
        result.started,

      failed:
        result.failed,

      results:
        result.results,

      input,

      sourceType,

      loop:
        Boolean(loop),

      temporaryFile:
        Boolean(
          temporaryFile
        ),
    };
  } catch (error) {
    await Promise.allSettled(
      prepared.map(
        (destination) =>
          updateConnectionStatus({
            connectionId:
              destination
                .connection
                ._id,

            platform:
              destination
                .platform,

            status:
              "failed",

            sessionId,

            stoppedAt:
              new Date(),

            errorMessage:
              error,
          })
      )
    );

    if (temporaryFile) {
      deleteTemporaryFile(
        input
      );
    }

    throw error;
  }
};

/* =========================================================
   ADD PLATFORM TO ACTIVE SESSION
========================================================= */

exports.addPlatform = async ({
  userId,

  sessionId,

  platform,

  input,

  sourceType =
    "file",

  loop =
    false,

  videoBitrate,

  audioBitrate,

  width,

  height,

  fps,

  keyframeInterval,

  preset,

  includeAudio =
    true,

  reconnect =
    true,

  metadata =
    {},
}) => {
  if (
    !userId ||
    !sessionId ||
    !input
  ) {
    throw new Error(
      "User ID, session ID and video input are required."
    );
  }

  const normalizedPlatform =
    normalizePlatform(
      platform
    );

  validatePlatforms([
    normalizedPlatform,
  ]);

  const connections =
    await loadConnections(
      userId,
      [
        normalizedPlatform,
      ]
    );

  const [
    destination,
  ] =
    prepareDestinations(
      [
        normalizedPlatform,
      ],
      connections
    );

  await updateConnectionStatus({
    connectionId:
      destination
        .connection
        ._id,

    platform:
      normalizedPlatform,

    status:
      "starting",

    sessionId,

    errorMessage:
      "",
  });

  try {
    return await ffmpegService
      .addPlatformToSession({
        userId,

        sessionId,

        platform:
          normalizedPlatform,

        input,

        outputUrl:
          destination.outputUrl,

        sourceType,

        loop,

        videoBitrate,

        audioBitrate,

        width,

        height,

        fps,

        keyframeInterval,

        preset,

        includeAudio,

        reconnect,

        metadata,

        onStarted:
          async (
            payload
          ) => {
            await updateConnectionStatus({
              connectionId:
                destination
                  .connection
                  ._id,

              platform:
                normalizedPlatform,

              status:
                "started",

              sessionId,

              pid:
                payload.pid,
            });
          },

        onStreaming:
          async (
            payload
          ) => {
            await updateConnectionStatus({
              connectionId:
                destination
                  .connection
                  ._id,

              platform:
                normalizedPlatform,

              status:
                "streaming",

              sessionId,

              pid:
                payload.pid,

              startedAt:
                payload.connectedAt ||
                new Date(),
            });
          },

        onError:
          async (
            payload
          ) => {
            await updateConnectionStatus({
              connectionId:
                destination
                  .connection
                  ._id,

              platform:
                normalizedPlatform,

              status:
                "failed",

              sessionId,

              stoppedAt:
                new Date(),

              errorMessage:
                payload.message ||
                payload.error,
            });
          },

        onExit:
          async (
            payload
          ) => {
            const cleanExit =
              payload.code ===
                0 ||
              payload.signal ===
                "SIGTERM" ||
              payload.signal ===
                "SIGKILL";

            await updateConnectionStatus({
              connectionId:
                destination
                  .connection
                  ._id,

              platform:
                normalizedPlatform,

              status:
                cleanExit
                  ? "complete"
                  : "failed",

              sessionId,

              stoppedAt:
                payload.stoppedAt ||
                new Date(),

              errorMessage:
                cleanExit
                  ? ""
                  : payload.errorMessage ||
                    payload.stderr ||
                    "FFmpeg stopped unexpectedly.",
            });
          },
      });
  } catch (error) {
    await updateConnectionStatus({
      connectionId:
        destination
          .connection
          ._id,

      platform:
        normalizedPlatform,

      status:
        "failed",

      sessionId,

      stoppedAt:
        new Date(),

      errorMessage:
        error,
    });

    throw error;
  }
};

/* =========================================================
   STOP ONE PLATFORM
========================================================= */

exports.stopPlatform = async ({
  userId,

  platform,

  sessionId =
    null,
}) => {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  const normalizedPlatform =
    normalizePlatform(
      platform
    );

  validatePlatforms([
    normalizedPlatform,
  ]);

  const connection =
    await Connection.findOne({
      userId,

      platform:
        normalizedPlatform,
    });

  const result =
    sessionId
      ? await ffmpegService
          .removePlatformFromSession(
            userId,
            sessionId,
            normalizedPlatform
          )
      : await ffmpegService
          .stopStream(
            userId,
            normalizedPlatform
          );

  if (connection) {
    await updateConnectionStatus({
      connectionId:
        connection._id,

      platform:
        normalizedPlatform,

      status:
        "complete",

      sessionId,

      stoppedAt:
        new Date(),

      errorMessage:
        "",
    });
  }

  return {
    platform:
      normalizedPlatform,

    sessionId,

    ...result,
  };
};

/* =========================================================
   STOP SESSION
========================================================= */

exports.stopSession = async ({
  userId,

  sessionId,

  temporaryFilePath =
    null,
}) => {
  if (
    !userId ||
    !sessionId
  ) {
    throw new Error(
      "User ID and session ID are required."
    );
  }

  const active =
    ffmpegService
      .getSessionProcesses(
        userId,
        sessionId
      );

  const result =
    await ffmpegService
      .stopAllForSession(
        userId,
        sessionId
      );

  const activePlatforms =
    active.map(
      (entry) =>
        entry.platform
    );

  if (
    activePlatforms.length
  ) {
    const connections =
      await Connection.find({
        userId,

        platform: {
          $in:
            activePlatforms,
        },
      });

    await Promise.allSettled(
      connections.map(
        (connection) =>
          updateConnectionStatus({
            connectionId:
              connection._id,

            platform:
              normalizePlatform(
                connection.platform
              ),

            status:
              "complete",

            sessionId,

            stoppedAt:
              new Date(),

            errorMessage:
              "",
          })
      )
    );
  }

  if (temporaryFilePath) {
    deleteTemporaryFile(
      temporaryFilePath
    );
  }

  return result;
};

/* =========================================================
   STOP ALL USER STREAMS
========================================================= */

exports.stopAll = async (
  userId,
  {
    temporaryFilePaths =
      [],
  } = {}
) => {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  const active =
    ffmpegService
      .getUserProcesses(
        userId
      );

  const result =
    await ffmpegService
      .stopAllForUser(
        userId
      );

  const activePlatforms = [
    ...new Set(
      active.map(
        (entry) =>
          entry.platform
      )
    ),
  ];

  if (
    activePlatforms.length
  ) {
    const connections =
      await Connection.find({
        userId,

        platform: {
          $in:
            activePlatforms,
        },
      });

    await Promise.allSettled(
      connections.map(
        (connection) =>
          updateConnectionStatus({
            connectionId:
              connection._id,

            platform:
              normalizePlatform(
                connection.platform
              ),

            status:
              "complete",

            stoppedAt:
              new Date(),

            errorMessage:
              "",
          })
      )
    );
  }

  for (
    const filePath
    of temporaryFilePaths
  ) {
    deleteTemporaryFile(
      filePath
    );
  }

  return result;
};

/* =========================================================
   GET LIVE STATUS
========================================================= */

exports.getLiveStatus = async (
  userId
) => {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  const statusFields = [
    "platform",
    "connected",
    "liveStatus",
    "lastLiveStartedAt",
    "lastLiveStoppedAt",

    ...SUPPORTED_PLATFORMS.map(
      (platform) =>
        PLATFORM_CONFIG[
          platform
        ].liveStatusField
    ),
  ];

  const connections =
    await Connection.find({
      userId,

      platform: {
        $in:
          SUPPORTED_PLATFORMS,
      },
    })
      .select(
        statusFields.join(
          " "
        )
      )
      .lean();

  const runtime =
    ffmpegService
      .getUserProcesses(
        userId
      );

  const runtimeMap =
    new Map(
      runtime.map(
        (entry) => [
          entry.platform,
          entry,
        ]
      )
    );

  return connections.map(
    (connection) => {
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
            config.liveStatusField
          ] ||
          connection.liveStatus ||
          "idle",

        processActive:
          Boolean(
            runtimeEntry?.active
          ),

        runtimeStatus:
          runtimeEntry?.status ||
          "stopped",

        sessionId:
          runtimeEntry?.sessionId ||
          null,

        pid:
          runtimeEntry?.pid ||
          null,

        processStartedAt:
          runtimeEntry?.startedAt ||
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
   GET SESSION STATUS
========================================================= */

exports.getSessionStatus = (
  userId,
  sessionId
) => {
  if (
    !userId ||
    !sessionId
  ) {
    throw new Error(
      "User ID and session ID are required."
    );
  }

  return ffmpegService
    .getMultiStreamStatus(
      userId,
      sessionId
    );
};

/* =========================================================
   WAIT UNTIL SESSION IS STREAMING
========================================================= */

exports.waitForSessionStreaming =
  async (
    userId,
    sessionId,
    options =
      {}
  ) => {
    if (
      !userId ||
      !sessionId
    ) {
      throw new Error(
        "User ID and session ID are required."
      );
    }

    return ffmpegService
      .waitForSessionStreaming(
        userId,
        sessionId,
        options
      );
  };

/* =========================================================
   GET USER LIVE SESSIONS
========================================================= */

exports.getUserSessions = (
  userId
) => {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  return ffmpegService
    .getUserSessions(
      userId
    );
};

/* =========================================================
   GET PLATFORM HEALTH
========================================================= */

exports.getPlatformHealth = (
  userId,
  platform
) => {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  const normalizedPlatform =
    normalizePlatform(
      platform
    );

  validatePlatforms([
    normalizedPlatform,
  ]);

  return ffmpegService
    .getStreamHealth(
      userId,
      normalizedPlatform
    );
};

/* =========================================================
   GET USER STREAM HEALTH
========================================================= */

exports.getUserStreamHealth = (
  userId
) => {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  return ffmpegService
    .getUserStreamHealth(
      userId
    );
};

/* =========================================================
   CHECK PLATFORM STREAMING
========================================================= */

exports.isStreaming = (
  userId,
  platform
) => {
  if (!userId) {
    return false;
  }

  const normalizedPlatform =
    normalizePlatform(
      platform
    );

  if (
    !SUPPORTED_PLATFORMS.includes(
      normalizedPlatform
    )
  ) {
    return false;
  }

  return ffmpegService
    .isStreaming(
      userId,
      normalizedPlatform
    );
};

/* =========================================================
   RESTART PLATFORM STREAM
========================================================= */

exports.restartPlatform = async ({
  userId,

  platform,

  input,

  sourceType =
    "file",

  loop =
    false,

  sessionId =
    null,

  videoBitrate,

  audioBitrate,

  width,

  height,

  fps,

  keyframeInterval,

  preset,

  includeAudio =
    true,

  reconnect =
    true,

  metadata =
    {},
}) => {
  if (
    !userId ||
    !platform ||
    !input
  ) {
    throw new Error(
      "User ID, platform and input are required."
    );
  }

  const normalizedPlatform =
    normalizePlatform(
      platform
    );

  validatePlatforms([
    normalizedPlatform,
  ]);

  const connections =
    await loadConnections(
      userId,
      [
        normalizedPlatform,
      ]
    );

  const [
    destination,
  ] =
    prepareDestinations(
      [
        normalizedPlatform,
      ],
      connections
    );

  await updateConnectionStatus({
    connectionId:
      destination
        .connection
        ._id,

    platform:
      normalizedPlatform,

    status:
      "restarting",

    sessionId,

    errorMessage:
      "",
  });

  try {
    const result =
      await ffmpegService
        .restartPlatformStream({
          userId,

          platform:
            normalizedPlatform,

          input,

          outputUrl:
            destination.outputUrl,

          sourceType,

          loop,

          sessionId,

          videoBitrate,

          audioBitrate,

          width,

          height,

          fps,

          keyframeInterval,

          preset,

          includeAudio,

          reconnect,

          metadata,

          onStarted:
            async (
              payload
            ) => {
              await updateConnectionStatus({
                connectionId:
                  destination
                    .connection
                    ._id,

                platform:
                  normalizedPlatform,

                status:
                  "started",

                sessionId,

                pid:
                  payload.pid,

                errorMessage:
                  "",
              });
            },

          onStreaming:
            async (
              payload
            ) => {
              await updateConnectionStatus({
                connectionId:
                  destination
                    .connection
                    ._id,

                platform:
                  normalizedPlatform,

                status:
                  "streaming",

                sessionId,

                pid:
                  payload.pid,

                startedAt:
                  payload.connectedAt ||
                  new Date(),

                errorMessage:
                  "",
              });
            },

          onError:
            async (
              payload
            ) => {
              await updateConnectionStatus({
                connectionId:
                  destination
                    .connection
                    ._id,

                platform:
                  normalizedPlatform,

                status:
                  "failed",

                sessionId,

                stoppedAt:
                  new Date(),

                errorMessage:
                  payload.message ||
                  payload.error,
              });
            },

          onExit:
            async (
              payload
            ) => {
              const cleanExit =
                payload.code ===
                  0 ||
                payload.signal ===
                  "SIGTERM" ||
                payload.signal ===
                  "SIGKILL";

              await updateConnectionStatus({
                connectionId:
                  destination
                    .connection
                    ._id,

                platform:
                  normalizedPlatform,

                status:
                  cleanExit
                    ? "complete"
                    : "failed",

                sessionId,

                stoppedAt:
                  payload.stoppedAt ||
                  new Date(),

                errorMessage:
                  cleanExit
                    ? ""
                    : payload.errorMessage ||
                      payload.stderr ||
                      "FFmpeg stopped unexpectedly.",
              });
            },
        });

    return result;
  } catch (error) {
    await updateConnectionStatus({
      connectionId:
        destination
          .connection
          ._id,

      platform:
        normalizedPlatform,

      status:
        "failed",

      sessionId,

      stoppedAt:
        new Date(),

      errorMessage:
        error,
    });

    throw error;
  }
};

/* =========================================================
   RESET STALE DATABASE STATUSES
========================================================= */

exports.resetStaleStatuses =
  async () => {
    const activeStates = [
      "starting",
      "started",
      "restarting",
      "streaming",
      "live",
      "ready",
      "stopping",
    ];

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

              $or: [
                {
                  [config.liveStatusField]:
                    {
                      $in:
                        activeStates,
                    },
                },

                {
                  liveStatus: {
                    $in:
                      activeStates,
                  },
                },
              ],
            },
            {
              $set: {
                [config.liveStatusField]:
                  "idle",

                liveStatus:
                  "idle",

                [`metadata.live.${platform}.status`]:
                  "idle",

                [`metadata.live.${platform}.updatedAt`]:
                  new Date(),

                [`metadata.live.${platform}.error`]:
                  "",

                [`metadata.live.${platform}.pid`]:
                  null,

                [`metadata.live.${platform}.sessionId`]:
                  null,
              },
            }
          )
      );

    const results =
      await Promise.all(
        updates
      );

    return {
      success:
        true,

      platforms:
        SUPPORTED_PLATFORMS,

      modifiedCount:
        results.reduce(
          (
            total,
            result
          ) =>
            total +
            (
              result.modifiedCount ||
              0
            ),
          0
        ),
    };
  };

/* =========================================================
   CLEANUP STALE RUNTIME PROCESSES
========================================================= */

exports.cleanupStaleProcesses =
  () => {
    return ffmpegService
      .cleanupStaleProcesses();
  };

/* =========================================================
   SHUTDOWN ALL FFMPEG STREAMS
========================================================= */

exports.shutdown = async (
  options =
    {}
) => {
  return ffmpegService
    .shutdown(
      options
    );
};

/* =========================================================
   EXPORT HELPERS
========================================================= */

exports.normalizePlatform =
  normalizePlatform;

exports.normalizePlatforms =
  normalizePlatforms;

exports.validatePlatforms =
  validatePlatforms;

exports.generateSessionId =
  generateSessionId;

exports.buildDestinationUrl =
  buildDestinationUrl;

exports.loadConnections =
  loadConnections;

exports.prepareDestinations =
  prepareDestinations;

exports.updateConnectionStatus =
  updateConnectionStatus;

exports.deleteTemporaryFile =
  deleteTemporaryFile;

exports.safeMessage =
  safeMessage;

exports.supportedPlatforms =
  SUPPORTED_PLATFORMS;

exports.platformConfig =
  PLATFORM_CONFIG;