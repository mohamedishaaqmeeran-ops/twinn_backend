const crypto = require("crypto");
const mongoose = require("mongoose");

const Twin = require(
  "../../models/Twin"
);

const Product = require(
  "../../models/Product"
);

const RealtimeSession = require(
  "../../models/RealtimeSession"
);

const {
  getRedis,
} = require(
  "../../config/redis"
);

const validateObjectId = (
  id,
  fieldName
) => {
  if (
    !mongoose.Types.ObjectId.isValid(
      id
    )
  ) {
    const error = new Error(
      `Invalid ${fieldName}.`
    );

    error.statusCode = 400;

    throw error;
  }
};

const getVoiceName = (twin) => {
  const map = {
    "Warm Female": "Kore",
    "Soft Female": "Aoede",
    "Luxury Female": "Leda",
    "Young Male": "Puck",
    "Professional Male": "Charon",
    "Energetic Creator": "Fenrir",
  };

  const configured =
    twin.voice?.voiceId ||
    twin.voice?.voiceName ||
    twin.voice?.voiceType ||
    twin.voiceName ||
    "Kore";

  return (
    map[configured] ||
    configured
  );
};

exports.createSession =
  async ({
    userId,
    twinId,
    productId,
    mode = "test",
    language = "English",
  }) => {
    validateObjectId(
      twinId,
      "Twin ID"
    );

    const twin =
      await Twin.findOne({
        _id: twinId,
        userId,

        status: {
          $ne: "inactive",
        },
      });

    if (!twin) {
      const error = new Error(
        "AI Twin not found."
      );

      error.statusCode = 404;

      throw error;
    }

    if (
      !twin.appearance?.avatarUrl &&
      !twin.image
    ) {
      const error = new Error(
        "AI Twin avatar is not configured."
      );

      error.statusCode = 400;

      throw error;
    }

    if (!twin.isTrained) {
      const error = new Error(
        "Train the AI Twin before starting a realtime session."
      );

      error.statusCode = 400;

      throw error;
    }

    let product = null;

    if (productId) {
      validateObjectId(
        productId,
        "Product ID"
      );

      product =
        await Product.findOne({
          _id: productId,
          userId,
        });

      if (!product) {
        const error =
          new Error(
            "Product not found."
          );

        error.statusCode = 404;

        throw error;
      }
    }

    /*
     * Prevent many forgotten active
     * sessions for the same Twin.
     */
    await RealtimeSession.updateMany(
      {
        userId,
        twinId,

        status: {
          $in: [
            "created",
            "connecting",
            "active",
          ],
        },
      },

      {
        status: "ended",
        endedAt: new Date(),
      }
    );

    const session =
      await RealtimeSession.create({
        userId,
        twinId,

        productId:
          product?._id ||
          null,

        mode:
          mode === "live"
            ? "live"
            : "test",

        language:
          String(
            language ||
              twin.primaryLanguage ||
              "English"
          ),

        voiceName:
          getVoiceName(twin),

        status: "created",
      });

    const socketToken =
      crypto
        .randomBytes(32)
        .toString("hex");

    const redis =
      getRedis();

    await redis.set(
      `realtime-token:${socketToken}`,

      JSON.stringify({
        userId:
          String(userId),

        sessionId:
          String(session._id),
      }),

      "EX",
      60
    );

    const baseSocketUrl =
      String(
        process.env.PUBLIC_WS_URL ||
          ""
      ).replace(/\/+$/, "");

    if (!baseSocketUrl) {
      throw new Error(
        "PUBLIC_WS_URL is missing."
      );
    }

    return {
      session,

      socketUrl:
        `${baseSocketUrl}/realtime`,

      socketToken,
    };
  };

exports.getSession =
  async ({
    userId,
    sessionId,
  }) => {
    validateObjectId(
      sessionId,
      "session ID"
    );

    const session =
      await RealtimeSession.findOne({
        _id: sessionId,
        userId,
      })
        .populate("twinId")
        .populate("productId");

    if (!session) {
      const error = new Error(
        "Realtime session not found."
      );

      error.statusCode = 404;

      throw error;
    }

    return session;
  };

exports.endSession =
  async ({
    userId,
    sessionId,
  }) => {
    validateObjectId(
      sessionId,
      "session ID"
    );

    const session =
      await RealtimeSession.findOne({
        _id: sessionId,
        userId,
      });

    if (!session) {
      const error = new Error(
        "Realtime session not found."
      );

      error.statusCode = 404;

      throw error;
    }

    session.status = "ended";
    session.endedAt =
      new Date();

    await session.save();

    return session;
  };