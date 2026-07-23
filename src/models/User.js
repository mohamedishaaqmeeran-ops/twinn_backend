const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    brand: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: [
        "Active",
        "Blocked",
      ],
      default: "Active",
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      select: false,
    },

    googleId: {
      type: String,
      trim: true,
    },

    avatarUrl: {
      type: String,
      trim: true,
    },

    role: {
      type: String,
      enum: [
        "user",
        "admin",
      ],
      default: "user",
    },

    plan: {
      type: String,
      enum: [
        "free",
        "starter",
        "pro",
        "business",
        "agency",
      ],
      default: "free",
      lowercase: true,
      index: true,
    },

    billingCycle: {
      type: String,
      enum: [
        "monthly",
        "yearly",
      ],
      default: null,
    },

    planStartedAt: {
      type: Date,
      default: null,
    },

    planExpiresAt: {
      type: Date,
      default: null,
    },

    trialStartedAt: {
      type: Date,
      default: null,
    },

    trialExpiresAt: {
      type: Date,
      default: null,
    },

    isTrialUsed: {
      type: Boolean,
      default: false,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    credits: {
      type: Number,
      default: 0,
      min: 0,
    },

    unlockedAvatars: [
      {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "MarketplaceAvatar",
      },
    ],

    verificationToken: {
      type: String,
      select: false,
    },

    verificationTokenExpiresAt: {
      type: Date,
      select: false,
    },

    resetToken: {
      type: String,
      select: false,
    },

    resetTokenExpiresAt: {
      type: Date,
      select: false,
    },

    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/* =========================================================
   INDEXES
========================================================= */

userSchema.index({
  plan: 1,
  planExpiresAt: 1,
});

userSchema.index({
  status: 1,
  isBlocked: 1,
});

/* =========================================================
   VIRTUALS
========================================================= */

userSchema.virtual(
  "isTrialActive"
).get(function () {
  if (
    !this.trialExpiresAt
  ) {
    return false;
  }

  return (
    this.trialExpiresAt >
    new Date()
  );
});

userSchema.virtual(
  "isSubscriptionActive"
).get(function () {
  if (
    this.plan === "free"
  ) {
    return true;
  }

  if (
    this.plan === "agency"
  ) {
    return true;
  }

  if (
    !this.planExpiresAt
  ) {
    return false;
  }

  return (
    this.planExpiresAt >
    new Date()
  );
});

/* =========================================================
   JSON OUTPUT
========================================================= */

userSchema.set(
  "toJSON",
  {
    virtuals: true,

    transform(
      doc,
      ret
    ) {
      delete ret.passwordHash;
      delete ret.verificationToken;
      delete ret.verificationTokenExpiresAt;
      delete ret.resetToken;
      delete ret.resetTokenExpiresAt;

      return ret;
    },
  }
);

module.exports =
  mongoose.model(
    "User",
    userSchema
  );