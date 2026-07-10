const express = require("express");
const router = express.Router();
const productRoutes = require("../modules/products/product.routes");
const authRoutes = require("../modules/auth/auth.routes");
const socialRoutes = require("../modules/social/social.routes");
const waitlistRoutes = require("../modules/waitlist/waitlist.routes");
const liveRoutes = require("../modules/live/live.routes");
const paymentRoutes = require("../modules/payment/payment.routes");
const twinRoutes = require("../modules/twins/twin.routes");
const avatarRoutes = require("../modules/avatar/avatar.routes");
const creditsRoutes = require("../modules/credits/credits.routes");
const adminRoutes = require("../modules/admin/admin.routes");


router.use("/payments", paymentRoutes);
router.use("/auth", authRoutes);
router.use("/products", productRoutes);
router.use("/social", socialRoutes);
router.use("/waitlist", waitlistRoutes);
router.use("/live", liveRoutes);
router.use("/twins", twinRoutes);
router.use("/avatars", avatarRoutes);
router.use("/credits", creditsRoutes);


router.use("/admin", adminRoutes);


module.exports = router;