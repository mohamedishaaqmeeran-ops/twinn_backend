const express = require("express");

const router = express.Router();

const waitlistController = require("./waitlist.controller");
const {
  protect,
} = require("../../middleware/auth.middleware");
const {
  requireAdmin,
} = require("../../middleware/admin.middleware");

/*
|--------------------------------------------------------------------------
| Public routes
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  waitlistController.createWaitlist
);

router.get(
  "/count",
  waitlistController.getWaitlistCount
);

/*
|--------------------------------------------------------------------------
| Admin routes
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  protect,
  requireAdmin,
  waitlistController.getWaitlistUsers
);

router.get(
  "/:id",
  protect,
  requireAdmin,
  waitlistController.getWaitlistUser
);

router.patch(
  "/:id",
  protect,
  requireAdmin,
  waitlistController.updateWaitlistUser
);

router.delete(
  "/:id",
  protect,
  requireAdmin,
  waitlistController.deleteWaitlistUser
);

module.exports = router;