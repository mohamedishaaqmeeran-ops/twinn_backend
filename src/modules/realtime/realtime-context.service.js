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
  const session = await RealtimeSession.findOne({
    _id: sessionId,
    socketToken,
    expiresAt: {
      $gt: new Date(),
    },
    status: {
      $in: ["creating", "active"],
    },
  }).lean();

  if (!session) {
    throw new Error("Invalid or expired realtime session.");
  }

  /*
   * Do not take userId from the WebSocket message.
   * Use the userId stored in the verified session.
   */
  const userId = session.userId;
  const twinId = session.twinId;

  const twin = await Twin.findOne({
    _id: twinId,
    userId,
    status: {
      $ne: "inactive",
    },
  }).lean();

  if (!twin) {
    throw new Error("AI Twin not found.");
  }

  let products = [];

  if (session.productId) {
    /*
     * Selected-product mode:
     * Avatar can discuss only this one product.
     */
    products = await Product.find({
      _id: session.productId,
      userId,
      status: "active",
    }).lean();
  } else {
    /*
     * User-catalogue mode:
     * Avatar can discuss all products of this user,
     * but never another user's products.
     */
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

  const knowledgeFilter = {
    userId,
    twinId,
    status: "ready",
  };

  /*
   * Add productId to KnowledgeChunk and apply this filter
   * when the knowledge is specific to a product.
   */
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
    .select("sourceTitle content productId")
    .limit(50)
    .lean();

  return {
    session,
    twin,
    products: products.map(formatProduct),
    knowledgeChunks,
  };
};