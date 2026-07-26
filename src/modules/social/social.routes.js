const express = require(
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

   Supported OAuth platforms:
   - Instagram
   - Facebook
   - YouTube
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
   GET CONNECTIONS
========================================================= */

router.get(
  "/connections",
  authMiddleware.protect,
  socialController.getConnections
);

/* =========================================================
   INSTAGRAM RTMP

   Instagram must first be connected using OAuth.
========================================================= */

router.patch(
  "/connections/instagram/rtmp",
  authMiddleware.protect,
  socialController.saveInstagramRtmp
);

/* =========================================================
   OPEN MANUAL PLATFORM DASHBOARD

   Examples:
   GET /api/social/manual/rumble/open
   GET /api/social/manual/kick/open
   GET /api/social/manual/twitch/open
   GET /api/social/manual/twitter/open
========================================================= */

router.get(
  "/manual/:platform/open",
  authMiddleware.protect,
  socialController.openManualPlatform
);

/* =========================================================
   SAVE MANUAL RTMP CONNECTION

   Examples:
   PATCH /api/social/connections/rumble/rtmp
   PATCH /api/social/connections/kick/rtmp
   PATCH /api/social/connections/twitch/rtmp
   PATCH /api/social/connections/twitter/rtmp
========================================================= */

router.patch(
  "/connections/:platform/rtmp",
  authMiddleware.protect,
  socialController.saveManualRtmp
);

/* =========================================================
   DELETE CONNECTION

   Examples:
   DELETE /api/social/connections/instagram
   DELETE /api/social/connections/youtube
   DELETE /api/social/connections/rumble
   DELETE /api/social/connections/kick
   DELETE /api/social/connections/twitch
   DELETE /api/social/connections/twitter
========================================================= */

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