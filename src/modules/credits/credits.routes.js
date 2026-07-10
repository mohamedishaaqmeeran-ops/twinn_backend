const express = require("express");
const router = express.Router();

const creditsController = require("./credits.controller");
const { protect } = require("../../middleware/auth.middleware");

router.get(
  "/packages",
  protect,
  creditsController.getPackages
);

router.get(
  "/balance",
  protect,
  creditsController.getBalance
);

router.post(
  "/create-order",
  protect,
  creditsController.createOrder
);

router.post(
  "/verify",
  protect,
  creditsController.verifyPayment
);

module.exports = router;