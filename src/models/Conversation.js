const mongoose = require("mongoose");
const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ["user", "assistant", "system"], required: true },
  content: { type: String, required: true },
  audioUrl: { type: String, default: "" },
}, { _id: false, timestamps: true });
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  twinId: { type: mongoose.Schema.Types.ObjectId, ref: "Twin", required: true, index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
  messages: { type: [messageSchema], default: [] },
  status: { type: String, enum: ["active", "closed"], default: "active" },
}, { timestamps: true });
module.exports = mongoose.models.Conversation || mongoose.model("Conversation", schema);
