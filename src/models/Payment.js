const mongoose =
  require("mongoose");

const paymentSchema =
  new mongoose.Schema(
    {
      userId: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref: "User",

        required: true,

        index: true,
      },

      plan: {
        type: String,

        enum: [
          "starter",
          "pro",
          "business",
        ],

        required: true,

        lowercase: true,
      },

      billing: {
        type: String,

        enum: [
          "monthly",
          "yearly",
        ],

        default:
          "monthly",

        required: true,
      },

      gateway: {
        type: String,

        enum: [
          "razorpay",
          "stripe",
        ],

        required: true,
      },

      amount: {
        type: Number,

        required: true,
      },

      currency: {
        type: String,

        required: true,

        uppercase: true,
      },

      country: {
        type: String,

        uppercase: true,

        default: "US",
      },

      status: {
        type: String,

        enum: [
          "created",
          "pending",
          "paid",
          "failed",
          "cancelled",
          "refunded",
        ],

        default:
          "created",
      },

      orderId: {
        type: String,

        index: true,
      },

      paymentId: {
        type: String,

        index: true,
      },

      sessionId: {
        type: String,

        index: true,
      },

      metadata: {
        type:
          mongoose.Schema.Types.Mixed,

        default: {},
      },
    },
    {
      timestamps: true,
    }
  );

paymentSchema.index({
  userId: 1,
  createdAt: -1,
});

module.exports =
  mongoose.model(
    "Payment",
    paymentSchema,
    "payments"
  );