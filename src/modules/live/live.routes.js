const express = require(
  "express"
);

const multer = require(
  "multer"
);

const fs = require(
  "fs"
);

const path = require(
  "path"
);

const liveController =
  require(
    "./live.controller"
  );

const authMiddleware =
  require(
    "../../middleware/auth.middleware"
  );

const router =
  express.Router();

/* =========================================================
   UPLOAD DIRECTORY
========================================================= */

const uploadDirectory =
  path.join(
    process.cwd(),
    "uploads",
    "live"
  );

if (
  !fs.existsSync(
    uploadDirectory
  )
) {
  fs.mkdirSync(
    uploadDirectory,
    {
      recursive:
        true,
    }
  );
}

/* =========================================================
   MULTER STORAGE
========================================================= */

const storage =
  multer.diskStorage({
    destination: (
      req,
      file,
      callback
    ) => {
      callback(
        null,
        uploadDirectory
      );
    },

    filename: (
      req,
      file,
      callback
    ) => {
      const originalExtension =
        path
          .extname(
            file.originalname
          )
          .toLowerCase();

      const allowedExtensions = [
        ".mp4",
        ".mov",
        ".webm",
        ".mkv",
        ".avi",
      ];

      const safeExtension =
        allowedExtensions.includes(
          originalExtension
        )
          ? originalExtension
          : ".mp4";

      const randomPart =
        Math.round(
          Math.random() *
            1e9
        );

      callback(
        null,
        `live-${Date.now()}-${randomPart}${safeExtension}`
      );
    },
  });

/* =========================================================
   FILE FILTER
========================================================= */

const fileFilter = (
  req,
  file,
  callback
) => {
  const allowedMimeTypes = [
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/x-matroska",
    "video/x-msvideo",
    "video/avi",
    "application/octet-stream",
  ];

  const allowedExtensions = [
    ".mp4",
    ".mov",
    ".webm",
    ".mkv",
    ".avi",
  ];

  const extension =
    path
      .extname(
        file.originalname
      )
      .toLowerCase();

  const validMimeType =
    allowedMimeTypes.includes(
      file.mimetype
    );

  const validExtension =
    allowedExtensions.includes(
      extension
    );

  if (
    validMimeType &&
    validExtension
  ) {
    return callback(
      null,
      true
    );
  }

  return callback(
    new Error(
      "Only MP4, MOV, WebM, MKV or AVI video files are allowed."
    )
  );
};

/* =========================================================
   MULTER CONFIGURATION
========================================================= */

const maxLiveVideoSize =
  Number(
    process.env
      .MAX_LIVE_VIDEO_SIZE
  ) ||
  1024 *
    1024 *
    1024;

const upload =
  multer({
    storage,

    fileFilter,

    limits: {
      fileSize:
        maxLiveVideoSize,

      files:
        1,
    },
  });

/* =========================================================
   REMOVE FAILED UPLOAD
========================================================= */

const removeFailedUpload = (
  req
) => {
  const filePath =
    req.file?.path;

  if (!filePath) {
    return;
  }

  fs.unlink(
    filePath,
    (error) => {
      if (
        error &&
        error.code !==
          "ENOENT"
      ) {
        console.error(
          "REMOVE FAILED LIVE UPLOAD ERROR:",
          error.message
        );
      }
    }
  );
};

/* =========================================================
   MULTER ERROR WRAPPER
========================================================= */

const uploadVideo = (
  req,
  res,
  next
) => {
  upload.single(
    "video"
  )(
    req,
    res,
    (error) => {
      if (!error) {
        return next();
      }

      removeFailedUpload(
        req
      );

      if (
        error instanceof
        multer.MulterError
      ) {
        let message =
          error.message;

        if (
          error.code ===
          "LIMIT_FILE_SIZE"
        ) {
          message =
            "The uploaded video is too large.";
        }

        if (
          error.code ===
          "LIMIT_UNEXPECTED_FILE"
        ) {
          message =
            "Upload the video using the field name 'video'.";
        }

        if (
          error.code ===
          "LIMIT_FILE_COUNT"
        ) {
          message =
            "Only one video can be uploaded.";
        }

        return res
          .status(400)
          .json({
            success:
              false,

            message,
          });
      }

      return res
        .status(400)
        .json({
          success:
            false,

          message:
            error.message ||
            "Unable to upload video.",
        });
    }
  );
};

/* =========================================================
   AUTHENTICATION
========================================================= */

router.use(
  authMiddleware.protect
);

/* =========================================================
   START MULTI-PLATFORM LIVE
========================================================= */

/*
 * Multipart request:
 *
 * video: uploaded video file
 * platforms: ["youtube","kick"]
 * platforms: youtube,kick
 * loop: true
 * includeAudio: true
 * reconnect: true
 * rollbackOnFailure: true
 * width: 1280
 * height: 720
 * fps: 30
 * keyframeInterval: 2
 * videoBitrate: 4500
 * audioBitrate: 128
 * preset: veryfast
 * twinId: optional
 * productId: optional
 * liveId: optional
 *
 * JSON request:
 *
 * {
 *   "inputUrl": "https://example.com/video.mp4",
 *   "platforms": [
 *     "youtube",
 *     "kick"
 *   ],
 *   "sourceType": "url",
 *   "loop": true
 * }
 */
router.post(
  "/start",
  uploadVideo,
  liveController.startLive
);

/* =========================================================
   ADD PLATFORM TO ACTIVE SESSION
========================================================= */

/*
 * POST /api/live/sessions/:sessionId/platforms/:platform
 *
 * {
 *   "inputUrl": "https://example.com/video.mp4",
 *   "sourceType": "url",
 *   "loop": true
 * }
 */
router.post(
  "/sessions/:sessionId/platforms/:platform",
  liveController.addPlatform
);

/* =========================================================
   STOP ONE PLATFORM IN SESSION
========================================================= */

/*
 * POST /api/live/sessions/:sessionId/stop/youtube
 */
router.post(
  "/sessions/:sessionId/stop/:platform",
  liveController.stopPlatform
);

/* =========================================================
   STOP COMPLETE SESSION
========================================================= */

/*
 * POST /api/live/sessions/:sessionId/stop
 */
router.post(
  "/sessions/:sessionId/stop",
  liveController.stopSession
);

/* =========================================================
   GET SESSION STATUS
========================================================= */

/*
 * GET /api/live/sessions/:sessionId/status
 */
router.get(
  "/sessions/:sessionId/status",
  liveController.getSessionStatus
);

/* =========================================================
   GET ALL USER SESSIONS
========================================================= */

/*
 * GET /api/live/sessions
 */
router.get(
  "/sessions",
  liveController.getSessions
);

/* =========================================================
   RESTART PLATFORM
========================================================= */

/*
 * POST /api/live/restart/youtube
 *
 * {
 *   "inputUrl": "https://example.com/video.mp4",
 *   "sessionId": "optional-session-id",
 *   "sourceType": "url"
 * }
 */
router.post(
  "/restart/:platform",
  liveController.restartPlatform
);

/* =========================================================
   STOP ONE PLATFORM
========================================================= */

/*
 * POST /api/live/stop/youtube
 */
router.post(
  "/stop/:platform",
  liveController.stopPlatform
);

/* =========================================================
   STOP ALL USER STREAMS
========================================================= */

/*
 * POST /api/live/stop
 *
 * Optional body:
 *
 * {
 *   "temporaryFilePaths": [
 *     "/uploads/live/file.mp4"
 *   ]
 * }
 */
router.post(
  "/stop",
  liveController.stopAll
);

/* =========================================================
   GET ALL PLATFORM LIVE STATUS
========================================================= */

/*
 * GET /api/live/status
 */
router.get(
  "/status",
  liveController.getStatus
);

/* =========================================================
   GET PLATFORM HEALTH
========================================================= */

/*
 * GET /api/live/health/youtube
 */
router.get(
  "/health/:platform",
  liveController.getPlatformHealth
);

/* =========================================================
   GET USER STREAM HEALTH
========================================================= */

/*
 * GET /api/live/health
 */
router.get(
  "/health",
  liveController.getUserHealth
);

/* =========================================================
   RESET STALE STATUSES
========================================================= */

/*
 * This endpoint should ideally be admin-only.
 *
 * POST /api/live/reset-stale-statuses
 */
router.post(
  "/reset-stale-statuses",
  liveController.resetStaleStatuses
);

/* =========================================================
   ROUTER
========================================================= */

module.exports =
  router;