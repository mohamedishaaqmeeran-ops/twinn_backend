const {
  spawn,
} = require(
  "child_process"
);

const fs = require(
  "fs"
);

const ffmpegStatic =
  require(
    "ffmpeg-static"
  );

/* =========================================================
   FFMPEG CONFIGURATION
========================================================= */

const FFMPEG_PATH =
  process.env.FFMPEG_PATH ||
  ffmpegStatic ||
  "ffmpeg";

/*
 * Active processes are stored in memory.
 *
 * Key format:
 * userId:platform
 *
 * Important:
 * If the server restarts, this map is cleared.
 * MongoDB live status should therefore also be reset
 * during server startup if required.
 */
const activeProcesses =
  new Map();

/* =========================================================
   HELPERS
========================================================= */

const buildProcessKey = (
  userId,
  platform
) => {
  return (
    `${String(userId)}` +
    `:${String(platform)
      .trim()
      .toLowerCase()}`
  );
};

const isRemoteSource = (
  value
) => {
  return (
    value.startsWith(
      "http://"
    ) ||
    value.startsWith(
      "https://"
    ) ||
    value.startsWith(
      "rtmp://"
    ) ||
    value.startsWith(
      "rtmps://"
    ) ||
    value.startsWith(
      "srt://"
    )
  );
};

const validateInputSource = (
  input
) => {
  if (!input) {
    throw new Error(
      "A video input source is required."
    );
  }

  if (
    isRemoteSource(
      input
    )
  ) {
    return;
  }

  if (
    !fs.existsSync(
      input
    )
  ) {
    throw new Error(
      "The selected video file does not exist."
    );
  }
};

const sanitizeNumber = (
  value,
  fallback,
  minimum,
  maximum
) => {
  const number =
    Number(value);

  if (
    Number.isNaN(number)
  ) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      number
    )
  );
};

/* =========================================================
   BUILD FFMPEG ARGUMENTS
========================================================= */

const buildFfmpegArguments = ({
  input,
  outputUrl,
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
}) => {
  validateInputSource(
    input
  );

  if (!outputUrl) {
    throw new Error(
      "RTMP output URL is required."
    );
  }

  const safeVideoBitrate =
    sanitizeNumber(
      videoBitrate,
      4500,
      500,
      8000
    );

  const safeAudioBitrate =
    sanitizeNumber(
      audioBitrate,
      128,
      64,
      320
    );

  const safeWidth =
    sanitizeNumber(
      width,
      1280,
      640,
      1920
    );

  const safeHeight =
    sanitizeNumber(
      height,
      720,
      360,
      1080
    );

  const safeFps =
    sanitizeNumber(
      fps,
      30,
      15,
      60
    );

  const args = [
    "-hide_banner",
    "-loglevel",
    process.env
      .FFMPEG_LOG_LEVEL ||
      "warning",
  ];

  /*
   * Read a file at natural playback speed.
   * Do not apply -re for live RTMP/SRT input.
   */
  if (
    sourceType !==
      "live" &&
    !input.startsWith(
      "rtmp://"
    ) &&
    !input.startsWith(
      "rtmps://"
    ) &&
    !input.startsWith(
      "srt://"
    )
  ) {
    args.push(
      "-re"
    );
  }

  /*
   * Loop uploaded or remote video files.
   */
  if (
    loop &&
    sourceType !==
      "live"
  ) {
    args.push(
      "-stream_loop",
      "-1"
    );
  }

  /*
   * Improve reconnect behavior for HTTP streams.
   */
  if (
    input.startsWith(
      "http://"
    ) ||
    input.startsWith(
      "https://"
    )
  ) {
    args.push(
      "-reconnect",
      "1",
      "-reconnect_streamed",
      "1",
      "-reconnect_delay_max",
      "5"
    );
  }

  args.push(
    "-i",
    input
  );

  /*
   * Ignore metadata and subtitle streams.
   */
  args.push(
    "-map_metadata",
    "-1",
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?"
  );

  /*
   * Video settings compatible with most RTMP platforms.
   */
  args.push(
    "-c:v",
    "libx264",

    "-preset",
    preset,

    "-tune",
    "zerolatency",

    "-profile:v",
    "high",

    "-level",
    "4.1",

    "-pix_fmt",
    "yuv420p",

    "-r",
    String(
      safeFps
    ),

    "-g",
    String(
      safeFps * 2
    ),

    "-keyint_min",
    String(
      safeFps * 2
    ),

    "-sc_threshold",
    "0",

    "-b:v",
    `${safeVideoBitrate}k`,

    "-maxrate",
    `${safeVideoBitrate}k`,

    "-bufsize",
    `${safeVideoBitrate * 2}k`,

    "-vf",
    `scale=${safeWidth}:${safeHeight}:force_original_aspect_ratio=decrease,pad=${safeWidth}:${safeHeight}:(ow-iw)/2:(oh-ih)/2`
  );

  /*
   * Audio settings.
   */
  args.push(
    "-c:a",
    "aac",

    "-b:a",
    `${safeAudioBitrate}k`,

    "-ar",
    "44100",

    "-ac",
    "2"
  );

  /*
   * RTMP output.
   */
  args.push(
    "-f",
    "flv",

    "-flvflags",
    "no_duration_filesize",

    outputUrl
  );

  return args;
};

/* =========================================================
   GET ACTIVE PROCESS
========================================================= */

exports.getProcess = (
  userId,
  platform
) => {
  const key =
    buildProcessKey(
      userId,
      platform
    );

  return (
    activeProcesses.get(
      key
    ) ||
    null
  );
};

/* =========================================================
   CHECK WHETHER STREAM IS ACTIVE
========================================================= */

exports.isStreaming = (
  userId,
  platform
) => {
  const entry =
    exports.getProcess(
      userId,
      platform
    );

  return Boolean(
    entry?.process &&
    !entry.process.killed &&
    entry.process.exitCode ===
      null
  );
};

/* =========================================================
   LIST USER PROCESSES
========================================================= */

exports.getUserProcesses = (
  userId
) => {
  const userPrefix =
    `${String(userId)}:`;

  return Array.from(
    activeProcesses.entries()
  )
    .filter(
      ([
        key,
      ]) =>
        key.startsWith(
          userPrefix
        )
    )
    .map(
      ([
        key,
        entry,
      ]) => ({
        key,

        platform:
          entry.platform,

        startedAt:
          entry.startedAt,

        pid:
          entry.process?.pid ||
          null,

        active:
          Boolean(
            entry.process &&
            !entry.process.killed &&
            entry.process
              .exitCode ===
              null
          ),
      })
    );
};

/* =========================================================
   START FFMPEG STREAM
========================================================= */

exports.startStream = ({
  userId,
  platform,
  input,
  outputUrl,
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
  onStarted,
  onError,
  onExit,
}) => {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  if (!platform) {
    throw new Error(
      "Platform is required."
    );
  }

  const normalizedPlatform =
    String(platform)
      .trim()
      .toLowerCase();

  const key =
    buildProcessKey(
      userId,
      normalizedPlatform
    );

  if (
    activeProcesses.has(
      key
    )
  ) {
    const existing =
      activeProcesses.get(
        key
      );

    if (
      existing?.process &&
      existing.process
        .exitCode ===
        null &&
      !existing.process
        .killed
    ) {
      throw new Error(
        `${normalizedPlatform} stream is already running.`
      );
    }

    activeProcesses.delete(
      key
    );
  }

  const args =
    buildFfmpegArguments({
      input,
      outputUrl,
      sourceType,
      loop,
      videoBitrate,
      audioBitrate,
      width,
      height,
      fps,
      preset,
    });

  /*
   * Never log args because outputUrl contains
   * the private stream key.
   */
  const ffmpegProcess =
    spawn(
      FFMPEG_PATH,
      args,
      {
        stdio: [
          "ignore",
          "ignore",
          "pipe",
        ],
      }
    );

  const entry = {
    process:
      ffmpegProcess,

    userId:
      String(userId),

    platform:
      normalizedPlatform,

    input,

    startedAt:
      new Date(),

    stderr:
      "",
  };

  activeProcesses.set(
    key,
    entry
  );

  let startCallbackCalled =
    false;

  const invokeStarted =
    () => {
      if (
        startCallbackCalled
      ) {
        return;
      }

      startCallbackCalled =
        true;

      if (
        typeof onStarted ===
        "function"
      ) {
        Promise.resolve(
          onStarted({
            pid:
              ffmpegProcess.pid,

            platform:
              normalizedPlatform,
          })
        ).catch(
          (
            error
          ) => {
            console.error(
              "FFMPEG START CALLBACK ERROR:",
              error.message
            );
          }
        );
      }
    };

  /*
   * Spawn means FFmpeg started successfully.
   * It does not guarantee the platform accepted the stream.
   */
  ffmpegProcess.once(
    "spawn",
    () => {
      invokeStarted();
    }
  );

  ffmpegProcess.stderr.on(
    "data",
    (
      chunk
    ) => {
      const message =
        chunk.toString();

      entry.stderr =
        (
          entry.stderr +
          message
        ).slice(
          -12000
        );

      /*
       * Useful status messages without exposing output URL.
       */
      if (
        process.env
          .FFMPEG_DEBUG ===
        "true"
      ) {
        console.log(
          `[FFMPEG:${normalizedPlatform}]`,
          message
            .replace(
              /rtmps?:\/\/\S+/gi,
              "[RTMP_URL_HIDDEN]"
            )
            .trim()
        );
      }
    }
  );

  ffmpegProcess.once(
    "error",
    (
      error
    ) => {
      activeProcesses.delete(
        key
      );

      if (
        typeof onError ===
        "function"
      ) {
        Promise.resolve(
          onError(
            error
          )
        ).catch(
          (
            callbackError
          ) => {
            console.error(
              "FFMPEG ERROR CALLBACK ERROR:",
              callbackError.message
            );
          }
        );
      }
    }
  );

  ffmpegProcess.once(
    "exit",
    (
      code,
      signal
    ) => {
      activeProcesses.delete(
        key
      );

      if (
        typeof onExit ===
        "function"
      ) {
        Promise.resolve(
          onExit({
            code,
            signal,
            stderr:
              entry.stderr,
            platform:
              normalizedPlatform,
          })
        ).catch(
          (
            error
          ) => {
            console.error(
              "FFMPEG EXIT CALLBACK ERROR:",
              error.message
            );
          }
        );
      }
    }
  );

  return {
    key,

    pid:
      ffmpegProcess.pid,

    platform:
      normalizedPlatform,

    startedAt:
      entry.startedAt,
  };
};

/* =========================================================
   STOP ONE FFMPEG STREAM
========================================================= */

exports.stopStream =
  async (
    userId,
    platform,
    {
      forceAfterMs =
        5000,
    } = {}
  ) => {
    const key =
      buildProcessKey(
        userId,
        platform
      );

    const entry =
      activeProcesses.get(
        key
      );

    if (
      !entry?.process
    ) {
      return {
        stopped:
          false,

        message:
          "No active FFmpeg process was found.",
      };
    }

    const process =
      entry.process;

    if (
      process.exitCode !==
        null ||
      process.killed
    ) {
      activeProcesses.delete(
        key
      );

      return {
        stopped:
          true,

        alreadyStopped:
          true,
      };
    }

    return new Promise(
      (
        resolve
      ) => {
        let completed =
          false;

        const finish = (
          result
        ) => {
          if (completed) {
            return;
          }

          completed =
            true;

          activeProcesses.delete(
            key
          );

          resolve(
            result
          );
        };

        const forceTimer =
          setTimeout(
            () => {
              if (
                process.exitCode ===
                  null &&
                !process.killed
              ) {
                process.kill(
                  "SIGKILL"
                );
              }

              finish({
                stopped:
                  true,

                forced:
                  true,
              });
            },
            forceAfterMs
          );

        process.once(
          "exit",
          (
            code,
            signal
          ) => {
            clearTimeout(
              forceTimer
            );

            finish({
              stopped:
                true,

              forced:
                false,

              code,

              signal,
            });
          }
        );

        try {
          process.kill(
            "SIGTERM"
          );
        } catch (error) {
          clearTimeout(
            forceTimer
          );

          finish({
            stopped:
              false,

            error:
              error.message,
          });
        }
      }
    );
  };

/* =========================================================
   STOP ALL USER STREAMS
========================================================= */

exports.stopAllForUser =
  async (
    userId
  ) => {
    const entries =
      exports.getUserProcesses(
        userId
      );

    const results =
      await Promise.allSettled(
        entries.map(
          (
            entry
          ) =>
            exports.stopStream(
              userId,
              entry.platform
            )
        )
      );

    return results.map(
      (
        result,
        index
      ) => ({
        platform:
          entries[index]
            ?.platform,

        success:
          result.status ===
          "fulfilled",

        result:
          result.status ===
          "fulfilled"
            ? result.value
            : null,

        error:
          result.status ===
          "rejected"
            ? result.reason
                ?.message ||
              "Unable to stop stream."
            : null,
      })
    );
  };

/* =========================================================
   STOP ALL PROCESSES DURING SERVER SHUTDOWN
========================================================= */

exports.shutdown =
  async () => {
    const entries =
      Array.from(
        activeProcesses.values()
      );

    await Promise.allSettled(
      entries.map(
        (
          entry
        ) =>
          exports.stopStream(
            entry.userId,
            entry.platform,
            {
              forceAfterMs:
                2000,
            }
          )
      )
    );
  };