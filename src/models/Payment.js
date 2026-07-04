const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    plan: { type: String, enum: ["pro", "business"], required: true },
    gateway: { type: String, enum: ["razorpay", "stripe"], required: true },
    amount: Number,
    currency: String,
    status: { type: String, default: "created" },
    orderId: String,
    paymentId: String,
    sessionId: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema, "payments");