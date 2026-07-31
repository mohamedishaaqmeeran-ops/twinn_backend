const express = require(
  "express"
);

const router =
  express.Router();

const controller =
  require(
    "./twin.controller"
  );

const avatarVideoController =
  require(
    "../avatarVideo/avatarVideo.controller"
  );

const upload =
  require(
    "../../config/twinUpload"
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

/* =========================================================
   PROTECT ALL TWIN ROUTES
========================================================= */

router.use(protect);

/* =========================================================
   CREATE / SETUP TWIN
========================================================= */

router.post(
  "/basic-info",
  requireBrandCreator,
  controller.saveBasicInfo
);

router.post(
  "/appearance",
  requireBrandCreator,
  upload.single("avatar"),
  controller.saveAppearance
);

router.post(
  "/voice",
  requireBrandCreator,
  upload.single("sample"),
  controller.saveVoice
);

router.post(
  "/knowledge",
  requireBrandCreator,
  upload.single("document"),
  controller.saveKnowledge
);

/* =========================================================
   TWIN ACTIONS
========================================================= */

router.post(
  "/chat",
  requireBrandCreator,
  controller.chatWithTwin
);

router.post(
  "/text-to-speech",
  requireBrandCreator,
  controller.textToSpeech
);

router.post(
  "/speech-to-text",
  requireBrandCreator,
  upload.single("audio"),
  controller.speechToText
);

router.post(
  "/speech-to-speech",
  requireBrandCreator,
  upload.single("audio"),
  controller.speechToSpeech
);

router.post(
  "/talking-avatar",
  requireBrandCreator,
  controller.createTalkingAvatar
);

router.get(
  "/talking-avatar/:generationId/status",
  controller.getTalkingAvatarStatus
);

/* =========================================================
   VIEW TWINS
========================================================= */

router.get(
  "/",
  controller.getTwins
);

/* =========================================================
   AVATAR VIDEO MANAGEMENT
========================================================= */

router.post(
  "/:twinId/avatar-video",
  requireBrandCreator,
  avatarVideoController.generateAvatarVideo
);

router.get(
  "/:twinId/avatar-video-status",
  avatarVideoController.getAvatarVideoStatus
);

router.post(
  "/:twinId/avatar-video/retry",
  requireBrandCreator,
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
  requireBrandCreator,
  avatarVideoController.deleteAvatarVideo
);

/* =========================================================
   PRODUCT TRAINING
========================================================= */

router.post(
  "/:id/products/:productId/train",
  requireBrandCreator,
  upload.single("document"),
  controller.trainProduct
);

/* =========================================================
   CHILD RESOURCE VIEW ROUTES
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
  requireBrandCreator,
  controller.updateTwin
);

router.delete(
  "/:id",
  requireBrandCreator,
  controller.deleteTwin
);

module.exports =
  router;