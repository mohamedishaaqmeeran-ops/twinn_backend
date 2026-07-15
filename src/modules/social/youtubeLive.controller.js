const Connection = require(
  "../../models/Connection"
);

const socialService = require(
  "./social.service"
);

const getGoogleErrorMessage = (
  error
) => {
  return (
    error.response?.data?.error
      ?.errors?.[0]?.message ||
    error.response?.data?.error
      ?.message ||
    error.message ||
    "YouTube request failed."
  );
};

/* =========================================================
   CREATE BROADCAST AND STREAM
========================================================= */

exports.createLive = async (
  req,
  res
) => {
  try {
    const {
      title,
      description = "",
      privacyStatus = "unlisted",
      scheduledStartTime,
      madeForKids = false,
      enableAutoStart = false,
      enableAutoStop = false,
    } = req.body;

    if (
      !String(title || "").trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "YouTube live title is required.",
      });
    }

    const allowedPrivacy = [
      "private",
      "unlisted",
      "public",
    ];

    if (
      !allowedPrivacy.includes(
        privacyStatus
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Privacy status must be private, unlisted or public.",
      });
    }

    const startTime =
      scheduledStartTime
        ? new Date(
            scheduledStartTime
          )
        : new Date(
            Date.now() +
              2 * 60 * 1000
          );

    if (
      Number.isNaN(
        startTime.getTime()
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid scheduled start time.",
      });
    }

    const { youtube } =
      await socialService
        .getYouTubeClientForUser(
          req.user.id
        );

    const broadcastResponse =
      await youtube.liveBroadcasts.insert(
        {
          part: [
            "snippet",
            "status",
            "contentDetails",
          ],

          requestBody: {
            snippet: {
              title:
                String(title).trim(),

              description:
                String(
                  description
                ).trim(),

              scheduledStartTime:
                startTime.toISOString(),
            },

            status: {
              privacyStatus,

              selfDeclaredMadeForKids:
                Boolean(
                  madeForKids
                ),
            },

            contentDetails: {
              enableAutoStart:
                Boolean(
                  enableAutoStart
                ),

              enableAutoStop:
                Boolean(
                  enableAutoStop
                ),

              enableDvr: true,

              recordFromStart: true,

              monitorStream: {
                enableMonitorStream:
                  false,
              },
            },
          },
        }
      );

    const broadcast =
      broadcastResponse.data;

    let stream;

    try {
      const streamResponse =
        await youtube.liveStreams.insert(
          {
            part: [
              "snippet",
              "cdn",
              "status",
            ],

            requestBody: {
              snippet: {
                title:
                  `${String(
                    title
                  ).trim()} Stream`,
              },

              cdn: {
                ingestionType:
                  "rtmp",

                resolution:
                  "variable",

                frameRate:
                  "variable",
              },
            },
          }
        );

      stream =
        streamResponse.data;
    } catch (error) {
      /*
       * Delete the broadcast if
       * stream creation fails.
       */
      try {
        await youtube
          .liveBroadcasts.delete({
            id: broadcast.id,
          });
      } catch (_) {
        // Ignore cleanup failure.
      }

      throw error;
    }

    await youtube
      .liveBroadcasts.bind({
        part: [
          "id",
          "snippet",
          "status",
          "contentDetails",
        ],

        id: broadcast.id,

        streamId: stream.id,
      });

    const ingestionInfo =
      stream.cdn
        ?.ingestionInfo;

    if (
      !ingestionInfo
        ?.ingestionAddress ||
      !ingestionInfo?.streamName
    ) {
      throw new Error(
        "YouTube did not return RTMP ingestion information."
      );
    }

    const watchUrl =
      `https://www.youtube.com/watch?v=${broadcast.id}`;

    await Connection.updateOne(
      {
        userId: req.user.id,
        platform: "youtube",
        connected: true,
      },
      {
        $set: {
          youtubeBroadcastId:
            broadcast.id,

          youtubeStreamId:
            stream.id,

          youtubeStreamUrl:
            ingestionInfo
              .ingestionAddress,

          youtubeStreamKey:
            ingestionInfo
              .streamName,

          youtubeWatchUrl:
            watchUrl,

          youtubeLiveStatus:
            "created",
        },
      }
    );

    /*
     * Do not return the secret stream
     * key to the frontend.
     */
    return res.status(201).json({
      success: true,

      message:
        "YouTube broadcast created successfully.",

      data: {
        broadcastId:
          broadcast.id,

        streamId:
          stream.id,

        title:
          broadcast.snippet
            ?.title,

        privacyStatus:
          broadcast.status
            ?.privacyStatus,

        scheduledStartTime:
          broadcast.snippet
            ?.scheduledStartTime,

        lifeCycleStatus:
          broadcast.status
            ?.lifeCycleStatus,

        watchUrl,
      },
    });
  } catch (error) {
    console.error(
      "CREATE YOUTUBE LIVE ERROR:",
      error.response?.data ||
        error
    );

    return res.status(
      error.response?.status ||
        400
    ).json({
      success: false,
      message:
        getGoogleErrorMessage(
          error
        ),
    });
  }
};

/* =========================================================
   GET CURRENT LIVE
========================================================= */

exports.getCurrentLive =
  async (req, res) => {
    try {
      const connection =
        await Connection.findOne({
          userId: req.user.id,
          platform: "youtube",
          connected: true,
        }).lean();

      if (!connection) {
        return res.status(404).json({
          success: false,
          message:
            "YouTube is not connected.",
        });
      }

      if (
        !connection
          .youtubeBroadcastId
      ) {
        return res.json({
          success: true,
          data: null,
          message:
            "No YouTube broadcast has been created.",
        });
      }

      const { youtube } =
        await socialService
          .getYouTubeClientForUser(
            req.user.id
          );

      const response =
        await youtube
          .liveBroadcasts.list({
            part: [
              "id",
              "snippet",
              "status",
              "contentDetails",
            ],

            id: [
              connection
                .youtubeBroadcastId,
            ],
          });

      const broadcast =
        response.data
          .items?.[0];

      if (!broadcast) {
        return res.status(404).json({
          success: false,
          message:
            "YouTube broadcast was not found.",
        });
      }

      return res.json({
        success: true,

        data: {
          broadcastId:
            broadcast.id,

          streamId:
            connection
              .youtubeStreamId,

          title:
            broadcast.snippet
              ?.title,

          description:
            broadcast.snippet
              ?.description,

          privacyStatus:
            broadcast.status
              ?.privacyStatus,

          lifeCycleStatus:
            broadcast.status
              ?.lifeCycleStatus,

          scheduledStartTime:
            broadcast.snippet
              ?.scheduledStartTime,

          watchUrl:
            connection
              .youtubeWatchUrl,

          localStatus:
            connection
              .youtubeLiveStatus,
        },
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message:
          getGoogleErrorMessage(
            error
          ),
      });
    }
  };

/* =========================================================
   GET STREAM STATUS
========================================================= */

exports.getStreamStatus =
  async (req, res) => {
    try {
      const connection =
        await Connection.findOne({
          userId: req.user.id,
          platform: "youtube",
          connected: true,
        });

      if (
        !connection ||
        !connection.youtubeStreamId
      ) {
        return res.status(404).json({
          success: false,
          message:
            "No YouTube stream exists.",
        });
      }

      const { youtube } =
        await socialService
          .getYouTubeClientForUser(
            req.user.id
          );

      const response =
        await youtube
          .liveStreams.list({
            part: [
              "id",
              "snippet",
              "cdn",
              "status",
            ],

            id: [
              connection
                .youtubeStreamId,
            ],
          });

      const stream =
        response.data
          .items?.[0];

      if (!stream) {
        return res.status(404).json({
          success: false,
          message:
            "YouTube stream was not found.",
        });
      }

      const streamStatus =
        stream.status
          ?.streamStatus ||
        "inactive";

      const healthStatus =
        stream.status
          ?.healthStatus?.status ||
        "noData";

      const readyToGoLive =
        streamStatus === "active";

      if (readyToGoLive) {
        connection.youtubeLiveStatus =
          "ready";

        await connection.save();
      }

      return res.json({
        success: true,

        data: {
          streamStatus,
          healthStatus,
          readyToGoLive,

          healthIssues:
            stream.status
              ?.healthStatus
              ?.configurationIssues ||
            [],
        },
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message:
          getGoogleErrorMessage(
            error
          ),
      });
    }
  };

/* =========================================================
   TRANSITION BROADCAST TO LIVE
========================================================= */

exports.startBroadcast =
  async (req, res) => {
    try {
      const connection =
        await Connection.findOne({
          userId: req.user.id,
          platform: "youtube",
          connected: true,
        });

      if (
        !connection ||
        !connection
          .youtubeBroadcastId ||
        !connection
          .youtubeStreamId
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Create a YouTube broadcast first.",
        });
      }

      const { youtube } =
        await socialService
          .getYouTubeClientForUser(
            req.user.id
          );

      const streamResponse =
        await youtube
          .liveStreams.list({
            part: ["status"],

            id: [
              connection
                .youtubeStreamId,
            ],
          });

      const stream =
        streamResponse.data
          .items?.[0];

      const streamStatus =
        stream?.status
          ?.streamStatus;

      if (
        streamStatus !== "active"
      ) {
        return res.status(409).json({
          success: false,

          message:
            "YouTube is not receiving video yet.",

          data: {
            streamStatus:
              streamStatus ||
              "inactive",
          },
        });
      }

      const broadcastResponse =
        await youtube
          .liveBroadcasts.list({
            part: ["status"],

            id: [
              connection
                .youtubeBroadcastId,
            ],
          });

      const currentBroadcast =
        broadcastResponse.data
          .items?.[0];

      if (
        currentBroadcast?.status
          ?.lifeCycleStatus ===
        "live"
      ) {
        return res.json({
          success: true,

          message:
            "YouTube broadcast is already live.",

          data: {
            broadcastId:
              connection
                .youtubeBroadcastId,

            watchUrl:
              connection
                .youtubeWatchUrl,

            lifeCycleStatus:
              "live",
          },
        });
      }

      const response =
        await youtube
          .liveBroadcasts
          .transition({
            part: [
              "id",
              "snippet",
              "status",
            ],

            id: connection
              .youtubeBroadcastId,

            broadcastStatus:
              "live",
          });

      connection.youtubeLiveStatus =
        "live";

      await connection.save();

      return res.json({
        success: true,

        message:
          "YouTube broadcast is now live.",

        data: {
          broadcastId:
            response.data.id,

          lifeCycleStatus:
            response.data.status
              ?.lifeCycleStatus,

          watchUrl:
            connection
              .youtubeWatchUrl,
        },
      });
    } catch (error) {
      console.error(
        "START YOUTUBE BROADCAST ERROR:",
        error.response?.data ||
          error
      );

      return res.status(
        error.response?.status ||
          400
      ).json({
        success: false,
        message:
          getGoogleErrorMessage(
            error
          ),
      });
    }
  };

/* =========================================================
   COMPLETE BROADCAST
========================================================= */

exports.endBroadcast =
  async (req, res) => {
    try {
      const connection =
        await Connection.findOne({
          userId: req.user.id,
          platform: "youtube",
          connected: true,
        });

      if (
        !connection ||
        !connection
          .youtubeBroadcastId
      ) {
        return res.status(404).json({
          success: false,
          message:
            "No YouTube broadcast was found.",
        });
      }

      const { youtube } =
        await socialService
          .getYouTubeClientForUser(
            req.user.id
          );

      const broadcastResponse =
        await youtube
          .liveBroadcasts.list({
            part: ["status"],

            id: [
              connection
                .youtubeBroadcastId,
            ],
          });

      const broadcast =
        broadcastResponse.data
          .items?.[0];

      const currentStatus =
        broadcast?.status
          ?.lifeCycleStatus;

      if (
        currentStatus ===
        "complete"
      ) {
        connection.youtubeLiveStatus =
          "complete";

        await connection.save();

        return res.json({
          success: true,
          message:
            "YouTube broadcast is already complete.",
        });
      }

      if (
        currentStatus !== "live" &&
        currentStatus !== "testing"
      ) {
        connection.youtubeLiveStatus =
          "complete";

        await connection.save();

        return res.json({
          success: true,
          message:
            "YouTube stream stopped.",
        });
      }

      const response =
        await youtube
          .liveBroadcasts
          .transition({
            part: [
              "id",
              "snippet",
              "status",
            ],

            id: connection
              .youtubeBroadcastId,

            broadcastStatus:
              "complete",
          });

      connection.youtubeLiveStatus =
        "complete";

      await connection.save();

      return res.json({
        success: true,

        message:
          "YouTube broadcast ended.",

        data: {
          broadcastId:
            response.data.id,

          lifeCycleStatus:
            response.data.status
              ?.lifeCycleStatus,

          watchUrl:
            connection
              .youtubeWatchUrl,
        },
      });
    } catch (error) {
      return res.status(
        error.response?.status ||
          400
      ).json({
        success: false,
        message:
          getGoogleErrorMessage(
            error
          ),
      });
    }
  };