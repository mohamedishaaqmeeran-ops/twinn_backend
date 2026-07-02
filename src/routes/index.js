const express = require("express");
const router = express.Router();

const authRoutes = require("../modules/auth/auth.routes");
const socialRoutes = require("../modules/social/social.routes");
const waitlistRoutes = require("../modules/waitlist/waitlist.routes");
const liveRoutes = require("../modules/live/live.routes");

router.use("/auth", authRoutes);
router.use("/social", socialRoutes);
router.use("/waitlist", waitlistRoutes);
router.use("/live", liveRoutes);

module.exports = router;