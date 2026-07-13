const express = require("express");

const controller =
  require("./twin.controller");

const {
  protect,
} = require(
  "../../middleware/auth.middleware"
);

const upload =
  require("../../config/twinUpload");

const router = express.Router();

router.use(protect);

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

router.post(
  "/chat",
  controller.chatWithTwin
);

router.get(
  "/",
  controller.getTwins
);

router.get(
  "/:id/knowledge",
  controller.getKnowledge
);

router.get(
  "/:id/conversations",
  controller.getConversations
);

router.get(
  "/:id",
  controller.getTwin
);

router.delete(
  "/:id",
  controller.deleteTwin
);

module.exports = router;