const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: {
      type: String,
    },

    googleId: {
      type: String,
    },

    avatarUrl: {
      type: String,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    verificationToken: {
      type: String,
    },

    verificationTokenExpiresAt: {
      type: Date,
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    plan: {
      type: String,
      enum: ["free", "pro"],
      default: "free",
    },

    resetToken: {
      type: String,
    },

    resetTokenExpiresAt: {
      type: Date,
    },

    lastLogin: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema, "users");