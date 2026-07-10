const express = require("express");
const router = express.Router();

const adminController = require("./admin.controller");

const { protect } = require("../../middleware/auth.middleware");
const { requireAdmin } = require("../../middleware/admin.middleware");

router.get(
  "/users",
  protect,
  requireAdmin,
  adminController.getUsers
);

router.patch(
  "/users/:id/status",
  protect,
  requireAdmin,
  adminController.toggleUserStatus
);

router.patch(
  "/users/:id/plan",
  protect,
  requireAdmin,
  adminController.updateUserPlan
);

router.delete(
  "/users/:id",
  protect,
  requireAdmin,
  adminController.deleteUser
);

module.exports = router;