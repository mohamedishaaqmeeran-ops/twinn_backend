const mongoose = require("mongoose");

const appearanceSchema = new mongoose.Schema({
  avatarUrl: { type: String, default: "" },
  avatarPublicId: { type: String, default: "" },
  provider: { type: String, enum: ["custom", "did", "liveavatar", "heygen"], default: "custom" },
  style: { type: String, default: "Professional" },
  background: { type: String, default: "Studio" },
  clothingStyle: { type: String, default: "Professional" },
  gesture: { type: String, default: "Friendly" },
}, { _id: false });

const voiceSchema = new mongoose.Schema({
  voiceType: { type: String, default: "Warm Female" },
  language: { type: String, default: "English" },
  speed: { type: Number, default: 1, min: 0.5, max: 2 },
  pitch: { type: Number, default: 1, min: 0.5, max: 2 },
  sampleUrl: { type: String, default: "" },
  samplePublicId: { type: String, default: "" },
  clonedVoiceId: { type: String, default: "" },
  provider: { type: String, enum: ["google", "elevenlabs", "azure", "custom"], default: "google" },
  isCloned: { type: Boolean, default: false },
}, { _id: false });

const twinSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true },
  brandName: { type: String, default: "", trim: true },
  brandDescription: { type: String, required: true, trim: true },
  purpose: { type: String, default: "Live-commerce selling and customer support" },
  industry: { type: String, default: "General" },
  targetAudience: { type: String, default: "" },
  personality: { type: String, default: "Friendly" },
  tone: { type: String, default: "Helpful" },
  primaryLanguage: { type: String, default: "English" },
  appearance: { type: appearanceSchema, default: () => ({}) },
  voice: { type: voiceSchema, default: () => ({}) },
  productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  currentStep: { type: Number, default: 1 },
  completedSteps: { type: [Number], default: [] },
  status: { type: String, enum: ["draft", "training", "active", "failed", "inactive"], default: "draft" },
  trainingStatus: { type: String, enum: ["not_started", "processing", "completed", "failed"], default: "not_started" },
  isTrained: { type: Boolean, default: false },
}, { timestamps: true });

twinSchema.index({ userId: 1, status: 1 });
module.exports = mongoose.models.Twin || mongoose.model("Twin", twinSchema);
