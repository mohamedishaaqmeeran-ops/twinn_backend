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

const liveController = require(
  "./live.controller"
);

const {
  protect,
} = require(
  "../../middleware/auth.middleware"
);

const {
  requireBrandCreator,
  requireAdmin,
} = require(
  "../../middleware/role.middleware"
);

const {
  requirePermission,
} = require(
  "../../middleware/permission.middleware"
);

const {
  requireMinimumPlan,
} = require(
  "../../middleware/plan.middleware"
);

const {
  validateSocialPlatform,
} = require(
  "../../middleware/socialPlatform.middleware"
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
      recursive: true,
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

      files: 1,
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
            success: false,
            code:
              error.code,
            message,
          });
      }

      return res
        .status(400)
        .json({
          success: false,
          code:
            "INVALID_VIDEO_UPLOAD",

          message:
            error.message ||
            "Unable to upload video.",
        });
    }
  );
};

/* =========================================================
   ALL ROUTES REQUIRE AUTHENTICATION
========================================================= */

router.use(
  protect
);

/* =========================================================
   START MULTI-PLATFORM LIVE
========================================================= */

router.post(
  "/start",
  requireBrandCreator,
  requireMinimumPlan(
    "free"
  ),
  requirePermission(
    "live:create"
  ),
  uploadVideo,
  liveController.startLive
);

/* =========================================================
   ADD PLATFORM TO ACTIVE SESSION
========================================================= */

router.post(
  "/sessions/:sessionId/platforms/:platform",
  requireBrandCreator,
  requireMinimumPlan(
    "free"
  ),
  requirePermission(
    "live:update"
  ),
  validateSocialPlatform,
  liveController.addPlatform
);

/* =========================================================
   STOP ONE PLATFORM IN SESSION
========================================================= */

router.post(
  "/sessions/:sessionId/stop/:platform",
  requireBrandCreator,
  requirePermission(
    "live:stop"
  ),
  validateSocialPlatform,
  liveController.stopPlatform
);

/* =========================================================
   STOP COMPLETE SESSION
========================================================= */

router.post(
  "/sessions/:sessionId/stop",
  requireBrandCreator,
  requirePermission(
    "live:stop"
  ),
  liveController.stopSession
);

/* =========================================================
   RESTART PLATFORM
========================================================= */

router.post(
  "/restart/:platform",
  requireBrandCreator,
  requirePermission(
    "live:update"
  ),
  validateSocialPlatform,
  liveController.restartPlatform
);

/* =========================================================
   STOP ONE PLATFORM
========================================================= */

router.post(
  "/stop/:platform",
  requireBrandCreator,
  requirePermission(
    "live:stop"
  ),
  validateSocialPlatform,
  liveController.stopPlatform
);

/* =========================================================
   STOP ALL CREATOR STREAMS
========================================================= */

router.post(
  "/stop",
  requireBrandCreator,
  requirePermission(
    "live:stop"
  ),
  liveController.stopAll
);

/* =========================================================
   GET SESSION STATUS
========================================================= */

router.get(
  "/sessions/:sessionId/status",
  requirePermission(
    "live:read"
  ),
  liveController.getSessionStatus
);

/* =========================================================
   GET AVAILABLE LIVE SESSIONS
========================================================= */

router.get(
  "/sessions",
  requirePermission(
    "live:read"
  ),
  liveController.getSessions
);

/* =========================================================
   GET ALL PLATFORM LIVE STATUS
========================================================= */

router.get(
  "/status",
  requirePermission(
    "live:read"
  ),
  liveController.getStatus
);

/* =========================================================
   GET PLATFORM HEALTH
========================================================= */

router.get(
  "/health/:platform",
  requirePermission(
    "live:read"
  ),
  validateSocialPlatform,
  liveController.getPlatformHealth
);

/* =========================================================
   GET USER STREAM HEALTH
========================================================= */

router.get(
  "/health",
  requirePermission(
    "live:read"
  ),
  liveController.getUserHealth
);

/* =========================================================
   ADMIN-ONLY SYSTEM ROUTE
========================================================= */

router.post(
  "/reset-stale-statuses",
  requireAdmin,
  requirePermission(
    "live:admin"
  ),
  liveController.resetStaleStatuses
);

module.exports =
  router;