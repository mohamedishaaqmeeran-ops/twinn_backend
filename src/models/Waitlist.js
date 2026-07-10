const mongoose = require("mongoose");

const waitlistSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please enter a valid email address",
      ],
    },

    mobile: {
      type: String,
      required: [true, "Mobile number is required"],
      trim: true,
      maxlength: 30,
    },

    brand: {
      type: String,
      required: [true, "Brand or business name is required"],
      trim: true,
      maxlength: 150,
    },

    status: {
      type: String,
      enum: ["waiting", "contacted", "converted", "rejected"],
      default: "waiting",
    },

    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    referredBy: {
      type: String,
      default: null,
      trim: true,
    },

    referralCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

waitlistSchema.index({ createdAt: -1 });
waitlistSchema.index({ status: 1 });

module.exports = mongoose.model("Waitlist", waitlistSchema);