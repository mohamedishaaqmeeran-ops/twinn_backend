const multer = require("multer");
const path = require("path");
const liveService = require("./live.service");

const storage = multer.diskStorage({
  destination: "uploads/videos",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage }).single("video");

exports.uploadVideo = (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: "Video upload failed",
      });
    }

    res.json({
      success: true,
      videoPath: req.file.path,
    });
  });
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