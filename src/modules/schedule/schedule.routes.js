const express = require("express");

const scheduleController =
  require("./schedule.controller");

const {
  protect,
} = require("../../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router.post(
  "/",
  scheduleController.createSchedule
);

router.get(
  "/",
  scheduleController.getSchedules
);

router.get(
  "/:id",
  scheduleController.getSchedule
);

router.patch(
  "/:id/cancel",
  scheduleController.cancelSchedule
);

router.delete(
  "/:id",
  scheduleController.deleteSchedule
);

module.exports = router;