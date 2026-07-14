const mongoose = require("mongoose");

const avatarSessionSchema =
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

      realtimeSessionId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "RealtimeSession",
        default: null,
      },

      provider: {
        type: String,
        enum: ["did"],
        default: "did",
      },

      providerStreamId: {
        type: String,
        default: "",
      },

      providerSessionId: {
        type: String,
        default: "",
      },

      status: {
        type: String,
        enum: [
          "created",
          "connecting",
          "active",
          "ended",
          "failed",
        ],
        default: "created",
      },

      avatarUrl: {
        type: String,
        required: true,
      },

      offer: {
        type:
          mongoose.Schema.Types.Mixed,
        default: null,
      },

      iceServers: {
        type: [
          mongoose.Schema.Types.Mixed,
        ],
        default: [],
      },

      lastError: {
        type: String,
        default: "",
      },

      startedAt: {
        type: Date,
        default: null,
      },

      endedAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.models.AvatarSession ||
  mongoose.model(
    "AvatarSession",
    avatarSessionSchema
  );