const express = require("express");

const socialController =
  require("./social.controller");

const youtubeLiveController =
  require("./youtubeLive.controller");

const authMiddleware =
  require("../../middleware/auth.middleware");

const router = express.Router();

/* =========================================================
   SOCIAL OAUTH
========================================================= */

router.get(
  "/connect/:platform",
  authMiddleware.protect,
  socialController.startOAuth
);

router.get(
  "/callback/:platform",
  socialController.oauthCallback
);

/* =========================================================
   SOCIAL CONNECTIONS
========================================================= */

router.get(
  "/connections",
  authMiddleware.protect,
  socialController.getConnections
);

router.patch(
  "/connections/instagram/rtmp",
  authMiddleware.protect,
  socialController.saveInstagramRtmp
);

router.delete(
  "/connections/:platform",
  authMiddleware.protect,
  socialController.deleteConnection
);

/* =========================================================
   YOUTUBE LIVE
========================================================= */

// Create YouTube broadcast and RTMP stream
router.post(
  "/youtube/live",
  authMiddleware.protect,
  youtubeLiveController.createLive
);

// Get current YouTube live details
router.get(
  "/youtube/live",
  authMiddleware.protect,
  youtubeLiveController.getCurrentLive
);

// Check whether YouTube is receiving RTMP video
router.get(
  "/youtube/live/status",
  authMiddleware.protect,
  youtubeLiveController.getStreamStatus
);

// Transition YouTube broadcast to live
router.post(
  "/youtube/live/start",
  authMiddleware.protect,
  youtubeLiveController.startBroadcast
);

// End YouTube broadcast
router.post(
  "/youtube/live/end",
  authMiddleware.protect,
  youtubeLiveController.endBroadcast
);

module.exports = router;const express = require(
  "express"
);

const socialController =
  require(
    "./social.controller"
  );

const youtubeLiveController =
  require(
    "./youtubeLive.controller"
  );

const authMiddleware =
  require(
    "../../middleware/auth.middleware"
  );

const router =
  express.Router();

/* =========================================================
   SOCIAL OAUTH
========================================================= */

router.get(
  "/connect/:platform",
  authMiddleware.protect,
  socialController.startOAuth
);

router.get(
  "/callback/:platform",
  socialController.oauthCallback
);

/* =========================================================
   SOCIAL CONNECTIONS
========================================================= */

router.get(
  "/connections",
  authMiddleware.protect,
  socialController.getConnections
);

router.patch(
  "/connections/instagram/rtmp",
  authMiddleware.protect,
  socialController.saveInstagramRtmp
);

router.delete(
  "/connections/:platform",
  authMiddleware.protect,
  socialController.deleteConnection
);

/* =========================================================
   YOUTUBE LIVE
========================================================= */

router.post(
  "/youtube/live",
  authMiddleware.protect,
  youtubeLiveController.createLive
);

router.get(
  "/youtube/live",
  authMiddleware.protect,
  youtubeLiveController.getCurrentLive
);

router.get(
  "/youtube/live/status",
  authMiddleware.protect,
  youtubeLiveController.getStreamStatus
);

router.post(
  "/youtube/live/start",
  authMiddleware.protect,
  youtubeLiveController.startBroadcast
);

router.post(
  "/youtube/live/end",
  authMiddleware.protect,
  youtubeLiveController.endBroadcast
);

module.exports = router;