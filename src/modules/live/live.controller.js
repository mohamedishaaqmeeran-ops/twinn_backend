const fs = require("fs");

const liveService = require(
  "./live.service"
);

/* =========================================================
   HELPERS
========================================================= */

const getUserId = (req) => {
  return (
    req.user?.id ||
    req.user?._id ||
    null
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
    (error) => {
      if (
        error &&
        error.code !== "ENOENT"
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
  fallback = false
) => {
  if (
    typeof value === "boolean"
  ) {
    return value;
  }

  const normalized = String(
    value ?? ""
  )
    .trim()
    .toLowerCase();

  if (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes"
  ) {
    return true;
  }

  if (
    normalized === "false" ||
    normalized === "0" ||
    normalized === "no"
  ) {
    return false;
  }

  return fallback;
};

const parseNumber = (
  value,
  fallback = undefined
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
};

const parsePlatforms = (
  value
) => {
  if (Array.isArray(value)) {
    return value
      .map((platform) =>
        String(platform || "")
          .trim()
          .toLowerCase()
      )
      .filter(Boolean);
  }

  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(
      value
    );

    if (Array.isArray(parsed)) {
      return parsed
        .map((platform) =>
          String(platform || "")
            .trim()
            .toLowerCase()
        )
        .filter(Boolean);
    }
  } catch {
    // Continue with comma-separated parsing.
  }

  return String(value)
    .split(",")
    .map((platform) =>
      platform
        .trim()
        .toLowerCase()
    )
    .filter(Boolean);
};

const parseMetadata = (
  value
) => {
  if (!value) {
    return {};
  }

  if (
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value;
  }

  try {
    const parsed = JSON.parse(
      value
    );

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      return parsed;
    }
  } catch {
    return {};
  }

  return {};
};

const getErrorStatus = (
  error
) => {
  const message = String(
    error?.message || ""
  ).toLowerCase();

  if (
    message.includes(
      "not connected"
    ) ||
    message.includes(
      "rtmp settings are incomplete"
    ) ||
    message.includes(
      "unsupported platform"
    ) ||
    message.includes(
      "select at least one platform"
    ) ||
    message.includes(
      "video input is required"
    ) ||
    message.includes(
      "already running"
    )
  ) {
    return 400;
  }

  return 500;
};

/* =========================================================
   START LIVE
========================================================= */

exports.startLive = async (
  req,
  res
) => {
  const uploadedFilePath =
    req.file?.path || "";

  const userId = getUserId(
    req
  );

  try {
    if (!userId) {
      removeUploadedFile(
        uploadedFilePath
      );

      return res.status(401).json({
        success: false,
        message: "Please log in.",
      });
    }

    const platforms =
      parsePlatforms(
        req.body?.platforms
      );

    const input =
      uploadedFilePath ||
      String(
        req.body?.inputUrl ||
          req.body?.sourceUrl ||
          req.body?.input ||
          ""
      ).trim();

    if (!platforms.length) {
      removeUploadedFile(
        uploadedFilePath
      );

      return res.status(400).json({
        success: false,
        message:
          "Select at least one platform.",
      });
    }

    if (!input) {
      return res.status(400).json({
        success: false,
        message:
          "Upload a video or provide inputUrl.",
      });
    }

    const sourceType =
      uploadedFilePath
        ? "file"
        : String(
            req.body?.sourceType ||
              "url"
          )
            .trim()
            .toLowerCase();

    const metadata =
      parseMetadata(
        req.body?.metadata
      );

    const result =
      await liveService.startLive({
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
            req.body?.loop,
            true
          ),

        includeAudio:
          parseBoolean(
            req.body?.includeAudio,
            true
          ),

        reconnect:
          parseBoolean(
            req.body?.reconnect,
            true
          ),

        rollbackOnFailure:
          parseBoolean(
            req.body
              ?.rollbackOnFailure,
            false
          ),

        videoBitrate:
          parseNumber(
            req.body
              ?.videoBitrate,
            2000
          ),

        audioBitrate:
          parseNumber(
            req.body
              ?.audioBitrate,
            96
          ),

        width:
          parseNumber(
            req.body?.width,
            720
          ),

        height:
          parseNumber(
            req.body?.height,
            1280
          ),

        fps:
          parseNumber(
            req.body?.fps,
            30
          ),

        keyframeInterval:
          parseNumber(
            req.body
              ?.keyframeInterval,
            2
          ),

        preset:
          String(
            req.body?.preset ||
              "ultrafast"
          )
            .trim()
            .toLowerCase(),

        sessionId:
          req.body?.sessionId
            ? String(
                req.body
                  .sessionId
              ).trim()
            : undefined,

        metadata: {
          ...metadata,

          twinId:
            req.body?.twinId ||
            metadata.twinId ||
            null,

          productId:
            req.body
              ?.productId ||
            metadata.productId ||
            null,

          liveId:
            req.body?.liveId ||
            metadata.liveId ||
            null,
        },
      });

    const failedCount =
      Array.isArray(
        result.failed
      )
        ? result.failed.length
        : Number(
            result.failed || 0
          );

    const startedCount =
      Array.isArray(
        result.started
      )
        ? result.started.length
        : Number(
            result.started || 0
          );

    return res.status(201).json({
      success:
        result.success !==
        false,

      message:
        failedCount > 0
          ? "Live stream started on some platforms."
          : "Live stream started successfully.",

      data: {
        sessionId:
          result.sessionId,

        total:
          result.total,

        started:
          result.started,

        startedCount,

        failed:
          result.failed,

        failedCount,

        results:
          result.results,

        partialSuccess:
          Boolean(
            result.partialSuccess
          ),

        sourceType:
          result.sourceType,

        loop:
          result.loop,

        temporaryFile:
          result.temporaryFile,
      },
    });
  } catch (error) {
    console.error(
      "START LIVE ERROR:",
      error
    );

    let hasActiveProcess =
      false;

    if (userId) {
      try {
        const status =
          await liveService
            .getLiveStatus(
              userId
            );

        hasActiveProcess =
          Array.isArray(status) &&
          status.some(
            (item) =>
              item.processActive
          );
      } catch (
        statusError
      ) {
        console.error(
          "CHECK LIVE STATUS ERROR:",
          statusError.message
        );
      }
    }

    if (
      uploadedFilePath &&
      !hasActiveProcess
    ) {
      removeUploadedFile(
        uploadedFilePath
      );
    }

    return res
      .status(
        getErrorStatus(
          error
        )
      )
      .json({
        success: false,

        message:
          error.message ||
          "Unable to start live stream.",

        details:
          error.details ||
          undefined,
      });
  }
};

/* =========================================================
   ADD PLATFORM TO ACTIVE SESSION
========================================================= */

exports.addPlatform = async (
  req,
  res
) => {
  try {
    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please log in.",
      });
    }

    const sessionId =
      String(
        req.params?.sessionId ||
          req.body?.sessionId ||
          ""
      ).trim();

    const platform =
      String(
        req.params?.platform ||
          req.body?.platform ||
          ""
      )
        .trim()
        .toLowerCase();

    const input =
      String(
        req.body?.inputUrl ||
          req.body?.sourceUrl ||
          req.body?.input ||
          ""
      ).trim();

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message:
          "Session ID is required.",
      });
    }

    if (!platform) {
      return res.status(400).json({
        success: false,
        message:
          "Platform is required.",
      });
    }

    if (!input) {
      return res.status(400).json({
        success: false,
        message:
          "Video input is required.",
      });
    }

    const result =
      await liveService.addPlatform({
        userId,

        sessionId,

        platform,

        input,

        sourceType:
          String(
            req.body?.sourceType ||
              "url"
          )
            .trim()
            .toLowerCase(),

        loop:
          parseBoolean(
            req.body?.loop,
            true
          ),

        includeAudio:
          parseBoolean(
            req.body?.includeAudio,
            true
          ),

        reconnect:
          parseBoolean(
            req.body?.reconnect,
            true
          ),

        videoBitrate:
          parseNumber(
            req.body
              ?.videoBitrate,
            2000
          ),

        audioBitrate:
          parseNumber(
            req.body
              ?.audioBitrate,
            96
          ),

        width:
          parseNumber(
            req.body?.width,
            720
          ),

        height:
          parseNumber(
            req.body?.height,
            1280
          ),

        fps:
          parseNumber(
            req.body?.fps,
            30
          ),

        keyframeInterval:
          parseNumber(
            req.body
              ?.keyframeInterval,
            2
          ),

        preset:
          req.body?.preset ||
          "veryfast",

        metadata:
          parseMetadata(
            req.body?.metadata
          ),
      });

    return res.status(201).json({
      success: true,

      message:
        `${platform} was added to the live session.`,

      data: result,
    });
  } catch (error) {
    console.error(
      "ADD LIVE PLATFORM ERROR:",
      error
    );

    return res
      .status(
        getErrorStatus(
          error
        )
      )
      .json({
        success: false,

        message:
          error.message ||
          "Unable to add platform.",
      });
  }
};

/* =========================================================
   STOP ONE PLATFORM
========================================================= */

exports.stopPlatform = async (
  req,
  res
) => {
  try {
    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please log in.",
      });
    }

    const platform =
      String(
        req.params?.platform ||
          req.body?.platform ||
          ""
      )
        .trim()
        .toLowerCase();

    const sessionId =
      String(
        req.params?.sessionId ||
          req.body?.sessionId ||
          ""
      ).trim() || null;

    if (!platform) {
      return res.status(400).json({
        success: false,
        message:
          "Platform is required.",
      });
    }

    const result =
      await liveService.stopPlatform({
        userId,
        platform,
        sessionId,
      });

    return res.json({
      success: true,

      message:
        `${result.platform} stream stopped successfully.`,

      data: result,
    });
  } catch (error) {
    console.error(
      "STOP PLATFORM ERROR:",
      error
    );

    return res
      .status(
        getErrorStatus(
          error
        )
      )
      .json({
        success: false,

        message:
          error.message ||
          "Unable to stop platform stream.",
      });
  }
};

/* =========================================================
   STOP LIVE SESSION
========================================================= */

exports.stopSession = async (
  req,
  res
) => {
  try {
    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please log in.",
      });
    }

    const sessionId =
      String(
        req.params?.sessionId ||
          req.body?.sessionId ||
          ""
      ).trim();

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message:
          "Session ID is required.",
      });
    }

    const result =
      await liveService.stopSession({
        userId,

        sessionId,

        temporaryFilePath:
          req.body
            ?.temporaryFilePath ||
          null,
      });

    return res.json({
      success: true,

      message:
        "Live session stopped successfully.",

      data: result,
    });
  } catch (error) {
    console.error(
      "STOP SESSION ERROR:",
      error
    );

    return res
      .status(
        getErrorStatus(
          error
        )
      )
      .json({
        success: false,

        message:
          error.message ||
          "Unable to stop live session.",
      });
  }
};

/* =========================================================
   STOP ALL PLATFORMS
========================================================= */

exports.stopAll = async (
  req,
  res
) => {
  try {
    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please log in.",
      });
    }

    const temporaryFilePaths =
      Array.isArray(
        req.body
          ?.temporaryFilePaths
      )
        ? req.body
            .temporaryFilePaths
        : [];

    const result =
      await liveService.stopAll(
        userId,
        {
          temporaryFilePaths,
        }
      );

    return res.json({
      success: true,

      message:
        "All active streams were stopped.",

      data: result,
    });
  } catch (error) {
    console.error(
      "STOP ALL LIVE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Unable to stop active streams.",
    });
  }
};

/* =========================================================
   RESTART PLATFORM
========================================================= */

exports.restartPlatform = async (
  req,
  res
) => {
  try {
    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please log in.",
      });
    }

    const platform =
      String(
        req.params?.platform ||
          req.body?.platform ||
          ""
      )
        .trim()
        .toLowerCase();

    const input =
      String(
        req.body?.inputUrl ||
          req.body?.sourceUrl ||
          req.body?.input ||
          ""
      ).trim();

    if (!platform) {
      return res.status(400).json({
        success: false,
        message:
          "Platform is required.",
      });
    }

    if (!input) {
      return res.status(400).json({
        success: false,
        message:
          "Video input is required.",
      });
    }

    const result =
      await liveService
        .restartPlatform({
          userId,

          platform,

          input,

          sourceType:
            req.body
              ?.sourceType ||
            "url",

          loop:
            parseBoolean(
              req.body?.loop,
              false
            ),

          sessionId:
            req.body
              ?.sessionId ||
            null,

          videoBitrate:
            parseNumber(
              req.body
                ?.videoBitrate
            ),

          audioBitrate:
            parseNumber(
              req.body
                ?.audioBitrate
            ),

          width:
            parseNumber(
              req.body?.width
            ),

          height:
            parseNumber(
              req.body?.height
            ),

          fps:
            parseNumber(
              req.body?.fps
            ),

          keyframeInterval:
            parseNumber(
              req.body
                ?.keyframeInterval
            ),

          preset:
            req.body?.preset ||
            "veryfast",

          includeAudio:
            parseBoolean(
              req.body
                ?.includeAudio,
              true
            ),

          reconnect:
            parseBoolean(
              req.body?.reconnect,
              true
            ),

          metadata:
            parseMetadata(
              req.body?.metadata
            ),
        });

    return res.json({
      success: true,

      message:
        `${platform} stream restarted successfully.`,

      data: result,
    });
  } catch (error) {
    console.error(
      "RESTART PLATFORM ERROR:",
      error
    );

    return res
      .status(
        getErrorStatus(
          error
        )
      )
      .json({
        success: false,

        message:
          error.message ||
          "Unable to restart platform stream.",
      });
  }
};

/* =========================================================
   GET LIVE STATUS
========================================================= */

exports.getStatus = async (
  req,
  res
) => {
  try {
    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please log in.",
      });
    }

    const status =
      await liveService
        .getLiveStatus(
          userId
        );

    return res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error(
      "GET LIVE STATUS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Unable to load live status.",
    });
  }
};

/* =========================================================
   GET SESSION STATUS
========================================================= */

exports.getSessionStatus = async (
  req,
  res
) => {
  try {
    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please log in.",
      });
    }

    const sessionId =
      String(
        req.params?.sessionId ||
          req.query?.sessionId ||
          ""
      ).trim();

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message:
          "Session ID is required.",
      });
    }

    const status =
      liveService
        .getSessionStatus(
          userId,
          sessionId
        );

    return res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error(
      "GET SESSION STATUS ERROR:",
      error
    );

    return res
      .status(
        getErrorStatus(
          error
        )
      )
      .json({
        success: false,

        message:
          error.message ||
          "Unable to load session status.",
      });
  }
};

/* =========================================================
   GET USER LIVE SESSIONS
========================================================= */

exports.getSessions = async (
  req,
  res
) => {
  try {
    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please log in.",
      });
    }

    const sessions =
      liveService
        .getUserSessions(
          userId
        );

    return res.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    console.error(
      "GET LIVE SESSIONS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Unable to load live sessions.",
    });
  }
};

/* =========================================================
   GET PLATFORM HEALTH
========================================================= */

exports.getPlatformHealth =
  async (
    req,
    res
  ) => {
    try {
      const userId =
        getUserId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Please log in.",
        });
      }

      const platform =
        String(
          req.params?.platform ||
            req.query?.platform ||
            ""
        )
          .trim()
          .toLowerCase();

      if (!platform) {
        return res.status(400).json({
          success: false,
          message:
            "Platform is required.",
        });
      }

      const health =
        liveService
          .getPlatformHealth(
            userId,
            platform
          );

      return res.json({
        success: true,
        data: health,
      });
    } catch (error) {
      console.error(
        "GET PLATFORM HEALTH ERROR:",
        error
      );

      return res
        .status(
          getErrorStatus(
            error
          )
        )
        .json({
          success: false,

          message:
            error.message ||
            "Unable to load platform health.",
        });
    }
  };

/* =========================================================
   GET USER STREAM HEALTH
========================================================= */

exports.getUserHealth = async (
  req,
  res
) => {
  try {
    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please log in.",
      });
    }

    const health =
      liveService
        .getUserStreamHealth(
          userId
        );

    return res.json({
      success: true,
      data: health,
    });
  } catch (error) {
    console.error(
      "GET USER STREAM HEALTH ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Unable to load stream health.",
    });
  }
};

/* =========================================================
   RESET STALE LIVE STATUSES
========================================================= */

exports.resetStaleStatuses =
  async (
    req,
    res
  ) => {
    try {
      const result =
        await liveService
          .resetStaleStatuses();

      return res.json({
        success: true,

        message:
          "Stale live statuses were reset.",

        data: result,
      });
    } catch (error) {
      console.error(
        "RESET LIVE STATUS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          "Unable to reset stale statuses.",
      });
    }
  };