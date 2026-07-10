const mongoose = require("mongoose");

const creditTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: ["purchase", "avatar_unlock", "refund", "admin_credit"],
      required: true,
    },

    credits: {
      type: Number,
      required: true,
    },

    balanceAfter: {
      type: Number,
      required: true,
    },

    avatarId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketplaceAvatar",
      default: null,
    },

    paymentId: {
      type: String,
      default: "",
    },

    orderId: {
      type: String,
      default: "",
    },

    description: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "CreditTransaction",
  creditTransactionSchema
);