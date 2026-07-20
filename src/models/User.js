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

    passwordHash: String,
    googleId: String,
    avatarUrl: String,

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

   plan: {
  type: String,
  enum: ["free", "pro", "business", "agency"],
  default: "free",
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
        type: mongoose.Schema.Types.ObjectId,
        ref: "MarketplaceAvatar",
      },
    ],

    verificationToken: String,
    verificationTokenExpiresAt: Date,
    resetToken: String,
    resetTokenExpiresAt: Date,
    lastLogin: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);