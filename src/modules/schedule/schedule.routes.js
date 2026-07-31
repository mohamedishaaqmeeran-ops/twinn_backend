const express = require("express");

const router = express.Router();

const scheduleController = require("./schedule.controller");

const {
  protect,
} = require("../../middleware/auth.middleware");

const {
  requireBrandCreator,
} = require("../../middleware/role.middleware");

const {
  requirePermission,
} = require("../../middleware/permission.middleware");

const {
  requireMinimumPlan,
} = require("../../middleware/plan.middleware");

/* =========================================================
   ALL ROUTES REQUIRE LOGIN
========================================================= */

router.use(protect);

/* =========================================================
   CREATE SCHEDULE
========================================================= */

router.post(
  "/",
  requireBrandCreator,
  requirePermission("schedule:create"),
  requireMinimumPlan("free"),
  scheduleController.createSchedule
);

/* =========================================================
   GET SCHEDULES
========================================================= */

router.get(
  "/",
  requireBrandCreator,
  requirePermission("schedule:read"),
  scheduleController.getSchedules
);

/* =========================================================
   GET SINGLE
========================================================= */

router.get(
  "/:id",
  requireBrandCreator,
  requirePermission("schedule:read"),
  scheduleController.getSchedule
);

/* =========================================================
   CANCEL
========================================================= */

router.patch(
  "/:id/cancel",
  requireBrandCreator,
  requirePermission("schedule:update"),
  scheduleController.cancelSchedule
);

/* =========================================================
   DELETE
========================================================= */

router.delete(
  "/:id",
  requireBrandCreator,
  requirePermission("schedule:delete"),
  scheduleController.deleteSchedule
);

module.exports = router;