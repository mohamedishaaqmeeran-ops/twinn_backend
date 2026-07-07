const express = require("express");
const router = express.Router();

const liveController = require("./live.controller");
const { protect } = require("../../middleware/auth.middleware");

if (typeof protect !== "function") {
  throw new Error("protect middleware is not a function");
}

[
  "uploadVideo",
  "startInstagramRTMP",
  "stopInstagramRTMP",
  "startFacebookLive",
  "stopFacebookLive",
].forEach((fn) => {
  if (typeof liveController[fn] !== "function") {
    throw new Error(`liveController.${fn} is not a function`);
  }
});

router.post("/upload-video", protect, liveController.uploadVideo);
router.post("/start-instagram-rtmp", protect, liveController.startInstagramRTMP);
router.post("/stop-instagram-rtmp", protect, liveController.stopInstagramRTMP);
router.post("/start-facebook", protect, liveController.startFacebookLive);
router.post("/stop-facebook", protect, liveController.stopFacebookLive);

module.exports = router;