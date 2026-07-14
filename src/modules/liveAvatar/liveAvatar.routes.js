const express = require("express");

const controller = require(
  "./liveAvatar.controller"
);

const {
  protect,
} = require(
  "../../middleware/auth.middleware"
);

const router = express.Router();

router.use(protect);

router.post(
  "/embeddings",
  controller.createEmbed
);

module.exports = router;