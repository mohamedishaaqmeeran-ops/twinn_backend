const express = require(
  "express"
);

const liveController =
  require(
    "./live.controller"
  );

const uploadVideo =
  require(
    "../../config/cloudinaryVideo"
  );

const {
  protect,
} = require(
  "../../middleware/auth.middleware"
);

const router =
  express.Router();

/* =========================================================
   VIDEO UPLOAD
========================================================= */

router.post(
  "/upload-video",
  protect,
  uploadVideo.single("video"),
  liveController.uploadVideo
);

/* =========================================================
   INSTAGRAM
========================================================= */

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

/* =========================================================
   FACEBOOK
========================================================= */

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

/* =========================================================
   YOUTUBE RTMP PROCESS
========================================================= */

router.post(
  "/start-youtube-rtmp",
  protect,
  liveController.startYouTubeRTMP
);

router.post(
  "/stop-youtube-rtmp",
  protect,
  liveController.stopYouTubeRTMP
);

module.exports = router;