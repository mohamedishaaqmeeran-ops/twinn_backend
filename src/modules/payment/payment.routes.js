const express = require("express");
const router = express.Router();

const paymentController = require("./payment.controller");
const authMiddleware = require("../../middleware/auth.middleware");

router.post(
  "/create-checkout",
  authMiddleware.protect,
  paymentController.createCheckout
);

router.post(
  "/razorpay/verify",
  authMiddleware.protect,
  paymentController.verifyRazorpay
);

router.post(
  "/stripe/webhook",
  paymentController.stripeWebhook
);

module.exports = router;