const express = require("express");
const router = express.Router();

const controller = require("./twin.controller");
const upload = require("../../middleware/upload.middleware");
const { protect } = require("../../middleware/auth.middleware");

router.use(protect);

/* ================================
   CREATE / SETUP
================================ */

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

/* ================================
   GENERAL ACTIONS
================================ */

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

/* ================================
   LIST TWINS
================================ */

router.get(
  "/",
  controller.getTwins
);

/* ================================
   AVATAR VIDEO STATIC ROUTES
================================ */

router.post(
  "/:twinId/avatar-video",
  controller.generateProductAvatarVideo
);

router.get(
  "/:twinId/avatar-video-status",
  controller.getAvatarVideoStatus
);

router.post(
  "/:id/avatar-video/retry",
  controller.retryAvatarVideo
);

/* ================================
   PRODUCT TRAINING
================================ */

router.post(
  "/:id/products/:productId/train",
  upload.single("document"),
  controller.trainProduct
);

/* ================================
   CHILD RESOURCE ROUTES
================================ */

router.get(
  "/:id/knowledge",
  controller.getKnowledge
);

router.get(
  "/:id/conversations",
  controller.getConversations
);

/* ================================
   DYNAMIC ID ROUTES — KEEP LAST
================================ */

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