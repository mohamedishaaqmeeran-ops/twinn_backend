const express = require(
  "express"
);

const avatarController = require(
  "./avatar.controller"
);

const {
  protect,
} = require(
  "../../middleware/auth.middleware"
);

const router =
  express.Router();

/*
 * Every avatar route requires login.
 */
router.use(protect);

/* =========================================================
   STREAMING AVATAR ROUTES

   These routes must appear before routes
   containing dynamic marketplace IDs.
========================================================= */

router.post(
  "/sessions",
  avatarController.createSession
);

router.post(
  "/sessions/:id/answer",
  avatarController.submitAnswer
);

router.post(
  "/sessions/:id/ice",
  avatarController.addIceCandidate
);

router.post(
  "/sessions/:id/speak",
  avatarController.speak
);

router.delete(
  "/sessions/:id",
  avatarController.endSession
);

/* =========================================================
   MARKETPLACE STATIC ROUTES

   Keep static paths before /:avatarId/unlock.
========================================================= */

router.get(
  "/unlocked",
  avatarController.getUnlockedAvatars
);

router.get(
  "/credit-history",
  avatarController.getCreditHistory
);

/* =========================================================
   MARKETPLACE ROOT
========================================================= */

router.get(
  "/",
  avatarController.getAvatars
);

/* =========================================================
   MARKETPLACE DYNAMIC ROUTE

   Keep dynamic route near the bottom.
========================================================= */

router.post(
  "/:avatarId/unlock",
  avatarController.unlockAvatar
);

module.exports = router;