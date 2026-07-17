const mongoose = require("mongoose");

const avatarSessionSchema = new mongoose.Schema(
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
    realtimeSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RealtimeSession",
      default: null,
      index: true,
    },
    provider: {
      type: String,
      enum: ["did", "liveavatar", "heygen"],
      default: "did",
    },
    avatarUrl: {
      type: String,
      required: true,
    },
    providerStreamId: {
      type: String,
      default: "",
      index: true,
    },
    providerSessionId: {
      type: String,
      default: "",
    },
    offer: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    iceServers: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    status: {
      type: String,
      enum: [
        "connecting",
        "created",
        "active",
        "ended",
        "failed",
      ],
      default: "connecting",
      index: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    lastSpokenAt: {
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

avatarSessionSchema.index({
  userId: 1,
  twinId: 1,
  status: 1,
});

module.exports =
  mongoose.models.AvatarSession ||
  mongoose.model(
    "AvatarSession",
    avatarSessionSchema
  );
