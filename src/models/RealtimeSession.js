const mongoose = require("mongoose");

const transcriptSchema =
  new mongoose.Schema(
    {
      role: {
        type: String,
        enum: ["user", "assistant"],
        required: true,
      },

      text: {
        type: String,
        required: true,
        trim: true,
      },

      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
    {
      _id: false,
    }
  );

const realtimeSessionSchema =
  new mongoose.Schema(
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

      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
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

      voiceName: {
        type: String,
        default: "Kore",
      },

      status: {
        type: String,
        enum: [
          "created",
          "connecting",
          "active",
          "interrupted",
          "ended",
          "failed",
        ],
        default: "created",
        index: true,
      },

      geminiSessionId: {
        type: String,
        default: "",
      },

      avatarSessionId: {
        type: String,
        default: "",
      },

      transcripts: {
        type: [transcriptSchema],
        default: [],
      },

      startedAt: {
        type: Date,
        default: null,
      },

      endedAt: {
        type: Date,
        default: null,
      },

      lastError: {
        type: String,
        default: "",
      },
    },
    {
      timestamps: true,
    }
  );

module.exports = mongoose.model(
  "RealtimeSession",
  realtimeSessionSchema
);