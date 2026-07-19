const express = require("express");

const router = express.Router();

const controller = require("./twin.controller");

const avatarVideoController = require(
  "../avatarVideo/avatarVideo.controller"
);

const upload = require(
  "../../config/twinUpload"
);

const {
  protect,
} = require(
  "../../middleware/auth.middleware"
);

/* =========================================================
   PROTECT ALL TWIN ROUTES
========================================================= */

router.use(protect);

/* =========================================================
   CREATE / SETUP
========================================================= */

router.post(
  "/basic-info",
  controller.saveBasicInfo
);

router.post(
  "/appearance",
  upload.single("avatar"),
  controller.saveAppearance
);

router.post(
  "/voice",
  upload.single("sample"),
  controller.saveVoice
);

router.post(
  "/knowledge",
  upload.single("document"),
  controller.saveKnowledge
);

/* =========================================================
   GENERAL ACTIONS
========================================================= */

router.post(
  "/chat",
  controller.chatWithTwin
);

router.post(
  "/text-to-speech",
  controller.textToSpeech
);

router.post(
  "/speech-to-text",
  upload.single("audio"),
  controller.speechToText
);

router.post(
  "/speech-to-speech",
  upload.single("audio"),
  controller.speechToSpeech
);

router.post(
  "/talking-avatar",
  controller.createTalkingAvatar
);

router.get(
  "/talking-avatar/:generationId/status",
  controller.getTalkingAvatarStatus
);

/* =========================================================
   LIST TWINS
========================================================= */

router.get(
  "/",
  controller.getTwins
);

/* =========================================================
   AVATAR VIDEO ROUTES
========================================================= */

router.post(
  "/:twinId/avatar-video",
  avatarVideoController.generateAvatarVideo
);

router.get(
  "/:twinId/avatar-video-status",
  avatarVideoController.getAvatarVideoStatus
);

router.post(
  "/:twinId/avatar-video/retry",
  avatarVideoController.retryAvatarVideo
);

router.get(
  "/:twinId/avatar-videos",
  avatarVideoController.getAvatarVideoHistory
);

router.get(
  "/:twinId/avatar-videos/:videoId",
  avatarVideoController.getAvatarVideoById
);

router.delete(
  "/:twinId/avatar-videos/:videoId",
  avatarVideoController.deleteAvatarVideo
);

/* =========================================================
   PRODUCT TRAINING
========================================================= */

router.post(
  "/:id/products/:productId/train",
  upload.single("document"),
  controller.trainProduct
);

/* =========================================================
   CHILD RESOURCE ROUTES
========================================================= */

router.get(
  "/:id/knowledge",
  controller.getKnowledge
);

router.get(
  "/:id/conversations",
  controller.getConversations
);

/* =========================================================
   DYNAMIC ID ROUTES — KEEP LAST
========================================================= */

router.get(
  "/:id",
  controller.getTwin
);

router.put(
  "/:id",
  controller.updateTwin
);

router.delete(
  "/:id",
  controller.deleteTwin
);

module.exports = router;