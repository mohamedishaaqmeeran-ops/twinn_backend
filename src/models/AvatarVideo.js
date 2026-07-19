const mongoose =
  require("mongoose");

const avatarVideoSchema =
  new mongoose.Schema(
    {
      userId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      twinId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Twin",
        required: true,
        index: true,
      },

      productId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
        index: true,
      },

      twinName: {
        type: String,
        default: "",
      },

      productName: {
        type: String,
        default: "",
      },

      posterUrl: {
        type: String,
        default: "",
      },

      speech: {
        type: String,
        default: "",
      },

      prompt: {
        type: String,
        default: "",
      },

      status: {
        type: String,
        enum: [
          "queued",
          "processing",
          "generating",
          "rendering",
          "uploading",
          "completed",
          "failed",
        ],
        default: "queued",
        index: true,
      },

      progress: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },

      currentStep: {
        type: Number,
        default: 0,
      },

      videoUrl: {
        type: String,
        default: "",
      },

      cloudinaryPublicId: {
        type: String,
        default: "",
      },

      providerJobId: {
        type: String,
        default: "",
      },

      providerResponse: {
        type:
          mongoose.Schema.Types.Mixed,
        default: null,
      },

      duration: {
        type: Number,
        default: 0,
      },

      resolution: {
        type: String,
        default: "",
      },

      fileSize: {
        type: Number,
        default: 0,
      },

      mimeType: {
        type: String,
        default: "video/mp4",
      },

      error: {
        type: String,
        default: "",
      },

      startedAt: {
        type: Date,
        default: null,
      },

      completedAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
    }
  );

avatarVideoSchema.index({
  userId: 1,
  twinId: 1,
  productId: 1,
  createdAt: -1,
});

module.exports =
  mongoose.models.AvatarVideo ||
  mongoose.model(
    "AvatarVideo",
    avatarVideoSchema
  );