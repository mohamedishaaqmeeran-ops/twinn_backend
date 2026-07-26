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
  multer.diskStorage(
    {
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
        const extension =
          path.extname(
            file.originalname
          )
            .toLowerCase()
            .replace(
              /[^a-z0-9.]/g,
              ""
            );

        const safeExtension =
          extension ||
          ".mp4";

        callback(
          null,
          `live-${Date.now()}-${Math.round(
            Math.random() *
              1e9
          )}${safeExtension}`
        );
      },
    }
  );

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
    "video/avi",
    "application/octet-stream",
  ];

  if (
    allowedMimeTypes.includes(
      file.mimetype
    )
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

const upload =
  multer(
    {
      storage,

      fileFilter,

      limits: {
        fileSize:
          Number(
            process.env
              .MAX_LIVE_VIDEO_SIZE
          ) ||
          1024 *
            1024 *
            1024,
      },
    }
  );

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
    (
      error
    ) => {
      if (!error) {
        return next();
      }

      if (
        error instanceof
        multer.MulterError
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              error.code ===
              "LIMIT_FILE_SIZE"
                ? "The uploaded video is too large."
                : error.message,
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
   START LIVE
========================================================= */

/*
 * Multipart request:
 *
 * video: uploaded file
 * platforms: ["youtube","kick"] or youtube,kick
 * loop: true
 * width: 1280
 * height: 720
 * fps: 30
 * videoBitrate: 4500
 *
 * Or JSON request:
 *
 * {
 *   "inputUrl": "https://example.com/video.mp4",
 *   "platforms": ["youtube", "kick"]
 * }
 */
router.post(
  "/start",
  authMiddleware.protect,
  uploadVideo,
  liveController.startLive
);

/* =========================================================
   STOP ONE PLATFORM
========================================================= */

router.post(
  "/stop/:platform",
  authMiddleware.protect,
  liveController.stopPlatform
);

/* =========================================================
   STOP ALL
========================================================= */

router.post(
  "/stop",
  authMiddleware.protect,
  liveController.stopAll
);

/* =========================================================
   GET STATUS
========================================================= */

router.get(
  "/status",
  authMiddleware.protect,
  liveController.getStatus
);

module.exports = router;