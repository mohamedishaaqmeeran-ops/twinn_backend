const express = require("express");
const router = express.Router();

const waitlistController = require("./waitlist.controller");

router.post("/", waitlistController.createWaitlist);
router.get("/", waitlistController.getWaitlistUsers);
router.get("/count", waitlistController.getWaitlistCount);

module.exports = router;