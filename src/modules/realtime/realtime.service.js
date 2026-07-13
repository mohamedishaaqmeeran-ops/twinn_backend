const crypto = require("crypto");
const mongoose = require("mongoose");

const Twin = require(
  "../../models/Twin"
);

const Product = require(
  "../../models/Product"
);

const RealtimeSession =
  require(
    "../../models/RealtimeSession"
  );

const {
  getRedis,
} = require(
  "../../config/redis"
);

const validateId = (
  value,
  label
) => {
  if (
    !mongoose.Types.ObjectId
      .isValid(value)
  ) {
    const error = new Error(
      `Invalid ${label}.`
    );

    error.statusCode = 400;
    throw error;
  }
};

exports.createSession =
  async ({
    userId,
    twinId,
    productId,
    mode,
    language,
  }) => {
    validateId(
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
      !twin.appearance
        ?.avatarUrl &&
      !twin.image
    ) {
      throw new Error(
        "AI Twin avatar is not configured."
      );
    }

    if (!twin.isTrained) {
      throw new Error(
        "Train the AI Twin before starting a realtime session."
      );
    }

    let product = null;

    if (productId) {
      validateId(
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

    const session =
      await RealtimeSession.create({
        userId,
        twinId,
        productId:
          product?._id || null,
        mode:
          mode || "test",
        language:
          language ||
          twin.primaryLanguage ||
          "English",
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

    return {
      session,

      socketUrl:
        `${process.env.PUBLIC_WS_URL}/realtime`,

      socketToken,
    };
  };

exports.getSession =
  async ({
    userId,
    sessionId,
  }) => {
    validateId(
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
    validateId(
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