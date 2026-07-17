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

const router = express.Router();

router.use(protect);

/* =========================================================
   STREAMING AVATAR ROUTES
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

router.get(
  "/sessions/:id",
  avatarController.getSession
);

router.delete(
  "/sessions/:id",
  avatarController.endSession
);

/* =========================================================
   MARKETPLACE STATIC ROUTES
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
========================================================= */

router.post(
  "/:avatarId/unlock",
  avatarController.unlockAvatar
);

module.exports = router;
