const mongoose = require("mongoose");

const avatarGenerationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    twinId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Twin",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["did", "liveavatar", "heygen"],
      default: "did",
    },
    providerGenerationId: {
      type: String,
      required: true,
      index: true,
    },
    text: {
      type: String,
      default: "",
    },
    audioUrl: {
      type: String,
      default: "",
    },
    videoUrl: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["created", "processing", "completed", "failed"],
      default: "created",
      index: true,
    },
    error: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

avatarGenerationSchema.index({
  userId: 1,
  twinId: 1,
  createdAt: -1,
});

module.exports =
  mongoose.models.AvatarGeneration ||
  mongoose.model(
    "AvatarGeneration",
    avatarGenerationSchema
  );
