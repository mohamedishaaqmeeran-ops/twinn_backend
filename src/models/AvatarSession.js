const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  twinId: { type: mongoose.Schema.Types.ObjectId, ref: "Twin", required: true, index: true },
  realtimeSessionId: { type: mongoose.Schema.Types.ObjectId, ref: "RealtimeSession", default: null },
  provider: { type: String, default: "did" },
  avatarUrl: { type: String, required: true },
  providerStreamId: { type: String, default: "" },
  providerSessionId: { type: String, default: "" },
  offer: { type: mongoose.Schema.Types.Mixed, default: null },
  iceServers: { type: [mongoose.Schema.Types.Mixed], default: [] },
  status: { type: String, enum: ["connecting", "created", "active", "ended", "failed"], default: "connecting", index: true },
  startedAt: Date,
  endedAt: Date,
  lastSpokenAt: Date,
  lastError: { type: String, default: "" },
}, { timestamps: true });
schema.index({ userId: 1, twinId: 1, status: 1 });
module.exports = mongoose.models.AvatarSession || mongoose.model("AvatarSession", schema);
