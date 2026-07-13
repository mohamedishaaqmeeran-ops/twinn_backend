const express =
  require("express");

const controller =
  require(
    "./realtime.controller"
  );

const {
  protect,
} = require(
  "../../middleware/auth.middleware"
);

const router =
  express.Router();

router.use(protect);

router.post(
  "/sessions",
  controller.createSession
);

router.get(
  "/sessions/:id",
  controller.getSession
);

router.delete(
  "/sessions/:id",
  controller.endSession
);

module.exports = router;