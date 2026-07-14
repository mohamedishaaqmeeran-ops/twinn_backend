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

/*
 * All LiveAvatar routes require
 * your existing login cookie.
 */
router.use(protect);

router.post(
  "/embeddings",
  controller.createEmbed
);

router.get(
  "/test",
  controller.testConfiguration
);

module.exports = router;