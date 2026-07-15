const fetch = require("node-fetch");
const fs = require("fs");
const { spawn } = require("child_process");


const ffmpegPath = require(
  "ffmpeg-static"
);

const Connection = require(
  "../../models/Connection"
);

const youtubeProcessManager =
  require(
    "./youtubeProcess.manager"
  );



const runningStreams = new Map();

const META_GRAPH_VERSION =
  process.env.META_GRAPH_VERSION ||
  "v25.0";

class LiveService {
  getStreamKey(userId, platform) {
    return `${userId}-${platform}`;
  }

  isRunning(userId, platform) {
    return runningStreams.has(
      this.getStreamKey(userId, platform)
    );
  }

  startFFmpeg({
    userId,
    platform,
    videoPath,
    streamUrl,
    onStarted,
    onEnded,
    onError,
  }) {
    const key = this.getStreamKey(
      userId,
      platform
    );

    if (runningStreams.has(key)) {
      throw new Error(
        `${platform} live is already running.`
      );
    }

    if (!videoPath) {
      throw new Error(
        "Video path is required."
      );
    }

    const isRemoteVideo =
      videoPath.startsWith("http://") ||
      videoPath.startsWith("https://");

    if (
      !isRemoteVideo &&
      !fs.existsSync(videoPath)
    ) {
      throw new Error(
        `Video file not found: ${videoPath}`
      );
    }

    const ffmpegArguments = [
      "-re",
      "-stream_loop",
      "-1",
      "-i",
      videoPath,

      "-c:v",
      "libx264",

      "-preset",
      "veryfast",

      "-tune",
      "zerolatency",

      "-b:v",
      "2500k",

      "-maxrate",
      "2500k",

      "-bufsize",
      "5000k",

      "-pix_fmt",
      "yuv420p",

      "-g",
      "60",

      "-keyint_min",
      "60",

      "-sc_threshold",
      "0",

      "-c:a",
      "aac",

      "-b:a",
      "128k",

      "-ar",
      "44100",

      "-ac",
      "2",

      "-f",
      "flv",

      streamUrl,
    ];

    const ffmpeg = spawn(
      process.env.FFMPEG_PATH || "ffmpeg",
      ffmpegArguments,
      {
        stdio: [
          "ignore",
          "ignore",
          "pipe",
        ],
      }
    );

    let started = false;

    ffmpeg.stderr.on("data", (data) => {
      const output = data.toString();

      console.log(
        `[${platform} FFmpeg]`,
        output
      );

      if (
        !started &&
        (
          output.includes("frame=") ||
          output.includes("Output #0")
        )
      ) {
        started = true;

        if (
          typeof onStarted === "function"
        ) {
          onStarted();
        }
      }
    });

    ffmpeg.on("error", (error) => {
      console.error(
        `${platform} FFmpeg process error:`,
        error
      );

      runningStreams.delete(key);

      if (typeof onError === "function") {
        onError(error);
      }
    });

    ffmpeg.on(
      "close",
      (code, signal) => {
        console.log(
          `${platform} FFmpeg closed`,
          {
            code,
            signal,
          }
        );

        runningStreams.delete(key);

        if (typeof onEnded === "function") {
          onEnded({
            code,
            signal,
          });
        }
      }
    );

    runningStreams.set(key, {
      process: ffmpeg,
      platform,
      userId,
      startedAt: new Date(),
    });

    return {
      platform,
      started: true,
    };
  }

 async startInstagramLive(
  userId,
  {
    videoPath,
    rtmpUrl,
    streamKey,
    onStarted,
    onEnded,
    onError,
  }
) {
  const connection =
    await Connection.findOne({
      userId,
      platform: "instagram",
      connected: true,
    });

  if (!connection) {
    throw new Error(
      "Instagram is not connected for this user."
    );
  }

  const normalizedRtmpUrl =
    String(rtmpUrl || "")
      .trim()
      .replace(/\/+$/, "");

  const normalizedStreamKey =
    String(streamKey || "")
      .trim()
      .replace(/^\/+/, "");

  console.log(
    "INSTAGRAM STREAM INPUT:",
    {
      userId: String(userId),

      hasVideoPath:
        Boolean(videoPath),

      hasRtmpUrl:
        Boolean(normalizedRtmpUrl),

      hasStreamKey:
        Boolean(
          normalizedStreamKey
        ),
    }
  );

  if (!normalizedRtmpUrl) {
    throw new Error(
      "Instagram RTMP URL is missing for this schedule."
    );
  }

  if (!normalizedStreamKey) {
    throw new Error(
      "Instagram stream key is missing for this schedule."
    );
  }

  const streamUrl =
    `${normalizedRtmpUrl}/${normalizedStreamKey}`;

  return this.startFFmpeg({
    userId,
    platform: "instagram",
    videoPath,
    streamUrl,
    onStarted,
    onEnded,
    onError,
  });
}

  async startInstagramRTMP(
  userId,
  body
) {
  return this.startInstagramLive(
    userId,
    {
      videoPath: body.videoPath,
      rtmpUrl: body.rtmpUrl,
      streamKey: body.streamKey,
    }
  );
}

  async createFacebookLive({
    connection,
    title,
    description,
  }) {
    const url =
      `https://graph.facebook.com/` +
      `${META_GRAPH_VERSION}/` +
      `${connection.pageId}/live_videos`;

    const body =
      new URLSearchParams({
        access_token:
          connection.pageAccessToken,

        status: "LIVE_NOW",

        title:
          title ||
          "Twinn Live Shopping",

        description:
          description ||
          "Live shopping powered by Twinn.live",
      });

    const response = await fetch(url, {
      method: "POST",

      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },

      body,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error?.message ||
          "Unable to create Facebook Live."
      );
    }

    return data;
  }

  async startFacebookLive(
    userId,
    {
      videoPath,
      title,
      description,
      onStarted,
      onEnded,
      onError,
    }
  ) {
    if (!videoPath) {
      throw new Error(
        "Video path is required."
      );
    }

    const connection =
      await Connection.findOne({
        userId,
        platform: "facebook",
        connected: true,
      }).select("+pageAccessToken");

    if (
      !connection ||
      !connection.pageId ||
      !connection.pageAccessToken
    ) {
      throw new Error(
        "Facebook Page is not connected."
      );
    }

    const data =
      await this.createFacebookLive({
        connection,
        title,
        description,
      });

    const streamUrl =
      data.secure_stream_url ||
      data.stream_url;

    if (!streamUrl) {
      throw new Error(
        "Facebook stream URL was not received."
      );
    }

    await Connection.findOneAndUpdate(
      {
        userId,
        platform: "facebook",
      },
      {
        facebookLiveVideoId: data.id,
      }
    );

    this.startFFmpeg({
      userId,
      platform: "facebook",
      videoPath,
      streamUrl,
      onStarted,
      onEnded,
      onError,
    });

    return {
      liveVideoId: data.id,
      streamUrl,
    };
  }

  async stopLive(userId, platform) {
    const key = this.getStreamKey(
      userId,
      platform
    );

    const running =
      runningStreams.get(key);

    if (running?.process) {
      running.process.kill("SIGTERM");
      runningStreams.delete(key);
    }

    return true;
  }

  async stopFacebookLive(userId) {
    await this.stopLive(
      userId,
      "facebook"
    );

    const connection =
      await Connection.findOne({
        userId,
        platform: "facebook",
      }).select("+pageAccessToken");

    if (
      !connection?.facebookLiveVideoId ||
      !connection?.pageAccessToken
    ) {
      return true;
    }

    const url =
      `https://graph.facebook.com/` +
      `${META_GRAPH_VERSION}/` +
      `${connection.facebookLiveVideoId}`;

    const body =
      new URLSearchParams({
        access_token:
          connection.pageAccessToken,

        end_live_video: "true",
      });

    const response = await fetch(url, {
      method: "POST",

      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },

      body,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error?.message ||
          "Unable to stop Facebook Live."
      );
    }

    await Connection.findOneAndUpdate(
      {
        userId,
        platform: "facebook",
      },
      {
        $unset: {
          facebookLiveVideoId: 1,
        },
      }
    );

    return true;
  }

  async stopPlatforms(
    userId,
    platforms = []
  ) {
    const results = [];

    for (const platform of platforms) {
      try {
        if (platform === "facebook") {
          await this.stopFacebookLive(
            userId
          );
        } else {
          await this.stopLive(
            userId,
            platform
          );
        }

        results.push({
          platform,
          success: true,
        });
      } catch (error) {
        results.push({
          platform,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }
}

const isHttpVideoUrl = (
  value
) => {
  try {
    const url = new URL(
      String(value)
    );

    return (
      url.protocol ===
        "http:" ||
      url.protocol ===
        "https:"
    );
  } catch (_) {
    return false;
  }
};

/* =========================================================
   START YOUTUBE RTMP
========================================================= */

exports.startYouTubeRTMP =
  async (
    userId,
    payload
  ) => {
    const videoPath = String(
      payload.videoPath || ""
    ).trim();

    if (!videoPath) {
      throw new Error(
        "Video path is required."
      );
    }

    if (
      !isHttpVideoUrl(
        videoPath
      )
    ) {
      throw new Error(
        "Video path must be a valid HTTP or HTTPS URL."
      );
    }

    const connection =
      await Connection.findOne({
        userId,
        platform: "youtube",
        connected: true,
      }).select(
        "+youtubeStreamKey"
      );

    if (!connection) {
      throw new Error(
        "YouTube is not connected."
      );
    }

    if (
      !connection
        .youtubeStreamUrl ||
      !connection
        .youtubeStreamKey ||
      !connection
        .youtubeBroadcastId ||
      !connection
        .youtubeStreamId
    ) {
      throw new Error(
        "Create the YouTube broadcast before starting RTMP."
      );
    }

    const existingProcess =
      youtubeProcessManager
        .getProcess(userId);

    if (
      existingProcess &&
      !existingProcess.killed
    ) {
      throw new Error(
        "A YouTube streaming process is already running."
      );
    }

    const rtmpDestination =
      `${connection.youtubeStreamUrl.replace(
        /\/+$/,
        ""
      )}/${connection.youtubeStreamKey.replace(
        /^\/+/,
        ""
      )}`;

    const args = [
      "-hide_banner",
      "-loglevel",
      "info",

      /*
       * Read input in real time.
       */
      "-re",

      /*
       * Repeat the uploaded video.
       * Remove these two arguments
       * to play it only once.
       */
      "-stream_loop",
      "-1",

      "-i",
      videoPath,

      /*
       * Video encoding.
       */
      "-c:v",
      "libx264",

      "-preset",
      "veryfast",

      "-profile:v",
      "high",

      "-level",
      "4.1",

      "-pix_fmt",
      "yuv420p",

      "-r",
      "30",

      "-g",
      "60",

      "-keyint_min",
      "60",

      "-sc_threshold",
      "0",

      "-b:v",
      "3500k",

      "-maxrate",
      "3500k",

      "-bufsize",
      "7000k",

      /*
       * Audio encoding.
       */
      "-c:a",
      "aac",

      "-b:a",
      "128k",

      "-ar",
      "44100",

      "-ac",
      "2",

      /*
       * Output format.
       */
      "-f",
      "flv",

      rtmpDestination,
    ];

    console.log(
      "STARTING YOUTUBE FFMPEG"
    );

    const ffmpegProcess =
      spawn(
        ffmpegPath,
        args,
        {
          stdio: [
            "ignore",
            "pipe",
            "pipe",
          ],
        }
      );

    youtubeProcessManager
      .setProcess(
        userId,
        ffmpegProcess
      );

    connection.youtubeLiveStatus =
      "streaming";

    await connection.save();

    ffmpegProcess.stdout.on(
      "data",
      (data) => {
        console.log(
          "YOUTUBE FFMPEG:",
          data.toString()
        );
      }
    );

    ffmpegProcess.stderr.on(
      "data",
      (data) => {
        console.log(
          "YOUTUBE FFMPEG:",
          data.toString()
        );
      }
    );

    ffmpegProcess.on(
      "error",
      async (error) => {
        console.error(
          "YOUTUBE FFMPEG PROCESS ERROR:",
          error
        );

        youtubeProcessManager
          .removeProcess(userId);

        await Connection.updateOne(
          {
            userId,
            platform: "youtube",
          },
          {
            $set: {
              youtubeLiveStatus:
                "failed",
            },
          }
        ).catch(() => {});
      }
    );

    ffmpegProcess.on(
      "close",
      async (code, signal) => {
        console.log(
          "YOUTUBE FFMPEG CLOSED:",
          {
            code,
            signal,
          }
        );

        youtubeProcessManager
          .removeProcess(userId);

        await Connection.updateOne(
          {
            userId,
            platform: "youtube",
          },
          {
            $set: {
              youtubeLiveStatus:
                code === 0
                  ? "complete"
                  : "failed",
            },
          }
        ).catch(() => {});
      }
    );

    return {
      started: true,

      processId:
        ffmpegProcess.pid,

      broadcastId:
        connection
          .youtubeBroadcastId,

      streamId:
        connection
          .youtubeStreamId,

      watchUrl:
        connection
          .youtubeWatchUrl,
    };
  };

/* =========================================================
   STOP YOUTUBE RTMP
========================================================= */

exports.stopYouTubeRTMP =
  async (userId) => {
    const stopped =
      youtubeProcessManager
        .stopProcess(userId);

    await Connection.updateOne(
      {
        userId,
        platform: "youtube",
      },
      {
        $set: {
          youtubeLiveStatus:
            "complete",
        },
      }
    );

    return {
      stopped,
    };
  };

module.exports = new LiveService();