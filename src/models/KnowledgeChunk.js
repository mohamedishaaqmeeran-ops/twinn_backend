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

    sourceType: {
      type: String,
      enum: [
        "text",
        "file",
        "website",
        "faq",
        "product",
      ],
      default: "text",
    },

    sourceTitle: {
      type: String,
      default: "",
      trim: true,
    },

    sourceUrl: {
      type: String,
      default: "",
    },

    fileName: {
      type: String,
      default: "",
    },

    fileUrl: {
      type: String,
      default: "",
    },

    filePublicId: {
      type: String,
      default: "",
    },

    mimeType: {
      type: String,
      default: "",
    },

    chunkIndex: {
      type: Number,
      required: true,
      min: 0,
    },

    content: {
      type: String,
      required: true,
      trim: true,
    },

    embedding: {
      type: [Number],
      default: [],
      select: false,
    },

    embeddingModel: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["processing", "ready", "failed"],
      default: "ready",
    },

    error: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

knowledgeChunkSchema.index({
  twinId: 1,
  sourceTitle: 1,
  chunkIndex: 1,
});

module.exports = mongoose.model(
  "KnowledgeChunk",
  knowledgeChunkSchema
);