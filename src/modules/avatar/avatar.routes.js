const express = require("express");
const router = express.Router();

const avatarController = require("./avatar.controller");
const { protect } = require("../../middleware/auth.middleware");

router.get("/", protect, avatarController.getAvatars);

router.get(
  "/unlocked",
  protect,
  avatarController.getUnlockedAvatars
);

router.get(
  "/credit-history",
  protect,
  avatarController.getCreditHistory
);

router.post(
  "/:avatarId/unlock",
  protect,
  avatarController.unlockAvatar
);

module.exports = router;