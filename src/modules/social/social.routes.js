const express = require("express");

const socialController =
  require("./social.controller");

const authMiddleware =
  require("../../middleware/auth.middleware");

const router = express.Router();

router.get(
  "/connect/:platform",
  authMiddleware.protect,
  socialController.startOAuth
);

router.get(
  "/callback/:platform",
  socialController.oauthCallback
);

router.get(
  "/connections",
  authMiddleware.protect,
  socialController.getConnections
);

router.patch(
  "/connections/instagram/rtmp",
  authMiddleware.protect,
  socialController.saveInstagramRtmp
);

router.delete(
  "/connections/:platform",
  authMiddleware.protect,
  socialController.deleteConnection
);

module.exports = router;