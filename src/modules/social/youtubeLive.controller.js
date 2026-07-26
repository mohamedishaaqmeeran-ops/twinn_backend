// modules/social/youtubeLive.controller.js

const socialService =
  require(
    "./social.service"
  );

const Connection =
  require(
    "../../models/Connection"
  );

/* =========================================================
   HELPERS
========================================================= */

const getUserId = (
  req
) => {
  return (
    req.user?.id ||
    req.user?._id
  );
};

const sanitizePrivacyStatus = (
  value
) => {
  const allowed = [
    "public",
    "private",
    "unlisted",
  ];

  const normalized =
    String(
      value || "public"
    )
      .trim()
      .toLowerCase();

  return allowed.includes(
    normalized
  )
    ? normalized
    : "public";
};

const sanitizeDate = (
  value
) => {
  if (!value) {
    return new Date(
      Date.now() +
        2 *
          60 *
          1000
    ).toISOString();
  }

  const parsedDate =
    new Date(
      value
    );

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    throw new Error(
      "Invalid scheduled start time."
    );
  }

  const minimumTime =
    Date.now() +
    30 * 1000;

  if (
    parsedDate.getTime() <
    minimumTime
  ) {
    return new Date(
      Date.now() +
        2 *
          60 *
          1000
    ).toISOString();
  }

  return parsedDate.toISOString();
};

const buildSafeLiveData = (
  connection
) => {
  return {
    platform:
      "youtube",

    connected:
      Boolean(
        connection?.connected
      ),

    channelId:
      connection
        ?.youtubeChannelId ||
      "",

    channelTitle:
      connection
        ?.youtubeChannelTitle ||
      "",

    broadcastId:
      connection
        ?.youtubeBroadcastId ||
      "",

    streamId:
      connection
        ?.youtubeStreamId ||
      "",

    streamUrl:
      connection
        ?.youtubeStreamUrl ||
      "",

    watchUrl:
      connection
        ?.youtubeWatchUrl ||
      "",

    liveStatus:
      connection
        ?.youtubeLiveStatus ||
      "idle",

    streamConfigured:
      Boolean(
        connection
          ?.youtubeStreamUrl &&
        connection
          ?.youtubeStreamKey
      ),

    lastLiveStartedAt:
      connection
        ?.lastLiveStartedAt ||
      null,

    lastLiveStoppedAt:
      connection
        ?.lastLiveStoppedAt ||
      null,
  };
};

const getYouTubeConnection =
  async (
    userId,
    includeStreamKey =
      false
  ) => {
    let query =
      Connection.findOne(
        {
          userId,

          platform:
            "youtube",

          connected:
            true,
        }
      );

    if (
      includeStreamKey
    ) {
      query =
        query.select(
          "+youtubeStreamKey"
        );
    }

    return query;
  };

const getBroadcastStatus =
  async (
    youtube,
    broadcastId
  ) => {
    if (!broadcastId) {
      return null;
    }

    const response =
      await youtube.liveBroadcasts.list(
        {
          part: [
            "id",
            "snippet",
            "status",
            "contentDetails",
          ],

          id: [
            broadcastId,
          ],
        }
      );

    return (
      response.data
        .items?.[0] ||
      null
    );
  };

const getStreamStatus =
  async (
    youtube,
    streamId
  ) => {
    if (!streamId) {
      return null;
    }

    const response =
      await youtube.liveStreams.list(
        {
          part: [
            "id",
            "snippet",
            "status",
            "cdn",
          ],

          id: [
            streamId,
          ],
        }
      );

    return (
      response.data
        .items?.[0] ||
      null
    );
  };

const mapYouTubeStatus = ({
  broadcast,
  stream,
}) => {
  const lifecycleStatus =
    broadcast?.status
      ?.lifeCycleStatus ||
    "";

  const streamStatus =
    stream?.status
      ?.streamStatus ||
    "";

  if (
    lifecycleStatus ===
    "complete"
  ) {
    return "complete";
  }

  if (
    lifecycleStatus ===
    "live"
  ) {
    return "live";
  }

  if (
    streamStatus ===
      "active" ||
    streamStatus ===
      "ready"
  ) {
    return "ready";
  }

  if (
    lifecycleStatus ===
      "ready" ||
    lifecycleStatus ===
      "testing"
  ) {
    return "ready";
  }

  if (
    lifecycleStatus ===
    "created"
  ) {
    return "created";
  }

  return "idle";
};

/* =========================================================
   CREATE YOUTUBE LIVE
========================================================= */

exports.createLive =
  async (
    req,
    res
  ) => {
    let connection =
      null;

    try {
      const userId =
        getUserId(
          req
        );

      if (!userId) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Please log in.",
          });
      }

      const {
        youtube,
        connection:
          youtubeConnection,
      } =
        await socialService
          .getYouTubeClientForUser(
            userId
          );

      connection =
        youtubeConnection;

      const title =
        String(
          req.body.title ||
          "Twinn AI Live"
        )
          .trim()
          .slice(
            0,
            100
          );

      const description =
        String(
          req.body
            .description ||
          "Live stream powered by Twinn."
        )
          .trim()
          .slice(
            0,
            5000
          );

      const privacyStatus =
        sanitizePrivacyStatus(
          req.body
            .privacyStatus
        );

      const scheduledStartTime =
        sanitizeDate(
          req.body
            .scheduledStartTime
        );

      const madeForKids =
        Boolean(
          req.body
            .madeForKids
        );

      const enableAutoStart =
        req.body
          .enableAutoStart !==
        false;

      const enableAutoStop =
        req.body
          .enableAutoStop !==
        false;

      connection
        .youtubeLiveStatus =
        "created";

      await connection.save();

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
                title,

                description,

                scheduledStartTime,
              },

              status: {
                privacyStatus,

                selfDeclaredMadeForKids:
                  madeForKids,
              },

              contentDetails: {
                enableAutoStart,

                enableAutoStop,

                enableDvr:
                  true,

                recordFromStart:
                  true,

                monitorStream: {
                  enableMonitorStream:
                    false,
                },
              },
            },
          }
        );

      const broadcast =
        broadcastResponse
          .data;

      if (
        !broadcast?.id
      ) {
        throw new Error(
          "YouTube did not return a broadcast ID."
        );
      }

      const streamResponse =
        await youtube.liveStreams.insert(
          {
            part: [
              "snippet",
              "cdn",
              "contentDetails",
              "status",
            ],

            requestBody: {
              snippet: {
                title:
                  `${title} Stream`,
              },

              cdn: {
                ingestionType:
                  "rtmp",

                resolution:
                  "variable",

                frameRate:
                  "variable",
              },

              contentDetails: {
                isReusable:
                  false,
              },
            },
          }
        );

      const stream =
        streamResponse.data;

      if (
        !stream?.id
      ) {
        throw new Error(
          "YouTube did not return a stream ID."
        );
      }

      await youtube.liveBroadcasts.bind(
        {
          part: [
            "id",
            "snippet",
            "status",
            "contentDetails",
          ],

          id:
            broadcast.id,

          streamId:
            stream.id,
        }
      );

      const ingestionInfo =
        stream.cdn
          ?.ingestionInfo ||
        {};

      const ingestionAddress =
        ingestionInfo
          .ingestionAddress ||
        ingestionInfo
          .backupIngestionAddress ||
        "";

      const streamKey =
        ingestionInfo
          .streamName ||
        "";

      if (
        !ingestionAddress ||
        !streamKey
      ) {
        throw new Error(
          "YouTube did not return RTMP ingestion credentials."
        );
      }

      connection
        .youtubeBroadcastId =
        broadcast.id;

      connection
        .youtubeStreamId =
        stream.id;

      connection
        .youtubeStreamUrl =
        ingestionAddress.replace(
          /\/+$/,
          ""
        );

      connection
        .youtubeStreamKey =
        streamKey.replace(
          /^\/+/,
          ""
        );

      connection
        .youtubeWatchUrl =
        `https://www.youtube.com/watch?v=${broadcast.id}`;

      connection
        .youtubeLiveStatus =
        "created";

      connection.metadata = {
        ...connection.metadata,

        youtubeLive: {
          title,

          description,

          privacyStatus,

          scheduledStartTime,

          madeForKids,

          enableAutoStart,

          enableAutoStop,

          broadcastLifecycleStatus:
            broadcast.status
              ?.lifeCycleStatus ||
            "created",

          streamStatus:
            stream.status
              ?.streamStatus ||
            "inactive",

          createdAt:
            new Date(),
        },
      };

      await connection.save();

      return res
        .status(201)
        .json({
          success:
            true,

          message:
            "YouTube live stream created successfully.",

          data: {
            broadcastId:
              broadcast.id,

            streamId:
              stream.id,

            watchUrl:
              connection
                .youtubeWatchUrl,

            rtmpUrl:
              connection
                .youtubeStreamUrl,

            streamKey,

            liveStatus:
              connection
                .youtubeLiveStatus,

            scheduledStartTime,

            privacyStatus,
          },
        });
    } catch (error) {
      console.error(
        "CREATE YOUTUBE LIVE ERROR:",
        error.response?.data ||
        error
      );

      if (connection) {
        connection
          .youtubeLiveStatus =
          "failed";

        await connection
          .save()
          .catch(
            () => null
          );
      }

      const apiReason =
        error.response?.data
          ?.error?.errors?.[0]
          ?.reason;

      const apiMessage =
        error.response?.data
          ?.error?.message;

      if (
        apiReason ===
          "liveStreamingNotEnabled" ||
        apiReason ===
          "livePermissionBlocked"
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "YouTube Live Streaming is not enabled for this channel. Enable live streaming in YouTube Studio and try again.",
          });
      }

      if (
        error.code ===
          403 ||
        error.response
          ?.status === 403
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              apiMessage ||
              "YouTube rejected the live stream request. Check channel permissions, verification and live-stream eligibility.",
          });
      }

      return res
        .status(
          error.response
            ?.status ||
            500
        )
        .json({
          success:
            false,

          message:
            apiMessage ||
            error.message ||
            "Unable to create YouTube live stream.",
        });
    }
  };

/* =========================================================
   GET CURRENT YOUTUBE LIVE
========================================================= */

exports.getCurrentLive =
  async (
    req,
    res
  ) => {
    try {
      const userId =
        getUserId(
          req
        );

      if (!userId) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Please log in.",
          });
      }

      const connection =
        await getYouTubeConnection(
          userId,
          false
        );

      if (!connection) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "YouTube is not connected.",
          });
      }

      return res.json({
        success:
          true,

        data:
          buildSafeLiveData(
            connection
          ),
      });
    } catch (error) {
      console.error(
        "GET CURRENT YOUTUBE LIVE ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            error.message ||
            "Unable to load the current YouTube live stream.",
        });
    }
  };

/* =========================================================
   GET YOUTUBE STREAM STATUS
========================================================= */

exports.getStreamStatus =
  async (
    req,
    res
  ) => {
    try {
      const userId =
        getUserId(
          req
        );

      if (!userId) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Please log in.",
          });
      }

      const {
        youtube,
        connection,
      } =
        await socialService
          .getYouTubeClientForUser(
            userId
          );

      if (
        !connection
          .youtubeBroadcastId ||
        !connection
          .youtubeStreamId
      ) {
        return res.json({
          success:
            true,

          data: {
            ...buildSafeLiveData(
              connection
            ),

            broadcastStatus:
              null,

            streamStatus:
              null,
          },
        });
      }

      const [
        broadcast,
        stream,
      ] =
        await Promise.all([
          getBroadcastStatus(
            youtube,
            connection
              .youtubeBroadcastId
          ),

          getStreamStatus(
            youtube,
            connection
              .youtubeStreamId
          ),
        ]);

      const mappedStatus =
        mapYouTubeStatus(
          {
            broadcast,
            stream,
          }
        );

      connection
        .youtubeLiveStatus =
        mappedStatus;

      connection.metadata = {
        ...connection.metadata,

        youtubeLive: {
          ...connection
            .metadata
            ?.youtubeLive,

          broadcastLifecycleStatus:
            broadcast?.status
              ?.lifeCycleStatus ||
            "",

          broadcastPrivacyStatus:
            broadcast?.status
              ?.privacyStatus ||
            "",

          streamStatus:
            stream?.status
              ?.streamStatus ||
            "",

          healthStatus:
            stream?.status
              ?.healthStatus
              ?.status ||
            "",

          lastStatusCheckAt:
            new Date(),
        },
      };

      await connection.save();

      return res.json({
        success:
          true,

        data: {
          ...buildSafeLiveData(
            connection
          ),

          broadcastStatus:
            broadcast?.status ||
            null,

          streamStatus:
            stream?.status ||
            null,

          lifecycleStatus:
            broadcast?.status
              ?.lifeCycleStatus ||
            "",

          ingestionStatus:
            stream?.status
              ?.streamStatus ||
            "",

          healthStatus:
            stream?.status
              ?.healthStatus
              ?.status ||
            "",
        },
      });
    } catch (error) {
      console.error(
        "GET YOUTUBE STATUS ERROR:",
        error.response?.data ||
        error
      );

      return res
        .status(
          error.response
            ?.status ||
            500
        )
        .json({
          success:
            false,

          message:
            error.response?.data
              ?.error?.message ||
            error.message ||
            "Unable to check YouTube stream status.",
        });
    }
  };

/* =========================================================
   START YOUTUBE BROADCAST
========================================================= */

exports.startBroadcast =
  async (
    req,
    res
  ) => {
    try {
      const userId =
        getUserId(
          req
        );

      if (!userId) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Please log in.",
          });
      }

      const {
        youtube,
        connection,
      } =
        await socialService
          .getYouTubeClientForUser(
            userId
          );

      if (
        !connection
          .youtubeBroadcastId
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Create a YouTube live stream first.",
          });
      }

      const stream =
        await getStreamStatus(
          youtube,
          connection
            .youtubeStreamId
        );

      const streamStatus =
        stream?.status
          ?.streamStatus ||
        "";

      if (
        ![
          "active",
          "ready",
        ].includes(
          streamStatus
        )
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            message:
              `YouTube is not receiving the stream yet. Current ingestion status: ${
                streamStatus ||
                "inactive"
              }. Start FFmpeg first and wait until the stream becomes active.`,
          });
      }

      const currentBroadcast =
        await getBroadcastStatus(
          youtube,
          connection
            .youtubeBroadcastId
        );

      const lifecycleStatus =
        currentBroadcast
          ?.status
          ?.lifeCycleStatus ||
        "";

      if (
        lifecycleStatus ===
        "live"
      ) {
        connection
          .youtubeLiveStatus =
          "live";

        await connection.save();

        return res.json({
          success:
            true,

          message:
            "YouTube broadcast is already live.",

          data:
            buildSafeLiveData(
              connection
            ),
        });
      }

      if (
        lifecycleStatus ===
        "complete"
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            message:
              "This YouTube broadcast is already complete. Create a new live stream.",
          });
      }

      const transitionResponse =
        await youtube
          .liveBroadcasts
          .transition(
            {
              part: [
                "id",
                "snippet",
                "status",
                "contentDetails",
              ],

              id:
                connection
                  .youtubeBroadcastId,

              broadcastStatus:
                "live",
            }
          );

      connection
        .youtubeLiveStatus =
        "live";

      connection
        .lastLiveStartedAt =
        new Date();

      connection.metadata = {
        ...connection.metadata,

        youtubeLive: {
          ...connection
            .metadata
            ?.youtubeLive,

          broadcastLifecycleStatus:
            transitionResponse
              .data
              ?.status
              ?.lifeCycleStatus ||
            "live",

          startedAt:
            new Date(),
        },
      };

      await connection.save();

      return res.json({
        success:
          true,

        message:
          "YouTube broadcast started successfully.",

        data: {
          ...buildSafeLiveData(
            connection
          ),

          broadcast:
            transitionResponse
              .data,
        },
      });
    } catch (error) {
      console.error(
        "START YOUTUBE BROADCAST ERROR:",
        error.response?.data ||
        error
      );

      const reason =
        error.response?.data
          ?.error?.errors?.[0]
          ?.reason;

      let message =
        error.response?.data
          ?.error?.message ||
        error.message ||
        "Unable to start YouTube broadcast.";

      if (
        reason ===
        "errorStreamInactive"
      ) {
        message =
          "YouTube is not receiving video yet. Start FFmpeg and wait until the stream status becomes active.";
      }

      if (
        reason ===
        "redundantTransition"
      ) {
        message =
          "The YouTube broadcast is already in the requested state.";
      }

      return res
        .status(
          error.response
            ?.status ||
            500
        )
        .json({
          success:
            false,

          message,
        });
    }
  };

/* =========================================================
   END YOUTUBE BROADCAST
========================================================= */

exports.endBroadcast =
  async (
    req,
    res
  ) => {
    try {
      const userId =
        getUserId(
          req
        );

      if (!userId) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Please log in.",
          });
      }

      const {
        youtube,
        connection,
      } =
        await socialService
          .getYouTubeClientForUser(
            userId
          );

      if (
        !connection
          .youtubeBroadcastId
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "No YouTube broadcast is available to end.",
          });
      }

      const broadcast =
        await getBroadcastStatus(
          youtube,
          connection
            .youtubeBroadcastId
        );

      const lifecycleStatus =
        broadcast?.status
          ?.lifeCycleStatus ||
        "";

      if (
        lifecycleStatus !==
        "complete"
      ) {
        await youtube
          .liveBroadcasts
          .transition(
            {
              part: [
                "id",
                "snippet",
                "status",
                "contentDetails",
              ],

              id:
                connection
                  .youtubeBroadcastId,

              broadcastStatus:
                "complete",
            }
          );
      }

      connection
        .youtubeLiveStatus =
        "complete";

      connection
        .lastLiveStoppedAt =
        new Date();

      connection.metadata = {
        ...connection.metadata,

        youtubeLive: {
          ...connection
            .metadata
            ?.youtubeLive,

          broadcastLifecycleStatus:
            "complete",

          stoppedAt:
            new Date(),
        },
      };

      await connection.save();

      return res.json({
        success:
          true,

        message:
          "YouTube broadcast ended successfully.",

        data:
          buildSafeLiveData(
            connection
          ),
      });
    } catch (error) {
      console.error(
        "END YOUTUBE BROADCAST ERROR:",
        error.response?.data ||
        error
      );

      const reason =
        error.response?.data
          ?.error?.errors?.[0]
          ?.reason;

      if (
        reason ===
        "redundantTransition"
      ) {
        await Connection.findOneAndUpdate(
          {
            userId:
              getUserId(
                req
              ),

            platform:
              "youtube",
          },
          {
            $set: {
              youtubeLiveStatus:
                "complete",

              lastLiveStoppedAt:
                new Date(),
            },
          }
        );

        return res.json({
          success:
            true,

          message:
            "YouTube broadcast is already complete.",
        });
      }

      return res
        .status(
          error.response
            ?.status ||
            500
        )
        .json({
          success:
            false,

          message:
            error.response?.data
              ?.error?.message ||
            error.message ||
            "Unable to end YouTube broadcast.",
        });
    }
  };