const mongoose = require("mongoose");

const knowledgeChunkSchema = new mongoose.Schema(
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
      index: true,
    },

    sourceType: {
      type: String,
      enum: ["file", "website", "text", "product"],
      required: true,
    },

    sourceTitle: String,
    content: {
      type: String,
      required: true,
    },

    embedding: {
      type: [Number],
      default: [],
    },

    status: {
      type: String,
      enum: ["processing", "ready", "failed"],
      default: "ready",
    },
  },
  {
    timestamps: true,
  }
);

knowledgeChunkSchema.index({
  userId: 1,
  twinId: 1,
  productId: 1,
  status: 1,
});

module.exports = mongoose.model(
  "KnowledgeChunk",
  knowledgeChunkSchema
);