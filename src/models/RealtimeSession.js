const mongoose =
  require("mongoose");

const realtimeSessionSchema =
  new mongoose.Schema(
    {
      userId: {
        type:
          mongoose.Schema
            .Types.ObjectId,

        ref:
          "User",

        required:
          true,

        index:
          true,
      },

      twinId: {
        type:
          mongoose.Schema
            .Types.ObjectId,

        ref:
          "Twin",

        required:
          true,

        index:
          true,
      },

      productId: {
        type:
          mongoose.Schema
            .Types.ObjectId,

        ref:
          "Product",

        default:
          null,

        index:
          true,
      },

      productName: {
        type:
          String,

        default:
          "",

        trim:
          true,
      },

      language: {
        type:
          String,

        default:
          "English",

        trim:
          true,
      },

      mode: {
        type:
          String,

        enum: [
          "test",
          "live",
          "preview",
        ],

        default:
          "test",
      },

      status: {
        type:
          String,

        enum: [
          "created",
          "connecting",
          "active",
          "closed",
          "ended",
          "failed",
        ],

        default:
          "created",

        index:
          true,
      },

      socketToken: {
        type:
          String,

        required:
          true,

        index:
          true,
      },

      expiresAt: {
        type:
          Date,

        required:
          true,

        index:
          true,
      },

      connectedAt: {
        type:
          Date,

        default:
          null,
      },

      endedAt: {
        type:
          Date,

        default:
          null,
      },

      closeCode: {
        type:
          Number,

        default:
          null,
      },

      closeReason: {
        type:
          String,

        default:
          "",
      },

      failureReason: {
        type:
          String,

        default:
          "",
      },
    },
    {
      timestamps:
        true,
    }
  );

/*
 * Automatically remove old sessions
 * after expiry.
 */

realtimeSessionSchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds:
      24 * 60 * 60,
  }
);

module.exports =
  mongoose.models
    .RealtimeSession ||
  mongoose.model(
    "RealtimeSession",
    realtimeSessionSchema
  );