const fs = require(
  "fs"
);

const liveService =
  require(
    "./live.service"
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

const removeUploadedFile = (
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
          "REMOVE UPLOADED VIDEO ERROR:",
          error.message
        );
      }
    }
  );
};

const parseBoolean = (
  value,
  fallback =
    false
) => {
  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }

  if (
    value ===
      "true" ||
    value ===
      "1"
  ) {
    return true;
  }

  if (
    value ===
      "false" ||
    value ===
      "0"
  ) {
    return false;
  }

  return fallback;
};

const parsePlatforms = (
  value
) => {
  if (
    Array.isArray(value)
  ) {
    return value;
  }

  if (!value) {
    return [];
  }

  /*
   * Handles JSON string:
   * '["youtube","kick"]'
   */
  try {
    const parsed =
      JSON.parse(
        value
      );

    if (
      Array.isArray(
        parsed
      )
    ) {
      return parsed;
    }
  } catch {
    // Use comma-separated fallback.
  }

  return String(value)
    .split(",")
    .map(
      (
        platform
      ) =>
        platform.trim()
    )
    .filter(Boolean);
};

/* =========================================================
   START LIVE
========================================================= */

exports.startLive =
  async (
    req,
    res
  ) => {
    const uploadedFilePath =
      req.file?.path ||
      "";

    try {
      const userId =
        getUserId(
          req
        );

      if (!userId) {
        removeUploadedFile(
          uploadedFilePath
        );

        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Please log in.",
          });
      }

      const platforms =
        parsePlatforms(
          req.body
            .platforms
        );

      /*
       * Input priority:
       * 1. Uploaded video file
       * 2. inputUrl
       * 3. sourceUrl
       */
      const input =
        uploadedFilePath ||
        String(
          req.body
            .inputUrl ||
          req.body
            .sourceUrl ||
          ""
        ).trim();

      if (!input) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Upload a video or provide inputUrl.",
          });
      }

      const sourceType =
        uploadedFilePath
          ? "file"
          : String(
              req.body
                .sourceType ||
              "url"
            )
              .trim()
              .toLowerCase();

      const result =
        await liveService.startLive(
          {
            userId,

            platforms,

            input,

            sourceType,

            temporaryFile:
              Boolean(
                uploadedFilePath
              ),

            loop:
              parseBoolean(
                req.body.loop,
                false
              ),

            videoBitrate:
              req.body
                .videoBitrate,

            audioBitrate:
              req.body
                .audioBitrate,

            width:
              req.body.width,

            height:
              req.body.height,

            fps:
              req.body.fps,

            preset:
              req.body
                .preset ||
              "veryfast",
          }
        );

      return res
        .status(201)
        .json({
          success:
            true,

          message:
            result.failed
              .length
              ? "Live stream started on some platforms."
              : "Live stream started successfully.",

          data: {
            started:
              result.started,

            failed:
              result.failed,
          },
        });
    } catch (error) {
      console.error(
        "START LIVE ERROR:",
        error
      );

      /*
       * Delete the upload only when FFmpeg did not start.
       *
       * When FFmpeg starts successfully, the file must remain
       * available for the duration of the stream.
       */
      const status =
        await liveService
          .getLiveStatus(
            getUserId(
              req
            )
          )
          .catch(
            () => []
          );

      const hasActiveProcess =
        status.some(
          (
            item
          ) =>
            item.processActive
        );

      if (
        uploadedFilePath &&
        !hasActiveProcess
      ) {
        removeUploadedFile(
          uploadedFilePath
        );
      }

      return res
        .status(400)
        .json({
          success:
            false,

          message:
            error.message ||
            "Unable to start live stream.",
        });
    }
  };

/* =========================================================
   STOP ONE PLATFORM
========================================================= */

exports.stopPlatform =
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

      const platform =
        String(
          req.params
            .platform ||
          req.body
            .platform ||
          ""
        )
          .trim()
          .toLowerCase();

      if (!platform) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Platform is required.",
          });
      }

      const result =
        await liveService.stopPlatform(
          {
            userId,

            platform,
          }
        );

      return res.json({
        success:
          true,

        message:
          `${result.platform} stream stopped successfully.`,

        data:
          result,
      });
    } catch (error) {
      console.error(
        "STOP PLATFORM ERROR:",
        error
      );

      return res
        .status(400)
        .json({
          success:
            false,

          message:
            error.message ||
            "Unable to stop platform stream.",
        });
    }
  };

/* =========================================================
   STOP ALL PLATFORMS
========================================================= */

exports.stopAll =
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

      const result =
        await liveService.stopAll(
          userId
        );

      return res.json({
        success:
          true,

        message:
          "All active streams were stopped.",

        data:
          result,
      });
    } catch (error) {
      console.error(
        "STOP ALL LIVE ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            error.message ||
            "Unable to stop active streams.",
        });
    }
  };

/* =========================================================
   GET LIVE STATUS
========================================================= */

exports.getStatus =
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

      const status =
        await liveService.getLiveStatus(
          userId
        );

      return res.json({
        success:
          true,

        data:
          status,
      });
    } catch (error) {
      console.error(
        "GET LIVE STATUS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            error.message ||
            "Unable to load live status.",
        });
    }
  };