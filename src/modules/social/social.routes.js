// modules/social/social.routes.js

const express = require(
  "express"
);

const router =
  express.Router();

const socialController =
  require(
    "./social.controller"
  );

const {
  protect,
} = require(
  "../../middleware/auth.middleware"
);

const {
  requireBrandCreator,
} = require(
  "../../middleware/role.middleware"
);

const {
  requirePermission,
} = require(
  "../../middleware/permission.middleware"
);

const {
  requireMinimumPlan,
} = require(
  "../../middleware/plan.middleware"
);

const {
  validateSocialPlatform,
  SUPPORTED_SOCIAL_PLATFORMS,
} = require(
  "../../middleware/socialPlatform.middleware"
);

const {
  PERMISSIONS,
} = require(
  "../../config/permissions"
);

/* =========================================================
   VALIDATE IMPORTS
========================================================= */

if (
  typeof protect !==
  "function"
) {
  throw new Error(
    "Social routes: protect middleware is not exported correctly."
  );
}

if (
  typeof requireBrandCreator !==
  "function"
) {
  throw new Error(
    "Social routes: requireBrandCreator middleware is not exported correctly."
  );
}

if (
  typeof requirePermission !==
  "function"
) {
  throw new Error(
    "Social routes: requirePermission middleware is not exported correctly."
  );
}

if (
  typeof requireMinimumPlan !==
  "function"
) {
  throw new Error(
    "Social routes: requireMinimumPlan middleware is not exported correctly."
  );
}

if (
  typeof validateSocialPlatform !==
  "function"
) {
  throw new Error(
    "Social routes: validateSocialPlatform middleware is not exported correctly."
  );
}

/* =========================================================
   ALL SOCIAL ROUTES REQUIRE LOGIN

   Exception:
   OAuth callback is public because the social platform
   redirects directly to this backend endpoint.
========================================================= */

/* =========================================================
   GET SUPPORTED PLATFORMS
========================================================= */

router.get(
  "/platforms",

  protect,

  requirePermission(
    PERMISSIONS
      .SOCIAL_READ
  ),

  (
    req,
    res
  ) => {
    const platformNames =
      {
        instagram:
          "Instagram",

        facebook:
          "Facebook",

        youtube:
          "YouTube",

        linkedin:
          "LinkedIn",

        rumble:
          "Rumble",

        kick:
          "Kick",

        twitch:
          "Twitch",

        twitter:
          "Twitter / X",
      };

    const platforms =
      SUPPORTED_SOCIAL_PLATFORMS
        .map(
          (
            platform
          ) => ({
            id:
              platform,

            name:
              platformNames[
                platform
              ] ||
              platform,

            supportsManualRtmp:
              true,

            supportsOAuth:
              [
                "instagram",
                "facebook",
                "youtube",
              ].includes(
                platform
              ),
          })
        );

    return res
      .status(200)
      .json({
        success: true,

        connectionType:
          "manual-rtmp-and-oauth",

        platforms,
      });
  }
);

/* =========================================================
   VIEW ALL CONNECTIONS

   User/content creator:
   - May view connections if SOCIAL_READ is assigned.

   Brand creator/manager/admin:
   - May view their permitted connection data.
========================================================= */

router.get(
  "/connections",

  protect,

  requirePermission(
    PERMISSIONS
      .SOCIAL_READ
  ),

  socialController
    .getConnections
);

/* =========================================================
   VIEW ONE CONNECTION
========================================================= */

router.get(
  "/connections/:platform",

  protect,

  validateSocialPlatform,

  requirePermission(
    PERMISSIONS
      .SOCIAL_READ
  ),

  socialController
    .getConnection
);

/* =========================================================
   OPEN MANUAL PLATFORM

   This may return instructions or open the platform page.
========================================================= */

router.get(
  "/manual/:platform/open",

  protect,

  requireBrandCreator,

  validateSocialPlatform,

  requirePermission(
    PERMISSIONS
      .SOCIAL_WRITE
  ),

  socialController
    .openManualPlatform
);

/* =========================================================
   SAVE MANUAL RTMP SETTINGS
========================================================= */

router.patch(
  "/connections/:platform/rtmp",

  protect,

  requireBrandCreator,

  validateSocialPlatform,

  requireMinimumPlan(
    "free"
  ),

  requirePermission(
    PERMISSIONS
      .SOCIAL_WRITE
  ),

  socialController
    .saveManualRtmp
);

/* =========================================================
   UPDATE CONNECTION PROFILE
========================================================= */

router.patch(
  "/connections/:platform/profile",

  protect,

  requireBrandCreator,

  validateSocialPlatform,

  requirePermission(
    PERMISSIONS
      .SOCIAL_WRITE
  ),

  socialController
    .updateConnectionProfile
);

/* =========================================================
   DELETE SOCIAL CONNECTION
========================================================= */

router.delete(
  "/connections/:platform",

  protect,

  requireBrandCreator,

  validateSocialPlatform,

  requirePermission(
    PERMISSIONS
      .SOCIAL_DELETE
  ),

  socialController
    .deleteConnection
);

/* =========================================================
   START OAUTH CONNECTION
========================================================= */

router.get(
  "/connect/:platform",

  protect,

  requireBrandCreator,

  validateSocialPlatform,

  requireMinimumPlan(
    "free"
  ),

  requirePermission(
    PERMISSIONS
      .SOCIAL_WRITE
  ),

  socialController
    .startOAuth
);

/* =========================================================
   OAUTH CALLBACK

   No protect middleware because external OAuth providers
   redirect directly to this endpoint.

   The controller must validate a signed and expiring state.
========================================================= */

router.get(
  "/callback/:platform",

  validateSocialPlatform,

  socialController
    .oauthCallback
);

module.exports =
  router;