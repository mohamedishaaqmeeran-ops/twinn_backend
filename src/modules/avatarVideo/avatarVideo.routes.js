const express = require("express");
const controller = require("./avatarVideo.controller");
const { protect } = require("../../middleware/auth.middleware");

const router = express.Router();
router.use(protect);

router.post("/:twinId/avatar-video", controller.generateAvatarVideo);
router.get("/:twinId/avatar-video-status", controller.getAvatarVideoStatus);
router.post("/:twinId/avatar-video/retry", controller.retryAvatarVideo);
router.get("/:twinId/avatar-videos", controller.getAvatarVideoHistory);
router.get("/:twinId/avatar-videos/:videoId", controller.getAvatarVideoById);
router.delete("/:twinId/avatar-videos/:videoId", controller.deleteAvatarVideo);

module.exports = router;
