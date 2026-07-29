// modules/live/ffmpeg.service.js
// PART 1 OF 4

const {
  spawn,
} = require(
  "child_process"
);

const fs = require(
  "fs"
);

const path = require(
  "path"
);

const FFMPEG_PATH =
  process.env.FFMPEG_PATH ||
  "/usr/bin/ffmpeg";

const FFMPEG_LOG_LEVEL =
  process.env.FFMPEG_LOG_LEVEL ||
  "warning";

const FFMPEG_DEBUG =
  process.env.FFMPEG_DEBUG ===
  "true";

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
   PLATFORM DEFAULTS
========================================================= */

const PLATFORM_STREAM_DEFAULTS = {
  instagram: {
    width:
      1080,

    height:
      1920,

    fps:
      30,

    videoBitrate:
      3500,

    audioBitrate:
      128,

    keyframeInterval:
      2,

    preset:
      "veryfast",
  },

  facebook: {
    width:
      1280,

    height:
      720,

    fps:
      30,

    videoBitrate:
      4000,

    audioBitrate:
      128,

    keyframeInterval:
      2,

    preset:
      "veryfast",
  },

  youtube: {
    width:
      1280,

    height:
      720,

    fps:
      30,

    videoBitrate:
      4500,

    audioBitrate:
      128,

    keyframeInterval:
      2,

    preset:
      "veryfast",
  },

  linkedin: {
    width:
      1280,

    height:
      720,

    fps:
      30,

    videoBitrate:
      4000,

    audioBitrate:
      128,

    keyframeInterval:
      2,

    preset:
      "veryfast",
  },

  tiktok: {
    width:
      1080,

    height:
      1920,

    fps:
      30,

    videoBitrate:
      3500,

    audioBitrate:
      128,

    keyframeInterval:
      2,

    preset:
      "veryfast",
  },

  rumble: {
    width:
      1280,

    height:
      720,

    fps:
      30,

    videoBitrate:
      4500,

    audioBitrate:
      128,

    keyframeInterval:
      2,

    preset:
      "veryfast",
  },

  kick: {
    width:
      1280,

    height:
      720,

    fps:
      30,

    videoBitrate:
      4500,

    audioBitrate:
      128,

    keyframeInterval:
      2,

    preset:
      "veryfast",
  },

  twitch: {
  width: 640,
  height: 360,
  fps: 15,
  videoBitrate: 1000,
  audioBitrate: 64,
  keyframeInterval: 2,
  preset: "ultrafast",
},

  twitter: {
    width:
      1280,

    height:
      720,

    fps:
      30,

    videoBitrate:
      4000,

    audioBitrate:
      128,

    keyframeInterval:
      2,

    preset:
      "veryfast",
  },
};

/* =========================================================
   ACTIVE FFMPEG PROCESSES

   Key formats:

   Single platform:
   userId:platform

   Multi-platform parent:
   userId:multi:sessionId

   Important:
   This map is stored in memory.

   If the server restarts, all process references are lost.
   Live statuses should be reset during server startup.
========================================================= */

const activeProcesses =
  new Map();

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
    value === "x" ||
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
  platform
) => {
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
      `Unsupported streaming platform: ${
        normalizedPlatform ||
        "unknown"
      }.`
    );
  }

  return normalizedPlatform;
};

/* =========================================================
   BUILD PROCESS KEY
========================================================= */

const buildProcessKey = (
  userId,
  platform
) => {
  if (!userId) {
    throw new Error(
      "User ID is required to build the process key."
    );
  }

  const normalizedPlatform =
    normalizePlatform(
      platform
    );

  if (!normalizedPlatform) {
    throw new Error(
      "Platform is required to build the process key."
    );
  }

  return (
    `${String(userId)}` +
    `:${normalizedPlatform}`
  );
};

/* =========================================================
   BUILD MULTI-STREAM PROCESS KEY
========================================================= */

const buildMultiProcessKey = (
  userId,
  sessionId
) => {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  if (!sessionId) {
    throw new Error(
      "Session ID is required."
    );
  }

  return (
    `${String(userId)}` +
    `:multi:` +
    `${String(sessionId)}`
  );
};

/* =========================================================
   CHECK REMOTE SOURCE
========================================================= */

const isRemoteSource = (
  value
) => {
  const source =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();

  return (
    source.startsWith(
      "http://"
    ) ||
    source.startsWith(
      "https://"
    ) ||
    source.startsWith(
      "rtmp://"
    ) ||
    source.startsWith(
      "rtmps://"
    ) ||
    source.startsWith(
      "srt://"
    ) ||
    source.startsWith(
      "udp://"
    ) ||
    source.startsWith(
      "tcp://"
    )
  );
};

/* =========================================================
   CHECK LIVE SOURCE
========================================================= */

const isLiveSource = (
  value
) => {
  const source =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();

  return (
    source.startsWith(
      "rtmp://"
    ) ||
    source.startsWith(
      "rtmps://"
    ) ||
    source.startsWith(
      "srt://"
    ) ||
    source.startsWith(
      "udp://"
    ) ||
    source.startsWith(
      "tcp://"
    )
  );
};

/* =========================================================
   VALIDATE INPUT SOURCE
========================================================= */

const validateInputSource = (
  input
) => {
  const normalizedInput =
    String(
      input || ""
    ).trim();

  if (!normalizedInput) {
    throw new Error(
      "A video input source is required."
    );
  }

  if (
    isRemoteSource(
      normalizedInput
    )
  ) {
    return normalizedInput;
  }

  const resolvedPath =
    path.resolve(
      normalizedInput
    );

  if (
    !fs.existsSync(
      resolvedPath
    )
  ) {
    throw new Error(
      "The selected video file does not exist."
    );
  }

  const stats =
    fs.statSync(
      resolvedPath
    );

  if (
    !stats.isFile()
  ) {
    throw new Error(
      "The selected input source is not a file."
    );
  }

  return resolvedPath;
};

/* =========================================================
   VALIDATE OUTPUT URL
========================================================= */

const validateOutputUrl = (
  outputUrl
) => {
  const value =
    String(
      outputUrl || ""
    ).trim();

  if (!value) {
    throw new Error(
      "RTMP output URL is required."
    );
  }

  if (
    !value.startsWith(
      "rtmp://"
    ) &&
    !value.startsWith(
      "rtmps://"
    )
  ) {
    throw new Error(
      "RTMP output URL must start with rtmp:// or rtmps://."
    );
  }

  return value;
};

/* =========================================================
   SANITIZE NUMBER
========================================================= */

const sanitizeNumber = (
  value,
  fallback,
  minimum,
  maximum
) => {
  const number =
    Number(
      value
    );

  if (
    !Number.isFinite(
      number
    )
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
   SANITIZE INTEGER
========================================================= */

const sanitizeInteger = (
  value,
  fallback,
  minimum,
  maximum
) => {
  const number =
    sanitizeNumber(
      value,
      fallback,
      minimum,
      maximum
    );

  return Math.round(
    number
  );
};

/* =========================================================
   SANITIZE PRESET
========================================================= */

const sanitizePreset = (
  preset
) => {
  const allowedPresets = [
    "ultrafast",
    "superfast",
    "veryfast",
    "faster",
    "fast",
    "medium",
  ];

  const normalizedPreset =
    String(
      preset || ""
    )
      .trim()
      .toLowerCase();

  if (
    allowedPresets.includes(
      normalizedPreset
    )
  ) {
    return normalizedPreset;
  }

  return "veryfast";
};

/* =========================================================
   MASK RTMP SECRETS
========================================================= */

const maskRtmpSecrets = (
  value
) => {
  return String(
    value || ""
  )
    .replace(
      /rtmps?:\/\/[^\s"'<>]+/gi,
      "[RTMP_URL_HIDDEN]"
    )
    .replace(
      /stream[_-]?key\s*[=:]\s*[^\s"'<>]+/gi,
      "streamKey=[HIDDEN]"
    );
};

/* =========================================================
   SAFE ERROR MESSAGE
========================================================= */

const getSafeErrorMessage = (
  error
) => {
  if (!error) {
    return "Unknown FFmpeg error.";
  }

  const message =
    error.message ||
    String(
      error
    );

  return maskRtmpSecrets(
    message
  );
};

/* =========================================================
   GET PLATFORM DEFAULTS
========================================================= */

const getPlatformDefaults = (
  platform
) => {
  const normalizedPlatform =
    validatePlatform(
      platform
    );

  return {
    ...PLATFORM_STREAM_DEFAULTS[
      normalizedPlatform
    ],
  };
};

/* =========================================================
   BUILD FFMPEG ARGUMENTS
========================================================= */

const buildFfmpegArguments = ({
  input,

  outputUrl,

  platform =
    "youtube",

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
}) => {
  const normalizedPlatform =
    validatePlatform(
      platform
    );

  const defaults =
    getPlatformDefaults(
      normalizedPlatform
    );

  const validatedInput =
    validateInputSource(
      input
    );

  const validatedOutputUrl =
    validateOutputUrl(
      outputUrl
    );

 const safeVideoBitrate = sanitizeInteger(
  videoBitrate,
  1000,
  500,
  6000
);

const safeAudioBitrate = sanitizeInteger(
  audioBitrate,
  64,
  64,
  192
);

const safeWidth = sanitizeInteger(
  width,
  640,
  360,
  1920
);

const safeHeight = sanitizeInteger(
  height,
  360,
  360,
  1920
);

const safeFps = sanitizeInteger(
  fps,
  15,
  15,
  60
);



  const safeKeyframeInterval =
    sanitizeInteger(
      keyframeInterval,
      defaults.keyframeInterval,
      1,
      5
    );

  const safePreset =
    sanitizePreset(
      preset ||
      defaults.preset
    );

  const keyframeFrames =
    safeFps *
    safeKeyframeInterval;

  const normalizedSourceType =
    String(
      sourceType || "file"
    )
      .trim()
      .toLowerCase();

  const args = [
    "-hide_banner",

    "-loglevel",
    FFMPEG_LOG_LEVEL,

    "-nostats",

    "-y",
  ];

  /* =======================================================
     INPUT TIMING

     Use -re for files and remote HTTP video files so FFmpeg
     reads the source at its natural playback speed.

     Do not use -re for RTMP, SRT, UDP or TCP live sources.
  ======================================================= */

  if (
    normalizedSourceType !==
      "live" &&
    !isLiveSource(
      validatedInput
    )
  ) {
    args.push(
      "-re"
    );
  }

  /* =======================================================
     LOOP VIDEO FILE
  ======================================================= */

  if (
    loop &&
    normalizedSourceType !==
      "live" &&
    !isLiveSource(
      validatedInput
    )
  ) {
    args.push(
      "-stream_loop",
      "-1"
    );
  }

  /* =======================================================
     HTTP RECONNECT OPTIONS
  ======================================================= */

  if (
    reconnect &&
    (
      validatedInput.startsWith(
        "http://"
      ) ||
      validatedInput.startsWith(
        "https://"
      )
    )
  ) {
    args.push(
      "-reconnect",
      "1",

      "-reconnect_streamed",
      "1",

      "-reconnect_at_eof",
      "1",

      "-reconnect_delay_max",
      "5"
    );
  }

  /* =======================================================
     LIVE INPUT OPTIONS
  ======================================================= */

  if (
    isLiveSource(
      validatedInput
    )
  ) {
    args.push(
      "-fflags",
      "+genpts+discardcorrupt",

      "-flags",
      "low_delay"
    );
  }

  args.push(
    "-i",
    validatedInput
  );

  /* =======================================================
     STREAM MAPPING
  ======================================================= */

  args.push(
    "-map_metadata",
    "-1",

    "-map_chapters",
    "-1",

    "-map",
    "0:v:0"
  );

  if (
    includeAudio
  ) {
    args.push(
      "-map",
      "0:a:0?"
    );
  }

  /* =======================================================
     VIDEO ENCODING
  ======================================================= */

  args.push(
    "-c:v",
    "libx264",

    "-preset",
    safePreset,
"-tune",
"zerolatency",

"-x264-params",
"threads=1:sync-lookahead=0:rc-lookahead=0",
 

    "-pix_fmt",
    "yuv420p",

    "-r",
    String(
      safeFps
    ),

    "-g",
    String(
      keyframeFrames
    ),

    "-keyint_min",
    String(
      keyframeFrames
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
`scale=${safeWidth}:${safeHeight}:flags=fast_bilinear`
  );

  /* =======================================================
     AUDIO ENCODING
  ======================================================= */

  if (
    includeAudio
  ) {
    args.push(
      "-c:a",
      "aac",

      "-b:a",
      `${safeAudioBitrate}k`,

      "-ar",
      "32000",

      "-ac",
      "1"
    );
  } else {
    args.push(
      "-an"
    );
  }

  /* =======================================================
     RTMP OUTPUT
  ======================================================= */

  args.push(
    "-f",
    "flv",

    "-flvflags",
    "no_duration_filesize",

    validatedOutputUrl
  );

  return args;
};

/* =========================================================
   ESCAPE TEE OUTPUT URL
========================================================= */

const escapeTeeOutputUrl = (
  value
) => {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
};

/* =========================================================
   BUILD SINGLE-ENCODE MULTI-OUTPUT ARGUMENTS
========================================================= */

const buildMultiOutputArguments = ({
  input,

  destinations,

  sourceType = "file",

  loop = true,

 

  audioBitrate = 48,

  width = 426,
height = 240,
fps = 15,
videoBitrate = 600,

  keyframeInterval = 2,

  preset = "ultrafast",

  includeAudio = true,

  reconnect = true,
}) => {
  const validatedInput =
    validateInputSource(
      input
    );

  if (
    !Array.isArray(
      destinations
    ) ||
    destinations.length ===
      0
  ) {
    throw new Error(
      "At least one streaming destination is required."
    );
  }

  const safeDestinations =
    destinations.map(
      (destination) => ({
        platform:
          validatePlatform(
            destination.platform
          ),

        outputUrl:
          validateOutputUrl(
            destination.outputUrl
          ),
      })
    );

  const safeVideoBitrate =
  sanitizeInteger(
    videoBitrate,
    600,
    400,
    6000
  );

const safeWidth =
  sanitizeInteger(
    width,
    426,
    320,
    1920
  );

const safeHeight =
  sanitizeInteger(
    height,
    240,
    180,
    1920
  );

const safeFps =
  sanitizeInteger(
    fps,
    15,
    10,
    60
  );

  const safeKeyframeInterval =
    sanitizeInteger(
      keyframeInterval,
      2,
      1,
      5
    );

  const safePreset =
    sanitizePreset(
      preset
    );

  const keyframeFrames =
    safeFps *
    safeKeyframeInterval;

  const normalizedSourceType =
    String(
      sourceType || "file"
    )
      .trim()
      .toLowerCase();

  const args = [
    "-hide_banner",

    "-loglevel",
    FFMPEG_LOG_LEVEL,

    "-y",
  ];

  if (
    normalizedSourceType !==
      "live" &&
    !isLiveSource(
      validatedInput
    )
  ) {
    args.push(
      "-re"
    );
  }

  if (
    loop &&
    normalizedSourceType !==
      "live" &&
    !isLiveSource(
      validatedInput
    )
  ) {
    args.push(
      "-stream_loop",
      "-1"
    );
  }

  if (
    reconnect &&
    (
      validatedInput.startsWith(
        "http://"
      ) ||
      validatedInput.startsWith(
        "https://"
      )
    )
  ) {
    args.push(
      "-reconnect",
      "1",

      "-reconnect_streamed",
      "1",

      "-reconnect_at_eof",
      "1",

      "-reconnect_delay_max",
      "5"
    );
  }

  if (
    isLiveSource(
      validatedInput
    )
  ) {
    args.push(
      "-fflags",
      "+genpts+discardcorrupt",

      "-flags",
      "low_delay"
    );
  }

  args.push(
    "-i",
    validatedInput,

    "-map_metadata",
    "-1",

    "-map_chapters",
    "-1",

    "-map",
    "0:v:0"
  );

  if (includeAudio) {
    args.push(
      "-map",
      "0:a:0?"
    );
  }

  args.push(
    "-c:v",
    "libx264",

    "-preset",
    safePreset,

    "-tune",
    "zerolatency",

    "-pix_fmt",
    "yuv420p",

    "-r",
    String(
      safeFps
    ),

    "-g",
    String(
      keyframeFrames
    ),

    "-keyint_min",
    String(
      keyframeFrames
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
    [
      `scale=${safeWidth}:${safeHeight}:force_original_aspect_ratio=decrease`,
      `pad=${safeWidth}:${safeHeight}:(ow-iw)/2:(oh-ih)/2`,
      "setsar=1",
    ].join(
      ","
    )
  );

  if (includeAudio) {
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
  } else {
    args.push(
      "-an"
    );
  }

  const teeOutput =
    safeDestinations
      .map(
        (destination) =>
          `[f=flv:onfail=ignore]${escapeTeeOutputUrl(
            destination.outputUrl
          )}`
      )
      .join(
        "|"
      );

  args.push(
    "-progress",
    "pipe:2",

    "-f",
    "tee",

    teeOutput
  );

  return {
    args,

    destinations:
      safeDestinations,

    encoding: {
      videoBitrate:
        safeVideoBitrate,

      audioBitrate:
        safeAudioBitrate,

      width:
        safeWidth,

      height:
        safeHeight,

      fps:
        safeFps,

      keyframeInterval:
        safeKeyframeInterval,

      preset:
        safePreset,
    },
  };
};

/* =========================================================
   EXPORT PART 1 HELPERS
========================================================= */

exports.FFMPEG_PATH =
  FFMPEG_PATH;

exports.activeProcesses =
  activeProcesses;

exports.SUPPORTED_PLATFORMS =
  SUPPORTED_PLATFORMS;

exports.PLATFORM_STREAM_DEFAULTS =
  PLATFORM_STREAM_DEFAULTS;

exports.normalizePlatform =
  normalizePlatform;

exports.validatePlatform =
  validatePlatform;

exports.buildProcessKey =
  buildProcessKey;

exports.buildMultiProcessKey =
  buildMultiProcessKey;

exports.isRemoteSource =
  isRemoteSource;

exports.isLiveSource =
  isLiveSource;

exports.validateInputSource =
  validateInputSource;

exports.validateOutputUrl =
  validateOutputUrl;

exports.sanitizeNumber =
  sanitizeNumber;

exports.sanitizeInteger =
  sanitizeInteger;

exports.maskRtmpSecrets =
  maskRtmpSecrets;

exports.getSafeErrorMessage =
  getSafeErrorMessage;

exports.getPlatformDefaults =
  getPlatformDefaults;

exports.buildFfmpegArguments =
  buildFfmpegArguments;

exports.escapeTeeOutputUrl =
  escapeTeeOutputUrl;

exports.buildMultiOutputArguments =
  buildMultiOutputArguments;


  /* =========================================================
   PART 2 OF 4
   PROCESS MANAGEMENT AND SINGLE STREAM START
========================================================= */

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
   GET PROCESS BY KEY
========================================================= */

exports.getProcessByKey = (
  key
) => {
  if (!key) {
    return null;
  }

  return (
    activeProcesses.get(
      String(
        key
      )
    ) ||
    null
  );
};

/* =========================================================
   CHECK PROCESS ACTIVITY
========================================================= */

const isProcessActive = (
  entry
) => {
  return Boolean(
    entry?.process &&
    !entry.process.killed &&
    entry.process.exitCode ===
      null
  );
};

/* =========================================================
   CHECK WHETHER PLATFORM IS STREAMING
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

  return isProcessActive(
    entry
  );
};

/* =========================================================
   CHECK WHETHER PROCESS KEY IS ACTIVE
========================================================= */

exports.isProcessKeyActive = (
  key
) => {
  const entry =
    exports.getProcessByKey(
      key
    );

  return isProcessActive(
    entry
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

        userId:
          entry.userId,

        platform:
          entry.platform,

        sessionId:
          entry.sessionId ||
          null,

        sourceType:
          entry.sourceType ||
          "file",

        input:
          entry.input,

        startedAt:
          entry.startedAt,

        pid:
          entry.process?.pid ||
          null,

        active:
          isProcessActive(
            entry
          ),

        status:
          entry.status ||
          (
            isProcessActive(
              entry
            )
              ? "streaming"
              : "stopped"
          ),

        restartCount:
          entry.restartCount ||
          0,
      })
    );
};

/* =========================================================
   GET ALL ACTIVE PROCESSES
========================================================= */

exports.getAllProcesses =
  () => {
    return Array.from(
      activeProcesses.entries()
    ).map(
      ([
        key,
        entry,
      ]) => ({
        key,

        userId:
          entry.userId,

        platform:
          entry.platform,

        sessionId:
          entry.sessionId ||
          null,

        input:
          entry.input,

        pid:
          entry.process?.pid ||
          null,

        active:
          isProcessActive(
            entry
          ),

        startedAt:
          entry.startedAt,

        status:
          entry.status ||
          "unknown",
      })
    );
  };

/* =========================================================
   SANITIZE FFMPEG STDERR
========================================================= */

const sanitizeFfmpegOutput = (
  value
) => {
  return maskRtmpSecrets(
    String(
      value || ""
    )
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
};

/* =========================================================
   DETECT SUCCESSFUL STREAM CONNECTION
========================================================= */

const hasEncoderProgress = (
  message
) => {
  const normalizedMessage =
    String(message || "")
      .toLowerCase();

  return (
    normalizedMessage.includes("frame=") ||
    normalizedMessage.includes("out_time_ms=") ||
    normalizedMessage.includes("progress=continue")
  );
};

/* =========================================================
   DETECT COMMON FFMPEG FAILURE
========================================================= */

const detectFfmpegFailure = (
  message
) => {
  const normalizedMessage =
    String(
      message || ""
    ).toLowerCase();

  const failurePatterns = [
    {
      match:
        "server error",

      message:
        "The streaming platform rejected the RTMP connection.",
    },
    {
      match:
        "connection refused",

      message:
        "The streaming platform refused the RTMP connection.",
    },
    {
      match:
        "connection reset",

      message:
        "The RTMP connection was reset by the streaming platform.",
    },
    {
      match:
        "broken pipe",

      message:
        "The streaming platform closed the RTMP connection.",
    },
    {
      match:
        "input/output error",

      message:
        "An input or output error occurred while streaming.",
    },
    {
      match:
        "operation timed out",

      message:
        "The RTMP connection timed out.",
    },
    {
      match:
        "invalid argument",

      message:
        "FFmpeg received an invalid stream configuration.",
    },
    {
      match:
        "no such file or directory",

      message:
        "The selected input file or FFmpeg executable was not found.",
    },
    {
      match:
        "authentication failed",

      message:
        "The platform rejected the stream key or RTMP credentials.",
    },
    {
      match:
        "unauthorized",

      message:
        "The platform rejected the RTMP authorization.",
    },
    {
      match:
        "403 forbidden",

      message:
        "The platform rejected the stream request.",
    },
  ];

  const failure =
    failurePatterns.find(
      (
        item
      ) =>
        normalizedMessage.includes(
          item.match
        )
    );

  return (
    failure?.message ||
    null
  );
};

/* =========================================================
   DETECT TEE OUTPUT FAILURE
========================================================= */

const detectTeeOutputFailure = (
  message
) => {
  const text =
    String(message || "");

  const lowerText =
    text.toLowerCase();

  const indexPatterns = [
    /slave muxer #(\d+) failed/i,
    /tee.*slave.*#(\d+).*failed/i,
    /slave '(\d+)'.*failed/i,
  ];

  for (
    const pattern
    of indexPatterns
  ) {
    const match =
      text.match(pattern);

    if (match) {
      return {
        failed: true,
        outputIndex:
          Number(match[1]),
        allOutputsFailed:
          false,
        message:
          "The platform RTMP output failed.",
      };
    }
  }

  if (
    lowerText.includes(
      "all tee outputs failed"
    )
  ) {
    return {
      failed: true,
      outputIndex:
        null,
      allOutputsFailed:
        true,
      message:
        "All platform RTMP outputs failed.",
    };
  }

  return null;
};
/* =========================================================
   INVOKE CALLBACK SAFELY
========================================================= */

const invokeCallbackSafely =
  async (
    callback,
    payload,
    callbackName
  ) => {
    if (
      typeof callback !==
      "function"
    ) {
      return;
    }

    try {
      await callback(
        payload
      );
    } catch (error) {
      console.error(
        `${callbackName} CALLBACK ERROR:`,
        getSafeErrorMessage(
          error
        )
      );
    }
  };

/* =========================================================
   REMOVE ACTIVE PROCESS
========================================================= */

const removeActiveProcess = (
  key,
  processReference
) => {
  const currentEntry =
    activeProcesses.get(
      key
    );

  if (!currentEntry) {
    return;
  }

  /*
   * Only delete when the stored process is the same process.
   * This prevents an older exited FFmpeg process from deleting
   * a newer restarted process using the same key.
   */
  if (
    processReference &&
    currentEntry.process !==
      processReference
  ) {
    return;
  }

  activeProcesses.delete(
    key
  );
};

/* =========================================================
   START SINGLE FFMPEG STREAM
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

  sessionId =
    null,

  metadata =
    {},

  onStarted,

  onStreaming,

  onError,

  onExit,
}) => {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  const normalizedPlatform =
    validatePlatform(
      platform
    );

  const key =
    buildProcessKey(
      userId,
      normalizedPlatform
    );

  const existingEntry =
    activeProcesses.get(
      key
    );

  if (
    isProcessActive(
      existingEntry
    )
  ) {
    throw new Error(
      `${normalizedPlatform} stream is already running.`
    );
  }

  if (
    existingEntry
  ) {
    activeProcesses.delete(
      key
    );
  }

  const args =
    buildFfmpegArguments({
      input,

      outputUrl,

      platform:
        normalizedPlatform,

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
    });

  /*
   * Never print the arguments in production because the
   * final argument contains the private RTMP stream key.
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

        windowsHide:
          true,

        env: {
          ...process.env,
        },
      }
    );

  const entry = {
    key,

    process:
      ffmpegProcess,

    userId:
      String(
        userId
      ),

    platform:
      normalizedPlatform,

    sessionId:
      sessionId
        ? String(
            sessionId
          )
        : null,

    input,

    sourceType,

    startedAt:
      new Date(),

    connectedAt:
      null,

    stoppedAt:
      null,

    status:
      "starting",

    stderr:
      "",

    errorMessage:
      "",

    restartCount:
      0,

    metadata: {
      ...metadata,
    },
  };

  activeProcesses.set(
    key,
    entry
  );

  let startedCallbackCalled =
    false;

  let streamingCallbackCalled =
    false;

  let errorCallbackCalled =
    false;

  let exitCallbackCalled =
    false;

  /* =======================================================
     STARTED CALLBACK
  ======================================================= */

  const invokeStarted =
    async () => {
      if (
        startedCallbackCalled
      ) {
        return;
      }

      startedCallbackCalled =
        true;

      entry.status =
        "started";

      await invokeCallbackSafely(
        onStarted,
        {
          key,

          pid:
            ffmpegProcess.pid,

          userId:
            String(
              userId
            ),

          platform:
            normalizedPlatform,

          sessionId:
            entry.sessionId,

          startedAt:
            entry.startedAt,
        },
        "FFMPEG STARTED"
      );
    };

  /* =======================================================
     STREAMING CALLBACK
  ======================================================= */

  const invokeStreaming =
    async () => {
      if (
        streamingCallbackCalled
      ) {
        return;
      }

      streamingCallbackCalled =
        true;

      entry.status =
        "streaming";

      entry.connectedAt =
        new Date();

      await invokeCallbackSafely(
        onStreaming,
        {
          key,

          pid:
            ffmpegProcess.pid,

          userId:
            String(
              userId
            ),

          platform:
            normalizedPlatform,

          sessionId:
            entry.sessionId,

          startedAt:
            entry.startedAt,

          connectedAt:
            entry.connectedAt,
        },
        "FFMPEG STREAMING"
      );
    };

  /* =======================================================
     ERROR CALLBACK
  ======================================================= */

  const invokeError =
    async (
      error
    ) => {
      if (
        errorCallbackCalled
      ) {
        return;
      }

      errorCallbackCalled =
        true;

      const safeMessage =
        getSafeErrorMessage(
          error
        );

      entry.status =
        "failed";

      entry.errorMessage =
        safeMessage;

      await invokeCallbackSafely(
        onError,
        {
          key,

          pid:
            ffmpegProcess.pid,

          userId:
            String(
              userId
            ),

          platform:
            normalizedPlatform,

          sessionId:
            entry.sessionId,

          message:
            safeMessage,

          error:
            error instanceof Error
              ? error
              : new Error(
                  safeMessage
                ),
        },
        "FFMPEG ERROR"
      );
    };

  /* =======================================================
     EXIT CALLBACK
  ======================================================= */

  const invokeExit =
    async ({
      code,
      signal,
    }) => {
      if (
        exitCallbackCalled
      ) {
        return;
      }

      exitCallbackCalled =
        true;

      entry.stoppedAt =
        new Date();

      if (
        entry.status !==
          "failed"
      ) {
        entry.status =
          code === 0 ||
          signal ===
            "SIGTERM"
            ? "stopped"
            : "failed";
      }

      const sanitizedStderr =
        sanitizeFfmpegOutput(
          entry.stderr
        );

      await invokeCallbackSafely(
        onExit,
        {
          key,

          pid:
            ffmpegProcess.pid,

          userId:
            String(
              userId
            ),

          platform:
            normalizedPlatform,

          sessionId:
            entry.sessionId,

          code,

          signal,

          status:
            entry.status,

          startedAt:
            entry.startedAt,

          connectedAt:
            entry.connectedAt,

          stoppedAt:
            entry.stoppedAt,

          stderr:
            sanitizedStderr,

          errorMessage:
            entry.errorMessage ||
            "",
        },
        "FFMPEG EXIT"
      );
    };

  /* =======================================================
     SPAWN EVENT
  ======================================================= */

  ffmpegProcess.once(
    "spawn",
    () => {
      invokeStarted();
    }
  );

  /* =======================================================
     STDERR EVENT
  ======================================================= */

ffmpegProcess.stderr.on(
  "data",
  (chunk) => {
    const rawMessage =
      chunk.toString();

    entry.stderr =
      (
        entry.stderr +
        rawMessage
      ).slice(-20000);

   if (
    !streamingCallbackCalled &&
    hasEncoderProgress(rawMessage)
) {
    invokeStreaming();
}

    const detectedFailure =
      detectFfmpegFailure(
        rawMessage
      );

    if (
      detectedFailure &&
      entry.status !== "failed"
    ) {
      entry.errorMessage =
        detectedFailure;
    }

    if (FFMPEG_DEBUG) {
      const safeDebugMessage =
        maskRtmpSecrets(
          rawMessage
        ).trim();

      if (safeDebugMessage) {
        console.log(
          `[FFMPEG:${normalizedPlatform}]`,
          safeDebugMessage
        );
      }
    }
  }
);

  /* =======================================================
     PROCESS ERROR EVENT
  ======================================================= */

  ffmpegProcess.once(
    "error",
    async (
      error
    ) => {
      removeActiveProcess(
        key,
        ffmpegProcess
      );

      await invokeError(
        error
      );
    }
  );

  /* =======================================================
     PROCESS EXIT EVENT
  ======================================================= */

 /* =======================================================
   PROCESS CLOSE EVENT

   Use "close", not only "exit", because "close" runs
   after stderr/stdout have fully closed.
======================================================= */

ffmpegProcess.once(
  "close",
  async (
    code,
    signal
  ) => {
    const finalStderr =
      sanitizeFfmpegOutput(
        entry.stderr
      );

    console.log(
      `========== FFMPEG CLOSE: ${normalizedPlatform} ==========`
    );

    console.log(
      "Exit code:",
      code
    );

    console.log(
      "Signal:",
      signal
    );

    console.log(
      "Status before close:",
      entry.status
    );

    console.log(
      "Final stderr:",
      finalStderr ||
        "No stderr received."
    );

    console.log(
      "======================================================="
    );

    removeActiveProcess(
      key,
      ffmpegProcess
    );

    const manuallyStopped =
      signal === "SIGTERM" ||
      signal === "SIGKILL";

    const crashed =
      Boolean(signal) &&
      !manuallyStopped;

    const exitedWithError =
      code !== null &&
      code !== 0;

    /*
     * Do not call the error callback when FFmpeg was stopped
     * intentionally using SIGTERM or SIGKILL.
     */
    if (
      !manuallyStopped &&
      (
        exitedWithError ||
        crashed
      )
    ) {
      const signalMessage =
        signal === "SIGSEGV"
          ? "FFmpeg crashed with SIGSEGV. The FFmpeg binary or one of its codecs/filters is incompatible with the deployment environment."
          : signal
            ? `FFmpeg terminated with signal ${signal}.`
            : `FFmpeg exited with code ${
                code ?? "unknown"
              }.`;

      const detectedFailure =
        detectFfmpegFailure(
          entry.stderr
        );

      await invokeError(
        new Error(
          detectedFailure ||
          entry.errorMessage ||
          signalMessage
        )
      );
    }

    await invokeExit({
      code,
      signal,
    });
  }
);

  return {
    key,

    pid:
      ffmpegProcess.pid,

    userId:
      String(
        userId
      ),

    platform:
      normalizedPlatform,

    sessionId:
      entry.sessionId,

    status:
      entry.status,

    startedAt:
      entry.startedAt,
  };
};

/* =========================================================
   START STREAM AND WAIT FOR SPAWN
========================================================= */

/* =========================================================
   START STREAM AND WAIT FOR REAL STREAMING
========================================================= */

exports.startStreamAsync = (
  options
) => {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      let settled = false;

      const originalOnStarted =
        options.onStarted;

      const originalOnStreaming =
        options.onStreaming;

      const originalOnError =
        options.onError;

      const originalOnExit =
        options.onExit;

      const connectionTimeoutMs =
        Number(
          process.env
            .FFMPEG_CONNECTION_TIMEOUT_MS
        ) || 30000;

      let timeout = null;

      const clearConnectionTimeout =
        () => {
          if (timeout) {
            clearTimeout(timeout);
            timeout = null;
          }
        };

      const rejectOnce = (
        error
      ) => {
        if (settled) {
          return;
        }

        settled = true;

        clearConnectionTimeout();

        reject(
          error instanceof Error
            ? error
            : new Error(
                String(
                  error ||
                    "Unable to start stream."
                )
              )
        );
      };

      const resolveOnce = (
        payload
      ) => {
        if (settled) {
          return;
        }

        settled = true;

        clearConnectionTimeout();

        resolve(payload);
      };

      try {
        let startResult = null;

        startResult =
          exports.startStream({
            ...options,

            /*
             * Spawn only means the FFmpeg process exists.
             * Do not resolve the request here.
             */
            onStarted:
              async (
                payload
              ) => {
                await invokeCallbackSafely(
                  originalOnStarted,
                  payload,
                  "ORIGINAL STARTED"
                );
              },

            /*
             * Resolve only after stderr confirms that
             * FFmpeg opened the output or started frames.
             */
            onStreaming:
              async (
                payload
              ) => {
                await invokeCallbackSafely(
                  originalOnStreaming,
                  payload,
                  "ORIGINAL STREAMING"
                );

                resolveOnce({
                  ...startResult,
                  ...payload,
                  status:
                    "streaming",
                });
              },

            onError:
              async (
                payload
              ) => {
                await invokeCallbackSafely(
                  originalOnError,
                  payload,
                  "ORIGINAL ERROR"
                );

                rejectOnce(
                  payload?.error ||
                    new Error(
                      payload?.message ||
                        "FFmpeg failed to connect."
                    )
                );
              },

            onExit:
              async (
                payload
              ) => {
                await invokeCallbackSafely(
                  originalOnExit,
                  payload,
                  "ORIGINAL EXIT"
                );

                if (
                  !settled
                ) {
                  const stderr =
                    payload?.stderr ||
                    "";

                  rejectOnce(
                    new Error(
                      stderr ||
                        payload
                          ?.errorMessage ||
                        `FFmpeg exited before streaming. Code: ${
                          payload?.code ??
                          "unknown"
                        }`
                    )
                  );
                }
              },
          });

        timeout =
          setTimeout(
            async () => {
              if (settled) {
                return;
              }

              const processKey =
                startResult?.key;

              if (processKey) {
                try {
                  await exports
                    .stopProcessByKey(
                      processKey
                    );
                } catch (
                  stopError
                ) {
                  console.error(
                    "FFMPEG TIMEOUT STOP ERROR:",
                    getSafeErrorMessage(
                      stopError
                    )
                  );
                }
              }

              rejectOnce(
                new Error(
                  "FFmpeg started but could not connect to the RTMP server within 30 seconds. Verify the RTMP URL and stream key."
                )
              );
            },
            connectionTimeoutMs
          );
      } catch (error) {
        rejectOnce(error);
      }
    }
  );
};

/* =========================================================
   EXPORT PART 2 HELPERS
========================================================= */

exports.isProcessActive =
  isProcessActive;

exports.sanitizeFfmpegOutput =
  sanitizeFfmpegOutput;

exports.hasEncoderProgress =
  hasEncoderProgress;

exports.detectFfmpegFailure =
  detectFfmpegFailure;
exports.detectTeeOutputFailure =
  detectTeeOutputFailure;
exports.invokeCallbackSafely =
  invokeCallbackSafely;

exports.removeActiveProcess =
  removeActiveProcess;



  /* =========================================================
   PART 3 OF 4
   STOP STREAMS, CLEANUP AND SHUTDOWN
========================================================= */

/* =========================================================
   WAIT FOR PROCESS EXIT
========================================================= */

const waitForProcessExit = (
  ffmpegProcess,
  timeoutMs =
    5000
) => {
  return new Promise(
    (
      resolve
    ) => {
      if (
        !ffmpegProcess ||
        ffmpegProcess.exitCode !==
          null ||
        ffmpegProcess.killed
      ) {
        resolve({
          exited:
            true,

          alreadyStopped:
            true,

          code:
            ffmpegProcess
              ?.exitCode ??
            null,

          signal:
            null,
        });

        return;
      }

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

        clearTimeout(
          timeout
        );

        ffmpegProcess.removeListener(
          "exit",
          handleExit
        );

        resolve(
          result
        );
      };

      const handleExit = (
        code,
        signal
      ) => {
        finish({
          exited:
            true,

          alreadyStopped:
            false,

          code,

          signal,
        });
      };

      const timeout =
        setTimeout(
          () => {
            finish({
              exited:
                false,

              timedOut:
                true,

              code:
                ffmpegProcess
                  .exitCode,

              signal:
                null,
            });
          },
          timeoutMs
        );

      ffmpegProcess.once(
        "exit",
        handleExit
      );
    }
  );
};

/* =========================================================
   SEND PROCESS SIGNAL
========================================================= */

const sendProcessSignal = (
  ffmpegProcess,
  signal
) => {
  if (!ffmpegProcess) {
    return false;
  }

  if (
    ffmpegProcess.exitCode !==
      null ||
    ffmpegProcess.killed
  ) {
    return false;
  }

  try {
    return ffmpegProcess.kill(
      signal
    );
  } catch (error) {
    console.error(
      "FFMPEG SIGNAL ERROR:",
      getSafeErrorMessage(
        error
      )
    );

    return false;
  }
};

/* =========================================================
   STOP PROCESS ENTRY
========================================================= */

const stopProcessEntry =
  async (
    key,
    entry,
    {
      gracefulSignal =
        "SIGTERM",

      forceSignal =
        "SIGKILL",

      forceAfterMs =
        5000,

      removeFromMap =
        true,
    } = {}
  ) => {
    if (
      !entry ||
      !entry.process
    ) {
      if (
        removeFromMap
      ) {
        activeProcesses.delete(
          key
        );
      }

      return {
        key,

        stopped:
          false,

        alreadyStopped:
          true,

        message:
          "No active FFmpeg process was found.",
      };
    }

    const ffmpegProcess =
      entry.process;

    if (
      ffmpegProcess.exitCode !==
        null ||
      ffmpegProcess.killed
    ) {
      if (
        removeFromMap
      ) {
        removeActiveProcess(
          key,
          ffmpegProcess
        );
      }

      return {
        key,

        stopped:
          true,

        alreadyStopped:
          true,

        forced:
          false,

        code:
          ffmpegProcess.exitCode,

        signal:
          null,
      };
    }

    entry.status =
      "stopping";

    entry.stopRequestedAt =
      new Date();

    const gracefulSignalSent =
      sendProcessSignal(
        ffmpegProcess,
        gracefulSignal
      );

    if (
      !gracefulSignalSent
    ) {
      if (
        removeFromMap
      ) {
        removeActiveProcess(
          key,
          ffmpegProcess
        );
      }

      return {
        key,

        stopped:
          false,

        alreadyStopped:
          false,

        forced:
          false,

        message:
          "Unable to send the stop signal to FFmpeg.",
      };
    }

    const gracefulResult =
      await waitForProcessExit(
        ffmpegProcess,
        forceAfterMs
      );

    if (
      gracefulResult.exited
    ) {
      if (
        removeFromMap
      ) {
        removeActiveProcess(
          key,
          ffmpegProcess
        );
      }

      entry.status =
        "stopped";

      entry.stoppedAt =
        new Date();

      return {
        key,

        stopped:
          true,

        alreadyStopped:
          Boolean(
            gracefulResult
              .alreadyStopped
          ),

        forced:
          false,

        code:
          gracefulResult.code,

        signal:
          gracefulResult.signal ||
          gracefulSignal,

        stoppedAt:
          entry.stoppedAt,
      };
    }

    const forceSignalSent =
      sendProcessSignal(
        ffmpegProcess,
        forceSignal
      );

    if (
      !forceSignalSent
    ) {
      if (
        removeFromMap
      ) {
        removeActiveProcess(
          key,
          ffmpegProcess
        );
      }

      return {
        key,

        stopped:
          false,

        forced:
          false,

        message:
          "FFmpeg did not stop gracefully, and the force-stop signal could not be sent.",
      };
    }

    const forcedResult =
      await waitForProcessExit(
        ffmpegProcess,
        2000
      );

    if (
      removeFromMap
    ) {
      removeActiveProcess(
        key,
        ffmpegProcess
      );
    }

    entry.status =
      forcedResult.exited
        ? "stopped"
        : "failed";

    entry.stoppedAt =
      new Date();

    return {
      key,

      stopped:
        Boolean(
          forcedResult.exited
        ),

      alreadyStopped:
        false,

      forced:
        true,

      code:
        forcedResult.code,

      signal:
        forcedResult.signal ||
        forceSignal,

      stoppedAt:
        entry.stoppedAt,

      message:
        forcedResult.exited
          ? "FFmpeg was force-stopped."
          : "FFmpeg did not exit after the force-stop signal.",
    };
  };

/* =========================================================
   STOP ONE PLATFORM STREAM
========================================================= */

exports.stopStream =
  async (
    userId,
    platform,
    options =
      {}
  ) => {
    if (!userId) {
      throw new Error(
        "User ID is required."
      );
    }

    const normalizedPlatform =
      validatePlatform(
        platform
      );

    const key =
      buildProcessKey(
        userId,
        normalizedPlatform
      );

    const entry =
      activeProcesses.get(
        key
      );

    if (!entry) {
      return {
        key,

        userId:
          String(
            userId
          ),

        platform:
          normalizedPlatform,

        stopped:
          false,

        alreadyStopped:
          true,

        message:
          "No active FFmpeg process was found.",
      };
    }

    const result =
      await stopProcessEntry(
        key,
        entry,
        options
      );

    return {
      ...result,

      userId:
        String(
          userId
        ),

      platform:
        normalizedPlatform,

      sessionId:
        entry.sessionId ||
        null,
    };
  };

/* =========================================================
   STOP PROCESS USING KEY
========================================================= */

exports.stopProcessByKey =
  async (
    key,
    options =
      {}
  ) => {
    if (!key) {
      throw new Error(
        "Process key is required."
      );
    }

    const normalizedKey =
      String(
        key
      );

    const entry =
      activeProcesses.get(
        normalizedKey
      );

    if (!entry) {
      return {
        key:
          normalizedKey,

        stopped:
          false,

        alreadyStopped:
          true,

        message:
          "No active FFmpeg process was found.",
      };
    }

    const result =
      await stopProcessEntry(
        normalizedKey,
        entry,
        options
      );

    return {
      ...result,

      userId:
        entry.userId,

      platform:
        entry.platform,

      sessionId:
        entry.sessionId ||
        null,
    };
  };

/* =========================================================
   STOP ALL STREAMS FOR USER
========================================================= */

exports.stopAllForUser =
  async (
    userId,
    options =
      {}
  ) => {
    if (!userId) {
      throw new Error(
        "User ID is required."
      );
    }

    const normalizedUserId =
      String(
        userId
      );

    const matchingEntries =
      Array.from(
        activeProcesses.entries()
      )
        .filter(
          ([
            ,
            entry,
          ]) =>
            entry.userId ===
            normalizedUserId
        );

    const uniqueByProcess =
      new Map();

    for (
      const [
        key,
        entry,
      ]
      of matchingEntries
    ) {
      const uniqueKey =
        entry.process?.pid ||
        key;

      if (
        !uniqueByProcess.has(
          uniqueKey
        ) ||
        entry.platform ===
          "multi"
      ) {
        uniqueByProcess.set(
          uniqueKey,
          {
            key,
            entry,
          }
        );
      }
    }

    const uniqueEntries =
      Array.from(
        uniqueByProcess.values()
      );

    if (
      uniqueEntries.length ===
      0
    ) {
      return {
        success:
          true,

        userId:
          normalizedUserId,

        total:
          0,

        stopped:
          0,

        failed:
          0,

        results:
          [],
      };
    }

    const settledResults =
      await Promise.allSettled(
        uniqueEntries.map(
          ({
            key,
          }) =>
            exports.stopProcessByKey(
              key,
              options
            )
        )
      );

    const results =
      settledResults.map(
        (
          result,
          index
        ) => {
          const processInfo =
            uniqueEntries[
              index
            ];

          if (
            result.status ===
            "fulfilled"
          ) {
            return {
              success:
                Boolean(
                  result.value
                    ?.stopped ||
                  result.value
                    ?.alreadyStopped
                ),

              platform:
                processInfo.entry
                  .platform,

              key:
                processInfo.key,

              result:
                result.value,

              error:
                null,
            };
          }

          return {
            success:
              false,

            platform:
              processInfo.entry
                .platform,

            key:
              processInfo.key,

            result:
              null,

            error:
              getSafeErrorMessage(
                result.reason
              ),
          };
        }
      );

    const stoppedCount =
      results.filter(
        (item) =>
          item.success
      ).length;

    return {
      success:
        stoppedCount ===
        results.length,

      userId:
        normalizedUserId,

      total:
        results.length,

      stopped:
        stoppedCount,

      failed:
        results.length -
        stoppedCount,

      results,
    };
  };

/* =========================================================
   STOP ALL STREAMS FOR SESSION
========================================================= */

exports.stopAllForSession =
  async (
    userId,
    sessionId,
    options =
      {}
  ) => {
    if (!userId) {
      throw new Error(
        "User ID is required."
      );
    }

    if (!sessionId) {
      throw new Error(
        "Session ID is required."
      );
    }

    const normalizedUserId =
      String(
        userId
      );

    const normalizedSessionId =
      String(
        sessionId
      );

    const matchingEntries =
      Array.from(
        activeProcesses.entries()
      )
        .filter(
          ([
            ,
            entry,
          ]) =>
            entry.userId ===
              normalizedUserId &&
            entry.sessionId ===
              normalizedSessionId
        );

    const uniqueByProcess =
      new Map();

    for (
      const [
        key,
        entry,
      ]
      of matchingEntries
    ) {
      const uniqueKey =
        entry.process?.pid ||
        key;

      if (
        !uniqueByProcess.has(
          uniqueKey
        ) ||
        entry.platform ===
          "multi"
      ) {
        uniqueByProcess.set(
          uniqueKey,
          {
            key,
            entry,
          }
        );
      }
    }

    const uniqueEntries =
      Array.from(
        uniqueByProcess.values()
      );

    if (
      uniqueEntries.length ===
      0
    ) {
      return {
        success:
          true,

        userId:
          normalizedUserId,

        sessionId:
          normalizedSessionId,

        total:
          0,

        stopped:
          0,

        failed:
          0,

        results:
          [],
      };
    }

    const settledResults =
      await Promise.allSettled(
        uniqueEntries.map(
          ({
            key,
          }) =>
            exports.stopProcessByKey(
              key,
              options
            )
        )
      );

    const results =
      settledResults.map(
        (
          result,
          index
        ) => {
          const match =
            uniqueEntries[
              index
            ];

          if (
            result.status ===
            "fulfilled"
          ) {
            return {
              success:
                Boolean(
                  result.value
                    ?.stopped ||
                  result.value
                    ?.alreadyStopped
                ),

              key:
                match.key,

              platform:
                match.entry
                  .platform,

              result:
                result.value,

              error:
                null,
            };
          }

          return {
            success:
              false,

            key:
              match.key,

            platform:
              match.entry
                .platform,

            result:
              null,

            error:
              getSafeErrorMessage(
                result.reason
              ),
          };
        }
      );

    const stoppedCount =
      results.filter(
        (item) =>
          item.success
      ).length;

    return {
      success:
        stoppedCount ===
        results.length,

      userId:
        normalizedUserId,

      sessionId:
        normalizedSessionId,

      total:
        results.length,

      stopped:
        stoppedCount,

      failed:
        results.length -
        stoppedCount,

      results,
    };
  };

/* =========================================================
   CLEANUP STALE PROCESSES
========================================================= */

exports.cleanupStaleProcesses =
  () => {
    const removed = [];

    for (
      const [
        key,
        entry,
      ] of activeProcesses.entries()
    ) {
      if (
        !isProcessActive(
          entry
        )
      ) {
        activeProcesses.delete(
          key
        );

        removed.push({
          key,

          userId:
            entry.userId,

          platform:
            entry.platform,

          sessionId:
            entry.sessionId ||
            null,

          exitCode:
            entry.process
              ?.exitCode ??
            null,

          killed:
            Boolean(
              entry.process
                ?.killed
            ),
        });
      }
    }

    return {
      removedCount:
        removed.length,

      removed,
    };
  };

/* =========================================================
   CLEANUP OLD PROCESS ENTRIES
========================================================= */

exports.cleanupProcessesOlderThan =
  async (
    maximumAgeMs =
      24 *
      60 *
      60 *
      1000,
    {
      stopActive =
        false,
    } = {}
  ) => {
    const safeMaximumAge =
      sanitizeInteger(
        maximumAgeMs,
        24 *
          60 *
          60 *
          1000,
        60000,
        7 *
          24 *
          60 *
          60 *
          1000
      );

    const now =
      Date.now();

    const oldEntries =
      Array.from(
        activeProcesses.entries()
      )
        .filter(
          ([
            ,
            entry,
          ]) => {
            const startedAt =
              entry.startedAt
                ? new Date(
                    entry.startedAt
                  ).getTime()
                : 0;

            return (
              startedAt > 0 &&
              now -
                startedAt >=
                safeMaximumAge
            );
          }
        )
        .map(
          ([
            key,
            entry,
          ]) => ({
            key,
            entry,
          })
        );

    const results = [];

    for (
      const {
        key,
        entry,
      } of oldEntries
    ) {
      if (
        isProcessActive(
          entry
        ) &&
        stopActive
      ) {
        try {
          const result =
            await exports
              .stopProcessByKey(
                key
              );

          results.push({
            key,

            action:
              "stopped",

            success:
              Boolean(
                result.stopped ||
                result.alreadyStopped
              ),

            result,
          });
        } catch (error) {
          results.push({
            key,

            action:
              "stop-failed",

            success:
              false,

            error:
              getSafeErrorMessage(
                error
              ),
          });
        }

        continue;
      }

      if (
        !isProcessActive(
          entry
        )
      ) {
        activeProcesses.delete(
          key
        );

        results.push({
          key,

          action:
            "removed",

          success:
            true,
        });
      }
    }

    return {
      total:
        oldEntries.length,

      processed:
        results.length,

      results,
    };
  };

/* =========================================================
   KILL ORPHANED PROCESS
========================================================= */

exports.killProcessByPid =
  async (
    pid,
    {
      signal =
        "SIGTERM",

      forceAfterMs =
        3000,
    } = {}
  ) => {
    const numericPid =
      Number(
        pid
      );

    if (
      !Number.isInteger(
        numericPid
      ) ||
      numericPid <= 0
    ) {
      throw new Error(
        "A valid process ID is required."
      );
    }

    let processEntry =
      null;

    let processKey =
      null;

    for (
      const [
        key,
        entry,
      ] of activeProcesses.entries()
    ) {
      if (
        entry.process?.pid ===
        numericPid
      ) {
        processEntry =
          entry;

        processKey =
          key;

        break;
      }
    }

    if (
      processEntry &&
      processKey
    ) {
      return exports
        .stopProcessByKey(
          processKey,
          {
            gracefulSignal:
              signal,

            forceAfterMs,
          }
        );
    }

    try {
      process.kill(
        numericPid,
        signal
      );
    } catch (error) {
      if (
        error.code ===
        "ESRCH"
      ) {
        return {
          pid:
            numericPid,

          stopped:
            true,

          alreadyStopped:
            true,

          message:
            "The process does not exist.",
        };
      }

      throw error;
    }

    await new Promise(
      (
        resolve
      ) =>
        setTimeout(
          resolve,
          forceAfterMs
        )
    );

    try {
      process.kill(
        numericPid,
        0
      );

      process.kill(
        numericPid,
        "SIGKILL"
      );

      return {
        pid:
          numericPid,

        stopped:
          true,

        forced:
          true,
      };
    } catch (error) {
      if (
        error.code ===
        "ESRCH"
      ) {
        return {
          pid:
            numericPid,

          stopped:
            true,

          forced:
            false,
        };
      }

      throw error;
    }
  };

/* =========================================================
   GET STREAM HEALTH
========================================================= */

exports.getStreamHealth = (
  userId,
  platform
) => {
  const normalizedPlatform =
    validatePlatform(
      platform
    );

  const entry =
    exports.getProcess(
      userId,
      normalizedPlatform
    );

  if (!entry) {
    return {
      userId:
        String(
          userId
        ),

      platform:
        normalizedPlatform,

      active:
        false,

      status:
        "stopped",

      pid:
        null,

      startedAt:
        null,

      connectedAt:
        null,

      uptimeSeconds:
        0,

      errorMessage:
        "",
    };
  }

  const active =
    isProcessActive(
      entry
    );

  const startedAt =
    entry.startedAt
      ? new Date(
          entry.startedAt
        )
      : null;

  const uptimeSeconds =
    active &&
    startedAt
      ? Math.max(
          0,
          Math.floor(
            (
              Date.now() -
              startedAt.getTime()
            ) /
              1000
          )
        )
      : 0;

  return {
    userId:
      entry.userId,

    platform:
      normalizedPlatform,

    sessionId:
      entry.sessionId ||
      null,

    active,

    status:
      entry.status ||
      (
        active
          ? "streaming"
          : "stopped"
      ),

    pid:
      entry.process?.pid ||
      null,

    startedAt:
      entry.startedAt ||
      null,

    connectedAt:
      entry.connectedAt ||
      null,

    stoppedAt:
      entry.stoppedAt ||
      null,

    uptimeSeconds,

    errorMessage:
      entry.errorMessage ||
      "",
  };
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

  const processes =
    exports.getUserProcesses(
      userId
    );

  const streams =
    processes.map(
      (
        processInfo
      ) =>
        exports.getStreamHealth(
          userId,
          processInfo.platform
        )
    );

  const activeCount =
    streams.filter(
      (
        stream
      ) =>
        stream.active
    ).length;

  return {
    userId:
      String(
        userId
      ),

    total:
      streams.length,

    active:
      activeCount,

    inactive:
      streams.length -
      activeCount,

    streams,
  };
};

/* =========================================================
   STOP ALL ACTIVE FFMPEG PROCESSES
========================================================= */

exports.stopAllProcesses =
  async (
    options =
      {}
  ) => {
    const entries =
      Array.from(
        activeProcesses.entries()
      ).map(
        ([
          key,
          entry,
        ]) => ({
          key,
          entry,
        })
      );

    if (
      entries.length ===
      0
    ) {
      return {
        success:
          true,

        total:
          0,

        stopped:
          0,

        failed:
          0,

        results:
          [],
      };
    }

    const settledResults =
      await Promise.allSettled(
        entries.map(
          ({
            key,
          }) =>
            exports.stopProcessByKey(
              key,
              options
            )
        )
      );

    const results =
      settledResults.map(
        (
          result,
          index
        ) => {
          const processEntry =
            entries[
              index
            ];

          if (
            result.status ===
            "fulfilled"
          ) {
            return {
              success:
                Boolean(
                  result.value
                    ?.stopped ||
                  result.value
                    ?.alreadyStopped
                ),

              key:
                processEntry.key,

              userId:
                processEntry.entry
                  .userId,

              platform:
                processEntry.entry
                  .platform,

              result:
                result.value,

              error:
                null,
            };
          }

          return {
            success:
              false,

            key:
              processEntry.key,

            userId:
              processEntry.entry
                .userId,

            platform:
              processEntry.entry
                .platform,

            result:
              null,

            error:
              getSafeErrorMessage(
                result.reason
              ),
          };
        }
      );

    const stoppedCount =
      results.filter(
        (
          item
        ) =>
          item.success
      ).length;

    return {
      success:
        stoppedCount ===
        results.length,

      total:
        results.length,

      stopped:
        stoppedCount,

      failed:
        results.length -
        stoppedCount,

      results,
    };
  };

/* =========================================================
   GRACEFUL SERVER SHUTDOWN
========================================================= */

let shutdownInProgress =
  false;

exports.shutdown =
  async ({
    forceAfterMs =
      2000,
  } = {}) => {
    if (
      shutdownInProgress
    ) {
      return {
        success:
          true,

        skipped:
          true,

        message:
          "FFmpeg shutdown is already in progress.",
      };
    }

    shutdownInProgress =
      true;

    try {
      const result =
        await exports
          .stopAllProcesses({
            forceAfterMs,
          });

      activeProcesses.clear();

      return {
        ...result,

        shutdown:
          true,
      };
    } finally {
      shutdownInProgress =
        false;
    }
  };

/* =========================================================
   REGISTER PROCESS SHUTDOWN HANDLERS
========================================================= */

let shutdownHandlersRegistered =
  false;

exports.registerShutdownHandlers = ({
  exitProcess =
    true,
} = {}) => {
  if (
    shutdownHandlersRegistered
  ) {
    return;
  }

  shutdownHandlersRegistered =
    true;

  const handleShutdown =
    async (
      signal
    ) => {
      console.log(
        `Received ${signal}. Stopping FFmpeg streams...`
      );

      try {
        await exports.shutdown({
          forceAfterMs:
            2000,
        });
      } catch (error) {
        console.error(
          "FFMPEG SHUTDOWN ERROR:",
          getSafeErrorMessage(
            error
          )
        );
      }

      if (
        exitProcess
      ) {
        process.exit(
          0
        );
      }
    };

  process.once(
    "SIGTERM",
    () => {
      handleShutdown(
        "SIGTERM"
      );
    }
  );

  process.once(
    "SIGINT",
    () => {
      handleShutdown(
        "SIGINT"
      );
    }
  );
};

/* =========================================================
   EXPORT PART 3 HELPERS
========================================================= */

exports.waitForProcessExit =
  waitForProcessExit;

exports.sendProcessSignal =
  sendProcessSignal;

exports.stopProcessEntry =
  stopProcessEntry;


  /* =========================================================
   PART 4 OF 4
   MULTI-PLATFORM STREAMING
========================================================= */

/* =========================================================
   GENERATE SESSION ID
========================================================= */

const generateSessionId =
  () => {
    return (
      Date.now().toString(36) +
      "-" +
      Math.random()
        .toString(36)
        .slice(
          2,
          10
        )
    );
  };

/* =========================================================
   NORMALIZE DESTINATION
========================================================= */

const normalizeDestination = (
  destination
) => {
  if (
    !destination ||
    typeof destination !==
      "object"
  ) {
    throw new Error(
      "Each streaming destination must be an object."
    );
  }

  const platform =
    validatePlatform(
      destination.platform
    );

  const outputUrl =
    validateOutputUrl(
      destination.outputUrl ||
      destination.destination ||
      destination.rtmpDestination ||
      destination.url
    );

  return {
    platform,

    outputUrl,

    enabled:
      destination.enabled !==
      false,

    videoBitrate:
      destination.videoBitrate,

    audioBitrate:
      destination.audioBitrate,

    width:
      destination.width,

    height:
      destination.height,

    fps:
      destination.fps,

    keyframeInterval:
      destination.keyframeInterval,

    preset:
      destination.preset,

    includeAudio:
      destination.includeAudio !==
      false,

    metadata: {
      ...(
        destination.metadata ||
        {}
      ),
    },
  };
};

/* =========================================================
   NORMALIZE DESTINATIONS
========================================================= */

const normalizeDestinations = (
  destinations
) => {
  if (
    !Array.isArray(
      destinations
    )
  ) {
    throw new Error(
      "Streaming destinations must be an array."
    );
  }

  const normalized =
    destinations
      .map(
        normalizeDestination
      )
      .filter(
        (
          destination
        ) =>
          destination.enabled
      );

  if (
    normalized.length ===
    0
  ) {
    throw new Error(
      "At least one enabled streaming destination is required."
    );
  }

  const duplicatePlatforms =
    normalized
      .map(
        (
          destination
        ) =>
          destination.platform
      )
      .filter(
        (
          platform,
          index,
          platforms
        ) =>
          platforms.indexOf(
            platform
          ) !==
          index
      );

  if (
    duplicatePlatforms.length >
    0
  ) {
    throw new Error(
      `Duplicate streaming destinations found: ${[
        ...new Set(
          duplicatePlatforms
        ),
      ].join(", ")}.`
    );
  }

  return normalized;
};

/* =========================================================
   BUILD SAFE DESTINATION DETAILS
========================================================= */

const buildSafeDestinationInfo = (
  destination
) => {
  return {
    platform:
      destination.platform,

    enabled:
      destination.enabled,

    videoBitrate:
      destination.videoBitrate ||
      null,

    audioBitrate:
      destination.audioBitrate ||
      null,

    width:
      destination.width ||
      null,

    height:
      destination.height ||
      null,

    fps:
      destination.fps ||
      null,

    keyframeInterval:
      destination.keyframeInterval ||
      null,

    includeAudio:
      destination.includeAudio !==
      false,

    /*
     * Never return outputUrl because it contains
     * the user's private stream key.
     */
    configured:
      Boolean(
        destination.outputUrl
      ),
  };
};

/* =========================================================
   GET SESSION PROCESSES
========================================================= */

exports.getSessionProcesses = (
  userId,
  sessionId
) => {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  if (!sessionId) {
    throw new Error(
      "Session ID is required."
    );
  }

  const normalizedUserId =
    String(
      userId
    );

  const normalizedSessionId =
    String(
      sessionId
    );

  return Array.from(
    activeProcesses.entries()
  )
    .filter(
      ([
        ,
        entry,
      ]) =>
        entry.userId ===
          normalizedUserId &&
        entry.sessionId ===
          normalizedSessionId
    )
    .map(
      ([
        key,
        entry,
      ]) => ({
        key,

        userId:
          entry.userId,

        platform:
          entry.platform,

        sessionId:
          entry.sessionId,

        pid:
          entry.process?.pid ||
          null,

        active:
          isProcessActive(
            entry
          ),

        status:
          entry.status ||
          "unknown",

        startedAt:
          entry.startedAt ||
          null,

        connectedAt:
          entry.connectedAt ||
          null,

        stoppedAt:
          entry.stoppedAt ||
          null,

        errorMessage:
          entry.errorMessage ||
          "",
      })
    );
};

/* =========================================================
   GET MULTI-STREAM STATUS
========================================================= */

exports.getMultiStreamStatus = (
  userId,
  sessionId
) => {
  const streams =
    exports.getSessionProcesses(
      userId,
      sessionId
    );

  const active =
    streams.filter(
      (
        stream
      ) =>
        stream.active
    );

  const streaming =
    streams.filter(
      (
        stream
      ) =>
        stream.status ===
        "streaming"
    );

  const failed =
    streams.filter(
      (
        stream
      ) =>
        stream.status ===
        "failed"
    );

  const starting =
    streams.filter(
      (
        stream
      ) =>
        [
          "starting",
          "started",
        ].includes(
          stream.status
        )
    );

  return {
    userId:
      String(
        userId
      ),

    sessionId:
      String(
        sessionId
      ),

    total:
      streams.length,

    active:
      active.length,

    streaming:
      streaming.length,

    starting:
      starting.length,

    failed:
      failed.length,

    stopped:
      streams.length -
      active.length,

    fullyActive:
      streams.length >
        0 &&
      active.length ===
        streams.length,

    fullyStreaming:
      streams.length >
        0 &&
      streaming.length ===
        streams.length,

    partiallyActive:
      active.length >
        0 &&
      active.length <
        streams.length,

    streams,
  };
};

/* =========================================================
   START MULTI-PLATFORM STREAM

   One FFmpeg process is created for every destination.

   Advantages:
   - One platform failure does not necessarily stop others.
   - Each platform can use different resolution/bitrate.
   - Individual platforms can be stopped separately.
   - Easier per-platform status tracking.
========================================================= */

exports.startMultiStream =
  async ({
    userId,

    input,

    destinations,

    sourceType =
      "file",

    loop =
      true,

    sessionId =
      generateSessionId(),

   defaultVideoBitrate = 600,

defaultAudioBitrate = 64,

defaultWidth = 426,

defaultHeight = 240,

defaultFps = 15,

    defaultKeyframeInterval =
      2,

    defaultPreset =
      "ultrafast",

    includeAudio =
      true,

    reconnect =
      true,

    rollbackOnFailure =
      false,

    metadata =
      {},

    onPlatformStarted,

    onPlatformStreaming,

    onPlatformError,

    onPlatformExit,

    onSessionStarted,

    onSessionError,
  }) => {
    if (!userId) {
      throw new Error(
        "User ID is required."
      );
    }

    const normalizedDestinations =
      normalizeDestinations(
        destinations
      );

    const normalizedSessionId =
      String(
        sessionId
      );

    const platforms =
      normalizedDestinations.map(
        (destination) =>
          destination.platform
      );

    const alreadyRunning =
      platforms.filter(
        (platform) =>
          exports.isStreaming(
            userId,
            platform
          )
      );

    if (
      alreadyRunning.length >
      0
    ) {
      throw new Error(
        `The following streams are already running: ${alreadyRunning.join(
          ", "
        )}.`
      );
    }

    const processKey =
      buildMultiProcessKey(
        userId,
        normalizedSessionId
      );

    const existingEntry =
      activeProcesses.get(
        processKey
      );

    if (
      isProcessActive(
        existingEntry
      )
    ) {
      throw new Error(
        "This multi-platform session is already running."
      );
    }

    const {
      args,

      destinations:
        safeDestinations,

      encoding,
    } =
      buildMultiOutputArguments({
        input,

        destinations:
          normalizedDestinations,

        sourceType,

        loop,

        videoBitrate:
          defaultVideoBitrate,

        audioBitrate:
          defaultAudioBitrate,

        width:
          defaultWidth,

        height:
          defaultHeight,

        fps:
          defaultFps,

        keyframeInterval:
          defaultKeyframeInterval,

        preset:
          defaultPreset,

        includeAudio,

        reconnect,
      });

    console.log(
      "STARTING SHARED FFMPEG SESSION:",
      {
        userId:
          String(
            userId
          ),

        sessionId:
          normalizedSessionId,

        platforms,

        destinationCount:
          platforms.length,

        loop:
          Boolean(
            loop
          ),

        encoding,
      }
    );

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

          windowsHide:
            true,

          env: {
            ...process.env,
          },
        }
      );

    const entry = {
      key:
        processKey,

      process:
        ffmpegProcess,

      userId:
        String(
          userId
        ),

      platform:
        "multi",

      platforms,

      sessionId:
        normalizedSessionId,

      input,

      sourceType,

      startedAt:
        new Date(),

      connectedAt:
        null,

      stoppedAt:
        null,

      status:
        "starting",

      stderr:
        "",

      errorMessage:
        "",

      metadata: {
        ...metadata,

        multiStream:
          true,

        sharedEncoder:
          true,

        rollbackOnFailure:
          Boolean(
            rollbackOnFailure
          ),
      },
    };

    activeProcesses.set(
      processKey,
      entry
    );

    for (
      const platform
      of platforms
    ) {
      const platformKey =
        buildProcessKey(
          userId,
          platform
        );

      activeProcesses.set(
        platformKey,
        {
          ...entry,

          key:
            platformKey,

          platform,

          parentKey:
            processKey,

          sharedProcess:
            true,
        }
      );
    }

    let promiseSettled = false;

let encoderStarted = false;

let errorCalled = false;

let confirmationTimer = null;

const platformStates =
  new Map(
    platforms.map(
      (
        platform,
        index
      ) => [
        platform,
        {
          index,
          status:
            "starting",
          errorMessage:
            "",
        },
      ]
    )
  );

    const connectionTimeoutMs =
      Number(
        process.env
          .FFMPEG_CONNECTION_TIMEOUT_MS
      ) ||
      60000;

    const cleanupEntries =
      () => {
        const currentParent =
          activeProcesses.get(
            processKey
          );

        if (
          currentParent?.process ===
          ffmpegProcess
        ) {
          activeProcesses.delete(
            processKey
          );
        }

        for (
          const platform
          of platforms
        ) {
          const platformKey =
            buildProcessKey(
              userId,
              platform
            );

          const platformEntry =
            activeProcesses.get(
              platformKey
            );

          if (
            platformEntry?.process ===
            ffmpegProcess
          ) {
            activeProcesses.delete(
              platformKey
            );
          }
        }
      };

    const updateAliasStatuses =
      (
        status,
        values =
          {}
      ) => {
        entry.status =
          status;

        Object.assign(
          entry,
          values
        );

        for (
          const platform
          of platforms
        ) {
          const platformEntry =
            activeProcesses.get(
              buildProcessKey(
                userId,
                platform
              )
            );

          if (
            platformEntry?.process ===
            ffmpegProcess
          ) {
            platformEntry.status =
              status;

            Object.assign(
              platformEntry,
              values
            );
          }
        }
      };

    const invokeAllPlatformCallbacks =
      async (
        callback,
        basePayload,
        callbackName
      ) => {
        await Promise.allSettled(
          platforms.map(
            (platform) =>
              invokeCallbackSafely(
                callback,
                {
                  ...basePayload,

                  key:
                    buildProcessKey(
                      userId,
                      platform
                    ),

                  parentKey:
                    processKey,

                  pid:
                    ffmpegProcess.pid,

                  userId:
                    String(
                      userId
                    ),

                  platform,

                  sessionId:
                    normalizedSessionId,

                  sharedProcess:
                    true,
                },
                callbackName
              )
          )
        );
      };
const invokePlatformCallback =
  async (
    callback,
    platform,
    basePayload,
    callbackName
  ) => {
    await invokeCallbackSafely(
      callback,
      {
        ...basePayload,

        key:
          buildProcessKey(
            userId,
            platform
          ),

        parentKey:
          processKey,

        pid:
          ffmpegProcess.pid,

        userId:
          String(userId),

        platform,

        sessionId:
          normalizedSessionId,

        sharedProcess:
          true,
      },
      callbackName
    );
  };
    return new Promise(
      (
        resolve,
        reject
      ) => {
        const resolveOnce =
          (
            value
          ) => {
            if (
              promiseSettled
            ) {
              return;
            }

            promiseSettled =
              true;

            clearTimeout(
              timeout
            );

            resolve(
              value
            );
          };

        const rejectOnce =
          (
            error
          ) => {
            if (
              promiseSettled
            ) {
              return;
            }

            promiseSettled =
              true;

            clearTimeout(
              timeout
            );

            reject(
              error instanceof Error
                ? error
                : new Error(
                    String(
                      error
                    )
                  )
            );
          };

        const timeout =
          setTimeout(
            async () => {
             if (
  encoderStarted &&
  promiseSettled
) {
  return;
}

              try {
                if (confirmationTimer) {
  clearTimeout(confirmationTimer);
  confirmationTimer = null;
}
                ffmpegProcess.kill(
                  "SIGTERM"
                );
              } catch (
                stopError
              ) {
                console.error(
                  "SHARED FFMPEG TIMEOUT STOP ERROR:",
                  getSafeErrorMessage(
                    stopError
                  )
                );
              }

              cleanupEntries();

              const timeoutError =
                new Error(
                  `FFmpeg could not start the multi-platform stream within ${Math.round(
                    connectionTimeoutMs /
                    1000
                  )} seconds.`
                );

              await invokeCallbackSafely(
                onSessionError,
                {
                  userId:
                    String(
                      userId
                    ),

                  sessionId:
                    normalizedSessionId,

                  platforms,

                  message:
                    timeoutError.message,
                },
                "SHARED SESSION TIMEOUT"
              );

              rejectOnce(
                timeoutError
              );
            },
            connectionTimeoutMs
          );

        ffmpegProcess.once(
          "spawn",
          async () => {
            updateAliasStatuses(
              "started"
            );

            await invokeAllPlatformCallbacks(
              onPlatformStarted,
              {
                startedAt:
                  entry.startedAt,
              },
              "SHARED PLATFORM STARTED"
            );
          }
        );

        ffmpegProcess.stderr.on(
  "data",
  async (
    chunk
  ) => {
    const rawMessage =
      chunk.toString();

    entry.stderr =
      (
        entry.stderr +
        rawMessage
      ).slice(
        -30000
      );

    if (
      FFMPEG_DEBUG
    ) {
      const safeLogMessage =
        maskRtmpSecrets(
          rawMessage
        ).trim();

      if (
        safeLogMessage
      ) {
        console.log(
          "[FFMPEG:MULTI]",
          safeLogMessage
        );
      }
    }

    const detectedFailure =
      detectFfmpegFailure(
        rawMessage
      );

    if (
      detectedFailure
    ) {
      entry.errorMessage =
        detectedFailure;
    }

    /*
     * Detect individual tee output failures.
     */
    const teeFailure =
      detectTeeOutputFailure(
        rawMessage
      );

    if (
      teeFailure
    ) {
      if (
        teeFailure.allOutputsFailed
      ) {
        for (
          const platform
          of platforms
        ) {
          const state =
            platformStates.get(
              platform
            );

          if (
            !state ||
            state.status ===
              "failed"
          ) {
            continue;
          }

          state.status =
            "failed";

          state.errorMessage =
            teeFailure.message;

          await invokePlatformCallback(
            onPlatformError,
            platform,
            {
              message:
                teeFailure.message,

              error:
                new Error(
                  teeFailure.message
                ),
            },
            "SHARED PLATFORM TEE ERROR"
          );
        }
      } else {
        const failedDestination =
          safeDestinations[
            teeFailure.outputIndex
          ];

        const failedPlatform =
          failedDestination
            ?.platform;

        if (
          failedPlatform
        ) {
          const state =
            platformStates.get(
              failedPlatform
            );

          if (
            state &&
            state.status !==
              "failed"
          ) {
            state.status =
              "failed";

            state.errorMessage =
              teeFailure.message;

            await invokePlatformCallback(
              onPlatformError,
              failedPlatform,
              {
                message:
                  teeFailure.message,

                error:
                  new Error(
                    teeFailure.message
                  ),
              },
              "SHARED PLATFORM TEE ERROR"
            );
          }
        }
      }
    }

    /*
     * Encoder progress only confirms that FFmpeg is processing
     * frames. Wait briefly before considering non-failed
     * destinations active.
     */
    if (
      !encoderStarted &&
      hasEncoderProgress(
        rawMessage
      )
    ) {
      encoderStarted =
        true;

      entry.status =
        "pushing";

      if (
        confirmationTimer
      ) {
        clearTimeout(
          confirmationTimer
        );
      }

      confirmationTimer =
        setTimeout(
          async () => {
            const connectedAt =
              new Date();

            const successfulPlatforms =
              platforms.filter(
                (platform) =>
                  platformStates.get(
                    platform
                  )?.status !==
                    "failed"
              );

            const failedPlatforms =
              platforms.filter(
                (platform) =>
                  platformStates.get(
                    platform
                  )?.status ===
                    "failed"
              );

            for (
              const platform
              of successfulPlatforms
            ) {
              const state =
                platformStates.get(
                  platform
                );

              state.status =
                "streaming";

              await invokePlatformCallback(
                onPlatformStreaming,
                platform,
                {
                  startedAt:
                    entry.startedAt,

                  connectedAt,
                },
                "SHARED PLATFORM STREAMING"
              );
            }

            if (
              successfulPlatforms.length ===
              0
            ) {
              const noOutputError =
                new Error(
                  "FFmpeg is encoding, but all RTMP destinations failed."
                );

              await invokeCallbackSafely(
                onSessionError,
                {
                  userId:
                    String(userId),

                  sessionId:
                    normalizedSessionId,

                  platforms,

                  message:
                    noOutputError.message,
                },
                "SHARED SESSION OUTPUT ERROR"
              );

              rejectOnce(
                noOutputError
              );

              return;
            }

            updateAliasStatuses(
              "streaming",
              {
                connectedAt,
              }
            );

            const results =
              platforms.map(
                (platform) => {
                  const state =
                    platformStates.get(
                      platform
                    );

                  return {
                    success:
                      state.status ===
                      "streaming",

                    platform,

                    result:
                      state.status ===
                      "streaming"
                        ? {
                            pid:
                              ffmpegProcess.pid,

                            status:
                              "streaming",

                            sharedProcess:
                              true,
                          }
                        : null,

                    error:
                      state.errorMessage ||
                      null,
                  };
                }
              );

            const response = {
              success:
                successfulPlatforms.length >
                0,

              partialSuccess:
                successfulPlatforms.length >
                  0 &&
                failedPlatforms.length >
                  0,

              userId:
                String(userId),

              sessionId:
                normalizedSessionId,

              input:
                validateInputSource(
                  input
                ),

              sourceType,

              loop:
                Boolean(loop),

              total:
                platforms.length,

              started:
                successfulPlatforms.length,

              failed:
                failedPlatforms.length,

              pid:
                ffmpegProcess.pid,

              sharedProcess:
                true,

              platforms:
                successfulPlatforms,

              failedPlatforms,

              encoding,

              destinations:
                normalizedDestinations.map(
                  buildSafeDestinationInfo
                ),

              results,
            };

            await invokeCallbackSafely(
              onSessionStarted,
              response,
              "SHARED SESSION STARTED"
            );

            resolveOnce(
              response
            );
          },
          8000
        );
    }
  }
);

        ffmpegProcess.once(
          "error",
          async (
            processError
          ) => {
            cleanupEntries();

            if (
              !errorCalled
            ) {
              errorCalled =
                true;

              const safeError =
                getSafeErrorMessage(
                  processError
                );

              await invokeAllPlatformCallbacks(
                onPlatformError,
                {
                  message:
                    safeError,

                  error:
                    processError,
                },
                "SHARED PLATFORM ERROR"
              );

              await invokeCallbackSafely(
                onSessionError,
                {
                  userId:
                    String(
                      userId
                    ),

                  sessionId:
                    normalizedSessionId,

                  platforms,

                  message:
                    safeError,
                },
                "SHARED SESSION ERROR"
              );
            }

            rejectOnce(
              processError
            );
          }
        );

        ffmpegProcess.once(
          "close",
          async (
            code,
            signal
          ) => {
            const stoppedAt =
              new Date();
if (confirmationTimer) {
  clearTimeout(confirmationTimer);
  confirmationTimer = null;
}
            const manuallyStopped =
              signal ===
                "SIGTERM" ||
              signal ===
                "SIGKILL";

            const cleanExit =
              code === 0 ||
              manuallyStopped;

            updateAliasStatuses(
              cleanExit
                ? "stopped"
                : "failed",
              {
                stoppedAt,
              }
            );

            const safeStderr =
              sanitizeFfmpegOutput(
                entry.stderr
              );

            cleanupEntries();

            await invokeAllPlatformCallbacks(
              onPlatformExit,
              {
                code,

                signal,

                status:
                  cleanExit
                    ? "stopped"
                    : "failed",

                startedAt:
                  entry.startedAt,

                connectedAt:
                  entry.connectedAt,

                stoppedAt,

                stderr:
                  safeStderr,

                errorMessage:
                  cleanExit
                    ? ""
                    : entry.errorMessage ||
                      safeStderr ||
                      "FFmpeg stopped unexpectedly.",
              },
              "SHARED PLATFORM EXIT"
            );

            if (
  !encoderStarted &&
  !errorCalled
) {
              errorCalled =
                true;

              const startError =
                new Error(
                  safeStderr ||
                  `FFmpeg exited before streaming. Code: ${
                    code ??
                    "unknown"
                  }`
                );

              await invokeCallbackSafely(
                onSessionError,
                {
                  userId:
                    String(
                      userId
                    ),

                  sessionId:
                    normalizedSessionId,

                  platforms,

                  message:
                    startError.message,
                },
                "SHARED SESSION CLOSE ERROR"
              );

              rejectOnce(
                startError
              );
            }
          }
        );
      }
    );
  };

/* =========================================================
   START MULTI-STREAM FROM CONNECTION RECORDS

   Expected connection shape:

   {
     platform: "youtube",
     connected: true,
     rtmpConfigured: true,
     destination:
       "rtmps://server/app/stream-key"
   }

   Also accepts:
   - outputUrl
   - rtmpDestination
========================================================= */

exports.startFromConnections =
  async ({
    userId,

    input,

    connections,

    sourceType =
      "file",

    loop =
      true,

    sessionId,

    rollbackOnFailure =
      false,

    metadata =
      {},

    ...callbacks
  }) => {
    if (
      !Array.isArray(
        connections
      )
    ) {
      throw new Error(
        "Connections must be an array."
      );
    }

    const destinations =
      connections
        .filter(
          (
            connection
          ) =>
            connection &&
            connection.connected !==
              false &&
            connection.rtmpConfigured !==
              false
        )
        .map(
          (
            connection
          ) => ({
            platform:
              connection.platform,

            outputUrl:
              connection.destination ||
              connection.outputUrl ||
              connection.rtmpDestination,

            enabled:
              true,

            videoBitrate:
              connection.videoBitrate,

            audioBitrate:
              connection.audioBitrate,

            width:
              connection.width,

            height:
              connection.height,

            fps:
              connection.fps,

            keyframeInterval:
              connection
                .keyframeInterval,

            preset:
              connection.preset,

            metadata: {
              connectionId:
                connection._id
                  ? String(
                      connection._id
                    )
                  : null,

              channelName:
                connection.channelName ||
                null,
            },
          })
        );

    if (
      destinations.length ===
      0
    ) {
      throw new Error(
        "No configured RTMP connections were found."
      );
    }

    return exports.startMultiStream({
      userId,

      input,

      destinations,

      sourceType,

      loop,

      sessionId,

      rollbackOnFailure,

      metadata,

      ...callbacks,
    });
  };

/* =========================================================
   ADD PLATFORM TO RUNNING SESSION
========================================================= */

exports.addPlatformToSession =
  async ({
    userId,

    sessionId,

    platform,

    input,

    outputUrl,

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

    onStarted,

    onStreaming,

    onError,

    onExit,
  }) => {
    if (!sessionId) {
      throw new Error(
        "Session ID is required."
      );
    }

    const normalizedPlatform =
      validatePlatform(
        platform
      );

    if (
      exports.isStreaming(
        userId,
        normalizedPlatform
      )
    ) {
      throw new Error(
        `${normalizedPlatform} stream is already running.`
      );
    }

    return exports.startStreamAsync({
      userId,

      platform:
        normalizedPlatform,

      input,

      outputUrl,

      sourceType,

      loop,

      sessionId:
        String(
          sessionId
        ),

      videoBitrate,

      audioBitrate,

      width,

      height,

      fps,

      keyframeInterval,

      preset,

      includeAudio,

      reconnect,

      metadata: {
        ...metadata,

        multiStream:
          true,

        sessionId:
          String(
            sessionId
          ),
      },

      onStarted,

      onStreaming,

      onError,

      onExit,
    });
  };

/* =========================================================
   REMOVE PLATFORM FROM RUNNING SESSION
========================================================= */

exports.removePlatformFromSession =
  async (
    userId,
    sessionId,
    platform,
    options =
      {}
  ) => {
    if (!sessionId) {
      throw new Error(
        "Session ID is required."
      );
    }

    const normalizedPlatform =
      validatePlatform(
        platform
      );

    const entry =
      exports.getProcess(
        userId,
        normalizedPlatform
      );

    if (!entry) {
      return {
        success:
          true,

        removed:
          false,

        alreadyStopped:
          true,

        userId:
          String(
            userId
          ),

        sessionId:
          String(
            sessionId
          ),

        platform:
          normalizedPlatform,

        message:
          "No active stream was found for this platform.",
      };
    }

    if (
      entry.sessionId !==
      String(
        sessionId
      )
    ) {
      throw new Error(
        `${normalizedPlatform} is not part of session ${sessionId}.`
      );
    }

    const result =
      await exports.stopStream(
        userId,
        normalizedPlatform,
        options
      );

    return {
      success:
        Boolean(
          result.stopped ||
          result.alreadyStopped
        ),

      removed:
        Boolean(
          result.stopped
        ),

      userId:
        String(
          userId
        ),

      sessionId:
        String(
          sessionId
        ),

      platform:
        normalizedPlatform,

      result,
    };
  };

/* =========================================================
   RESTART PLATFORM STREAM
========================================================= */

exports.restartPlatformStream =
  async ({
    userId,

    platform,

    input,

    outputUrl,

    sourceType =
      "file",

    loop =
      false,

    sessionId =
      null,

    stopOptions =
      {},

    ...startOptions
  }) => {
    const normalizedPlatform =
      validatePlatform(
        platform
      );

    const existingEntry =
      exports.getProcess(
        userId,
        normalizedPlatform
      );

    let previousRestartCount =
      existingEntry
        ?.restartCount ||
      0;

    if (
      existingEntry
    ) {
      await exports.stopStream(
        userId,
        normalizedPlatform,
        stopOptions
      );
    }

    const result =
      await exports
        .startStreamAsync({
          userId,

          platform:
            normalizedPlatform,

          input,

          outputUrl,

          sourceType,

          loop,

          sessionId,

          ...startOptions,
        });

    const newEntry =
      exports.getProcess(
        userId,
        normalizedPlatform
      );

    if (
      newEntry
    ) {
      newEntry.restartCount =
        previousRestartCount +
        1;
    }

    return {
      ...result,

      restarted:
        true,

      restartCount:
        previousRestartCount +
        1,
    };
  };

/* =========================================================
   WAIT FOR SESSION STREAMING
========================================================= */

exports.waitForSessionStreaming =
  async (
    userId,
    sessionId,
    {
      timeoutMs =
        15000,

      pollIntervalMs =
        250,

      requireAll =
        true,
    } = {}
  ) => {
    const startedAt =
      Date.now();

    while (
      Date.now() -
        startedAt <
      timeoutMs
    ) {
      const status =
        exports.getMultiStreamStatus(
          userId,
          sessionId
        );

      if (
        requireAll &&
        status.fullyStreaming
      ) {
        return {
          success:
            true,

          status,
        };
      }

      if (
        !requireAll &&
        status.streaming >
          0
      ) {
        return {
          success:
            true,

          status,
        };
      }

      if (
        status.total >
          0 &&
        status.failed ===
          status.total
      ) {
        return {
          success:
            false,

          status,

          message:
            "All platform streams failed.",
        };
      }

      await new Promise(
        (
          resolve
        ) =>
          setTimeout(
            resolve,
            pollIntervalMs
          )
      );
    }

    const finalStatus =
      exports.getMultiStreamStatus(
        userId,
        sessionId
      );

    return {
      success:
        false,

      timedOut:
        true,

      status:
        finalStatus,

      message:
        requireAll
          ? "Not all platforms reached streaming status before timeout."
          : "No platform reached streaming status before timeout.",
    };
  };

/* =========================================================
   GET ALL ACTIVE SESSIONS FOR USER
========================================================= */

exports.getUserSessions = (
  userId
) => {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  const userProcesses =
    exports.getUserProcesses(
      userId
    );

  const sessionMap =
    new Map();

  for (
    const processInfo of userProcesses
  ) {
    const sessionId =
      processInfo.sessionId ||
      "single";

    if (
      !sessionMap.has(
        sessionId
      )
    ) {
      sessionMap.set(
        sessionId,
        []
      );
    }

    sessionMap
      .get(
        sessionId
      )
      .push(
        processInfo
      );
  }

  return Array.from(
    sessionMap.entries()
  ).map(
    ([
      sessionId,
      processes,
    ]) => {
      const activeCount =
        processes.filter(
          (
            processInfo
          ) =>
            processInfo.active
        ).length;

      return {
        sessionId:
          sessionId ===
          "single"
            ? null
            : sessionId,

        type:
          sessionId ===
          "single"
            ? "single"
            : "multi",

        total:
          processes.length,

        active:
          activeCount,

        fullyActive:
          activeCount ===
            processes.length,

        platforms:
          processes.map(
            (
              processInfo
            ) =>
              processInfo.platform
          ),

        startedAt:
          processes
            .map(
              (
                processInfo
              ) =>
                processInfo.startedAt
            )
            .filter(
              Boolean
            )
            .sort(
              (
                first,
                second
              ) =>
                new Date(
                  first
                ) -
                new Date(
                  second
                )
            )[0] ||
          null,

        processes,
      };
    }
  );
};

/* =========================================================
   EXPORT PART 4 HELPERS
========================================================= */

exports.generateSessionId =
  generateSessionId;

exports.normalizeDestination =
  normalizeDestination;

exports.normalizeDestinations =
  normalizeDestinations;

exports.buildSafeDestinationInfo =
  buildSafeDestinationInfo;

/* =========================================================
   REGISTER SHUTDOWN HANDLERS

   Call once when this service is loaded.
========================================================= */

if (
  process.env
    .FFMPEG_REGISTER_SHUTDOWN_HANDLERS !==
  "false"
) {
  exports.registerShutdownHandlers({
    exitProcess:
      true,
  });
}