const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  twinId: { type: mongoose.Schema.Types.ObjectId, ref: "Twin", required: true, index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null, index: true },
  sourceTitle: { type: String, required: true },
  sourceType: { type: String, enum: ["text", "file", "website", "product"], required: true },
  sourceUrl: { type: String, default: "" },
  content: { type: String, required: true },
  embedding: { type: [Number], required: true },
  metadata: { fileName: String, mimeType: String, chunkIndex: Number },
  status: { type: String, enum: ["processing", "ready", "failed"], default: "ready" },
}, { timestamps: true });
schema.index({ userId: 1, twinId: 1, productId: 1, status: 1 });
module.exports = mongoose.models.KnowledgeChunk || mongoose.model("KnowledgeChunk", schema);
