// src/modules/payment/payment.routes.js

const express = require("express");
const router = express.Router();

const paymentController = require("./payment.controller");
const { protect } = require("../../middleware/auth.middleware");

router.post(
  "/create-checkout",
  protect,
  paymentController.createCheckout
);

router.post(
  "/razorpay/verify",
  protect,
  paymentController.verifyRazorpay
);

module.exports = router;