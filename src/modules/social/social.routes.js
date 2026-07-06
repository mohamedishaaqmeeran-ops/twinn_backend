const express = require("express");
const router = express.Router();

const socialController = require("./social.controller");
const authMiddleware = require("../../middleware/auth.middleware");

router.get(
  "/connect/:platform",
  authMiddleware.protect,
  socialController.startOAuth
);

router.get("/callback/:platform", socialController.oauthCallback);

router.get(
  "/connections",
  authMiddleware.protect,
  socialController.getConnections
);

router.delete(
  "/connections/:platform",
  authMiddleware.protect,
  socialController.deleteConnection
);

module.exports = router;