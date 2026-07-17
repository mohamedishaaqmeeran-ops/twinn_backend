const mongoose = require("mongoose");

const Twin = require("../../models/Twin");
const Product = require("../../models/Product");
const KnowledgeChunk = require("../../models/KnowledgeChunk");
const RealtimeSession = require("../../models/RealtimeSession");

const sanitizeText = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
};

const formatProduct = (product) => {
  const specifications =
    product.specifications instanceof Map
      ? Object.fromEntries(product.specifications)
      : product.specifications || {};

  return {
    id: product._id.toString(),
    name: sanitizeText(product.name),
    description: sanitizeText(product.description),
    category: sanitizeText(product.category),
    price: product.price,
    currency: sanitizeText(product.currency || "INR"),
    stock: product.stock,
    features: product.features || [],
    benefits: product.benefits || [],
    specifications,
    shippingInformation: sanitizeText(
      product.shippingInformation
    ),
    returnPolicy: sanitizeText(product.returnPolicy),
  };
};

exports.loadRealtimeContext = async ({
  sessionId,
  socketToken,
}) => {
  /* =======================================================
     VALIDATE SESSION INPUT
  ======================================================= */

  if (
    !sessionId ||
    !mongoose.Types.ObjectId.isValid(sessionId)
  ) {
    throw new Error("Invalid realtime session ID.");
  }

  if (!socketToken) {
    throw new Error("Realtime socket token is required.");
  }

  /* =======================================================
     LOAD REALTIME SESSION
  ======================================================= */

  const session = await RealtimeSession.findOne({
    _id: sessionId,

    socketToken,

    expiresAt: {
      $gt: new Date(),
    },

    status: {
      $in: [
        "created",
        "creating",
        "connecting",
        "active",
      ],
    },
  }).lean();

  if (!session) {
    console.error("REALTIME SESSION LOOKUP FAILED:", {
      sessionId,
      hasSocketToken: Boolean(socketToken),
      currentTime: new Date().toISOString(),
    });

    throw new Error(
      "Invalid or expired realtime session."
    );
  }

  const userId = session.userId;
  const twinId = session.twinId;

  /* =======================================================
     VALIDATE SESSION REFERENCES
  ======================================================= */

  if (
    !userId ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    throw new Error(
      "Realtime session contains an invalid user ID."
    );
  }

  if (
    !twinId ||
    !mongoose.Types.ObjectId.isValid(twinId)
  ) {
    throw new Error(
      "Realtime session contains an invalid Twin ID."
    );
  }

  /* =======================================================
     LOAD OWNED AI TWIN
  ======================================================= */

  const twin = await Twin.findOne({
    _id: twinId,
    userId,

    status: {
      $ne: "inactive",
    },
  }).lean();

  if (!twin) {
    console.error("REALTIME TWIN LOOKUP FAILED:", {
      userId: String(userId),
      twinId: String(twinId),
    });

    throw new Error(
      "AI Twin was not found for this realtime session."
    );
  }

  /* =======================================================
     LOAD PRODUCTS
  ======================================================= */

  let products = [];

  if (session.productId) {
    if (
      !mongoose.Types.ObjectId.isValid(
        session.productId
      )
    ) {
      throw new Error(
        "Realtime session contains an invalid product ID."
      );
    }

    products = await Product.find({
      _id: session.productId,
      userId,
      status: "active",
    }).lean();
  } else {
    products = await Product.find({
      userId,
      status: "active",
    })
      .sort({
        createdAt: -1,
      })
      .limit(100)
      .lean();
  }

  /* =======================================================
     LOAD KNOWLEDGE
  ======================================================= */

  const knowledgeFilter = {
    userId,
    twinId,
    status: "ready",
  };

  if (session.productId) {
    knowledgeFilter.$or = [
      {
        productId: session.productId,
      },
      {
        productId: null,
      },
      {
        productId: {
          $exists: false,
        },
      },
    ];
  }

  const knowledgeChunks = await KnowledgeChunk.find(
    knowledgeFilter
  )
    .select(
      "sourceTitle content productId"
    )
    .limit(50)
    .lean();

  return {
    session,
    twin,
    products: products.map(formatProduct),
    knowledgeChunks,
  };
};