// modules/social/social.routes.js

const express = require(
  "express"
);

const socialController =
  require(
    "./social.controller"
  );

const authMiddleware =
  require(
    "../../middleware/auth.middleware"
  );

const router =
  express.Router();

/* =========================================================
   AUTHENTICATION MIDDLEWARE
========================================================= */

const protect =
  authMiddleware.protect;

/* =========================================================
   GET ALL CONNECTIONS

   GET /api/social/connections
========================================================= */

router.get(
  "/connections",
  protect,
  socialController.getConnections
);

/* =========================================================
   GET SINGLE CONNECTION

   Examples:
   GET /api/social/connections/instagram
   GET /api/social/connections/facebook
   GET /api/social/connections/youtube
   GET /api/social/connections/linkedin
   GET /api/social/connections/rumble
========================================================= */

router.get(
  "/connections/:platform",
  protect,
  socialController.getConnection
);

/* =========================================================
   OPEN PLATFORM STREAM DASHBOARD

   Examples:
   GET /api/social/manual/instagram/open
   GET /api/social/manual/facebook/open
   GET /api/social/manual/youtube/open
   GET /api/social/manual/linkedin/open
   GET /api/social/manual/rumble/open
   GET /api/social/manual/kick/open
   GET /api/social/manual/twitch/open
   GET /api/social/manual/twitter/open
========================================================= */

router.get(
  "/manual/:platform/open",
  protect,
  socialController.openManualPlatform
);

/* =========================================================
   SAVE OR UPDATE MANUAL RTMP CONNECTION

   Supported platforms:
   - Instagram
   - Facebook
   - YouTube
   - LinkedIn
   - Rumble
   - Kick
   - Twitch
   - Twitter / X

   Examples:
   PATCH /api/social/connections/instagram/rtmp
   PATCH /api/social/connections/facebook/rtmp
   PATCH /api/social/connections/youtube/rtmp
   PATCH /api/social/connections/linkedin/rtmp
   PATCH /api/social/connections/rumble/rtmp
   PATCH /api/social/connections/kick/rtmp
   PATCH /api/social/connections/twitch/rtmp
   PATCH /api/social/connections/twitter/rtmp
========================================================= */

router.patch(
  "/connections/:platform/rtmp",
  protect,
  socialController.saveManualRtmp
);

/* =========================================================
   UPDATE CONNECTION PROFILE

   Updates:
   - username
   - channelName
   - channelUrl
   - avatarUrl

   Example:
   PATCH /api/social/connections/youtube/profile
========================================================= */

router.patch(
  "/connections/:platform/profile",
  protect,
  socialController.updateConnectionProfile
);

/* =========================================================
   DELETE CONNECTION

   Examples:
   DELETE /api/social/connections/instagram
   DELETE /api/social/connections/facebook
   DELETE /api/social/connections/youtube
   DELETE /api/social/connections/linkedin
   DELETE /api/social/connections/rumble
   DELETE /api/social/connections/kick
   DELETE /api/social/connections/twitch
   DELETE /api/social/connections/twitter
========================================================= */

router.delete(
  "/connections/:platform",
  protect,
  socialController.deleteConnection
);

/* =========================================================
   LEGACY INSTAGRAM RTMP ROUTE

   This route is not strictly required because the generic
   route above already handles Instagram.

   Keep it only if the existing frontend calls:
   PATCH /api/social/connections/instagram/rtmp
========================================================= */

/*
 * Do not define another Instagram route here.
 *
 * The generic route:
 *
 * /connections/:platform/rtmp
 *
 * already handles:
 *
 * /connections/instagram/rtmp
 */

/* =========================================================
   LEGACY OAUTH ROUTES

   OAuth is disabled. These routes can remain temporarily
   so an older frontend receives a useful error instead of 404.

   Remove them after the frontend is fully changed to RTMP.
========================================================= */

router.get(
  "/connect/:platform",
  protect,
  socialController.startOAuth
);

router.get(
  "/callback/:platform",
  socialController.oauthCallback
);

/* =========================================================
   HEALTH / SUPPORTED PLATFORMS
========================================================= */

router.get(
  "/platforms",
  protect,
  (
    req,
    res
  ) => {
    return res.json({
      success:
        true,

      connectionType:
        "manual-rtmp",

      platforms: [
        {
          id:
            "instagram",

          name:
            "Instagram",

          supportsManualRtmp:
            true,
        },
        {
          id:
            "facebook",

          name:
            "Facebook",

          supportsManualRtmp:
            true,
        },
        {
          id:
            "youtube",

          name:
            "YouTube",

          supportsManualRtmp:
            true,
        },
        {
          id:
            "linkedin",

          name:
            "LinkedIn",

          supportsManualRtmp:
            true,
        },
        {
          id:
            "rumble",

          name:
            "Rumble",

          supportsManualRtmp:
            true,
        },
        {
          id:
            "kick",

          name:
            "Kick",

          supportsManualRtmp:
            true,
        },
        {
          id:
            "twitch",

          name:
            "Twitch",

          supportsManualRtmp:
            true,
        },
        {
          id:
            "twitter",

          name:
            "Twitter / X",

          supportsManualRtmp:
            true,
        },
      ],
    });
  }
);

module.exports =
  router;