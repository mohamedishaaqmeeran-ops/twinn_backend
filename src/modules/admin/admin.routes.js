const express = require("express");
const router = express.Router();

const controller = require("./admin.controller");

const auth = require("../auth/auth.middleware");
const admin = require("../auth/admin.middleware");

// users
router.get(
  "/users",
  auth,
  admin,
  controller.getUsers
);

router.put(
  "/users/:id/block",
  auth,
  admin,
  controller.blockUser
);

router.put(
  "/users/:id/plan",
  auth,
  admin,
  controller.changePlan
);

router.delete(
  "/users/:id",
  auth,
  admin,
  controller.deleteUser
);

// waitlist

router.get(
  "/waitlist",
  auth,
  admin,
  controller.getWaitlist
);

router.delete(
  "/waitlist/:id",
  auth,
  admin,
  controller.deleteWaitlist
);

module.exports = router;