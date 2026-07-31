const express = require("express");

const router = express.Router();

const avatarController = require("./avatar.controller");

const {
  protect,
} = require("../../middleware/auth.middleware");

const {
  requireBrandCreator,
} = require("../../middleware/role.middleware");

const {
  requirePermission,
} = require("../../middleware/permission.middleware");

const {
  requireMinimumPlan,
} = require("../../middleware/plan.middleware");

/* =========================================================
   LOGIN REQUIRED
========================================================= */

router.use(protect);

/* =========================================================
   CREATE SESSION
========================================================= */

router.post(
  "/sessions",
  requireBrandCreator,
  requirePermission("avatar:create"),
  requireMinimumPlan("pro"),
  avatarController.createSession
);

/* =========================================================
   GET SESSION
========================================================= */

router.get(
  "/sessions/:id",
  requireBrandCreator,
  requirePermission("avatar:read"),
  avatarController.getSession
);

/* =========================================================
   ANSWER
========================================================= */

router.post(
  "/sessions/:id/answer",
  requireBrandCreator,
  requirePermission("avatar:update"),
  avatarController.submitAnswer
);

/* =========================================================
   ICE
========================================================= */

router.post(
  "/sessions/:id/ice",
  requireBrandCreator,
  requirePermission("avatar:update"),
  avatarController.addIceCandidate
);

/* =========================================================
   SPEAK
========================================================= */

router.post(
  "/sessions/:id/speak",
  requireBrandCreator,
  requirePermission("avatar:update"),
  avatarController.speak
);

/* =========================================================
   END SESSION
========================================================= */

router.delete(
  "/sessions/:id",
  requireBrandCreator,
  requirePermission("avatar:delete"),
  avatarController.endSession
);

/* =========================================================
   UNLOCKED AVATARS
========================================================= */

router.get(
  "/unlocked",
  requirePermission("avatar:read"),
  avatarController.getUnlockedAvatars
);

/* =========================================================
   CREDIT HISTORY
========================================================= */

router.get(
  "/credit-history",
  requirePermission("credits:read"),
  avatarController.getCreditHistory
);

/* =========================================================
   MARKETPLACE
========================================================= */

router.get(
  "/",
  requirePermission("avatar:read"),
  avatarController.getAvatars
);

/* =========================================================
   UNLOCK AVATAR
========================================================= */

router.post(
  "/:avatarId/unlock",
  requireBrandCreator,
  requirePermission("avatar:unlock"),
  avatarController.unlockAvatar
);

module.exports = router;