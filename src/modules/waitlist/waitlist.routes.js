const express = require("express");
const router = express.Router();

const waitlistController = require("./waitlist.controller");
const { protect } = require("../../middleware/auth.middleware");
const requireAdmin = require("../../middleware/admin.middleware");

router.post("/", waitlistController.createWaitlist);

router.get(
  "/",
  protect,
  requireAdmin,
  waitlistController.getWaitlistUsers
);

router.get(
  "/count",
  waitlistController.getWaitlistCount
);

router.delete(
  "/:id",
  protect,
  requireAdmin,
  waitlistController.deleteWaitlistUser
);

module.exports = router;