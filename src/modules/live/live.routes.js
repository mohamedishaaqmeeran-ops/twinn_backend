const express = require("express");
const router = express.Router();

const liveController = require("./live.controller");
const authMiddleware = require("../../middlewares/auth.middleware");

router.post("/upload-video", authMiddleware, liveController.uploadVideo);

router.post(
  "/start-instagram-rtmp",
  authMiddleware,
  liveController.startInstagramRTMP
);

router.post(
  "/stop-instagram-rtmp",
  authMiddleware,
  liveController.stopInstagramRTMP
);

router.post(
  "/start-facebook",
  authMiddleware,
  liveController.startFacebookLive
);

router.post(
  "/stop-facebook",
  authMiddleware,
  liveController.stopFacebookLive
);

module.exports = router;