const express = require("express");

const liveController = require("./live.controller");
const uploadVideo = require("../../config/cloudinaryVideo");

const {
  protect,
} = require("../../middleware/auth.middleware");

const router = express.Router();

router.post(
  "/upload-video",
  protect,
  uploadVideo.single("video"),
  liveController.uploadVideo
);

router.post(
  "/start-instagram-rtmp",
  protect,
  liveController.startInstagramRTMP
);

router.post(
  "/stop-instagram-rtmp",
  protect,
  liveController.stopInstagramRTMP
);

router.post(
  "/start-facebook",
  protect,
  liveController.startFacebookLive
);

router.post(
  "/stop-facebook",
  protect,
  liveController.stopFacebookLive
);

module.exports = router;