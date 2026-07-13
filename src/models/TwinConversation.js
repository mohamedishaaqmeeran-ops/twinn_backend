const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
    },

    sources: [
      {
        chunkId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "KnowledgeChunk",
        },

        title: String,
        sourceType: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

const twinConversationSchema = new mongoose.Schema(
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

    title: {
      type: String,
      default: "New conversation",
    },

    messages: {
      type: [messageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

twinConversationSchema.index({
  userId: 1,
  twinId: 1,
  updatedAt: -1,
});

module.exports = mongoose.model(
  "TwinConversation",
  twinConversationSchema
);