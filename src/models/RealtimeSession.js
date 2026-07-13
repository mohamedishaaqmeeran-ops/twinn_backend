const mongoose = require("mongoose");

const realtimeSessionSchema =
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

      twinId: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "Twin",
        required: true,
        index: true,
      },

      productId: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "Product",
        default: null,
      },

      conversationId: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "TwinConversation",
        default: null,
      },

      mode: {
        type: String,
        enum: ["test", "live"],
        default: "test",
      },

      language: {
        type: String,
        default: "English",
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

      geminiSessionId: {
        type: String,
        default: "",
      },

      avatarSessionId: {
        type: String,
        default: "",
      },

      startedAt: Date,
      endedAt: Date,

      lastError: {
        type: String,
        default: "",
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "RealtimeSession",
    realtimeSessionSchema
  );