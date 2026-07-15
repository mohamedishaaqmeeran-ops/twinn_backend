const liveService = require("./live.service");

exports.uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select a video file.",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Video uploaded successfully.",
      data: {
        videoUrl: req.file.path,
        publicId: req.file.filename,
        fileName: req.file.originalname,
        size: req.file.size,
      },
    });
  } catch (error) {
    console.error("VIDEO UPLOAD ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Video upload failed.",
    });
  }
};

exports.startInstagramRTMP = async (req, res) => {
  try {
    const result = await liveService.startInstagramRTMP(req.user.id, req.body);

    res.json({
      success: true,
      message: "Instagram live started",
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.stopInstagramRTMP = async (req, res) => {
  try {
    await liveService.stopLive(req.user.id, "instagram");

    res.json({
      success: true,
      message: "Instagram live stopped",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.startFacebookLive = async (req, res) => {
  try {
    const result = await liveService.startFacebookLive(req.user.id, req.body);

    res.json({
      success: true,
      message: "Facebook live started",
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.stopFacebookLive = async (req, res) => {
  try {
    await liveService.stopFacebookLive(req.user.id);

    res.json({
      success: true,
      message: "Facebook live stopped",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================================
   START YOUTUBE RTMP
========================================================= */

exports.startYouTubeRTMP =
  async (req, res) => {
    try {
      const result =
        await liveService
          .startYouTubeRTMP(
            req.user.id,
            req.body
          );

      return res.json({
        success: true,

        message:
          "YouTube RTMP stream started.",

        data: result,
      });
    } catch (error) {
      console.error(
        "START YOUTUBE RTMP ERROR:",
        error
      );

      return res.status(400).json({
        success: false,

        message:
          error.message ||
          "Unable to start YouTube RTMP stream.",
      });
    }
  };

/* =========================================================
   STOP YOUTUBE RTMP
========================================================= */

exports.stopYouTubeRTMP =
  async (req, res) => {
    try {
      const result =
        await liveService
          .stopYouTubeRTMP(
            req.user.id
          );

      return res.json({
        success: true,

        message:
          "YouTube RTMP stream stopped.",

        data: result,
      });
    } catch (error) {
      console.error(
        "STOP YOUTUBE RTMP ERROR:",
        error
      );

      return res.status(400).json({
        success: false,

        message:
          error.message ||
          "Unable to stop YouTube RTMP stream.",
      });
    }
  };