const mongoose = require("mongoose");

const Product = require(
  "../../models/Product"
);

const embeddingService = require(
  "../twin/embedding.service"
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
    throw new Error(
      `Invalid ${fieldName}.`
    );
  }
};

exports.searchKnowledge =
  async ({
    userId,
    twinId,
    query,
  }) => {
    const normalizedQuery =
      String(query || "").trim();

    if (!normalizedQuery) {
      return {
        found: false,
        message:
          "Knowledge search query is empty.",
        results: [],
      };
    }

    const chunks =
      await embeddingService.searchKnowledge({
        userId,
        twinId,
        query: normalizedQuery,
        limit: Number(
          process.env.RAG_TOP_K || 5
        ),
      });

    if (!chunks.length) {
      return {
        found: false,
        message:
          "No relevant uploaded knowledge was found.",
        results: [],
      };
    }

    return {
      found: true,

      results: chunks.map(
        (chunk) => ({
          id: String(chunk._id),

          title:
            chunk.sourceTitle ||
            "Knowledge",

          sourceType:
            chunk.sourceType ||
            "text",

          content:
            chunk.content,

          similarity:
            chunk.similarity,
        })
      ),
    };
  };

exports.getProductDetails =
  async ({
    userId,
    productId,
  }) => {
    validateObjectId(
      productId,
      "product ID"
    );

    const product =
      await Product.findOne({
        _id: productId,
        userId,
      }).lean();

    if (!product) {
      return {
        found: false,
        message:
          "Product was not found.",
      };
    }

    return {
      found: true,

      product: {
        id: String(product._id),

        name:
          product.name || "",

        description:
          product.description || "",

        category:
          product.category || "",

        price:
          product.price ?? null,

        offerPrice:
          product.offerPrice ??
          product.discountPrice ??
          null,

        stock:
          product.stock ??
          product.quantity ??
          null,

        status:
          product.status || "",

        currency:
          product.currency ||
          "INR",

        image:
          product.image ||
          product.imageUrl ||
          "",
      },
    };
  };