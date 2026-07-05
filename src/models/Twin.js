const mongoose = require("mongoose");

const twinSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    image: {
      type: String,
      default: "/images/bb.png",
    },

    voice: {
      type: String,
      default: "Warm Female",
    },

    personality: {
      type: String,
      default: "Friendly",
    },

    language: {
      type: String,
      default: "English",
    },

    status: {
      type: String,
      enum: ["draft", "active", "inactive"],
      default: "draft",
    },

    isTrained: {
      type: Boolean,
      default: false,
    },

    trainingText: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Twin", twinSchema);