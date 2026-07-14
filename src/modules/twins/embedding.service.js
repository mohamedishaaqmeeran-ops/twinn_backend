
const mongoose = require("mongoose");

const {
  getGenAIClient,
} = require("../../config/genai");

const KnowledgeChunk = require("../../models/KnowledgeChunk");

/* =========================================================
   CONFIGURATION
========================================================= */

const embeddingModel =
  process.env.GEMINI_EMBEDDING_MODEL ||
  "gemini-embedding-001";

const DEFAULT_SEARCH_LIMIT = 5;

const DEFAULT_MINIMUM_SIMILARITY = Number(
  process.env.KNOWLEDGE_MIN_SIMILARITY || 0.2
);

/* =========================================================
   OBJECT ID HELPERS
========================================================= */

const normalizeObjectId = (
  value,
  fieldName
) => {
  if (!value) {
    throw new Error(
      `${fieldName} is required.`
    );
  }

  if (
    value instanceof
    mongoose.Types.ObjectId
  ) {
    return value;
  }

  if (
    !mongoose.Types.ObjectId.isValid(
      value
    )
  ) {
    throw new Error(
      `Invalid ${fieldName}.`
    );
  }

  return new mongoose.Types.ObjectId(
    value
  );
};

const normalizeOptionalObjectId = (
  value,
  fieldName
) => {
  if (!value) {
    return null;
  }

  return normalizeObjectId(
    value,
    fieldName
  );
};

/* =========================================================
   EMBEDDING RESPONSE PARSER
========================================================= */

const getEmbeddingValues = (
  response
) => {
  const embedding =
    response?.embeddings?.[0] ||
    response?.embedding;

  const values =
    embedding?.values ||
    embedding;

  if (
    !Array.isArray(values) ||
    values.length === 0
  ) {
    throw new Error(
      "Gemini did not return a valid embedding."
    );
  }

  const hasInvalidValue =
    values.some(
      (value) =>
        typeof value !==
          "number" ||
        !Number.isFinite(value)
    );

  if (hasInvalidValue) {
    throw new Error(
      "Gemini returned invalid embedding values."
    );
  }

  return values;
};

/* =========================================================
   DOCUMENT EMBEDDING
========================================================= */

exports.generateDocumentEmbedding =
  async ({
    title,
    content,
  }) => {
    const normalizedContent =
      String(
        content || ""
      ).trim();

    if (!normalizedContent) {
      throw new Error(
        "Document content is required to generate an embedding."
      );
    }

    const normalizedTitle =
      String(
        title || "none"
      ).trim();

    const ai =
      await getGenAIClient();

    const input = [
      `title: ${normalizedTitle}`,
      `text: ${normalizedContent}`,
    ].join(" | ");

    const response =
      await ai.models.embedContent({
        model: embeddingModel,
        contents: input,
      });

    return getEmbeddingValues(
      response
    );
  };

/* =========================================================
   QUERY EMBEDDING
========================================================= */

exports.generateQueryEmbedding =
  async (query) => {
    const normalizedQuery =
      String(query || "").trim();

    if (!normalizedQuery) {
      throw new Error(
        "Query is required to generate an embedding."
      );
    }

    const ai =
      await getGenAIClient();

    const input = [
      "task: question answering",
      `query: ${normalizedQuery}`,
    ].join(" | ");

    const response =
      await ai.models.embedContent({
        model: embeddingModel,
        contents: input,
      });

    return getEmbeddingValues(
      response
    );
  };

/* =========================================================
   COSINE SIMILARITY
========================================================= */

const cosineSimilarity = (
  firstVector,
  secondVector
) => {
  if (
    !Array.isArray(
      firstVector
    ) ||
    !Array.isArray(
      secondVector
    ) ||
    firstVector.length === 0 ||
    secondVector.length === 0 ||
    firstVector.length !==
      secondVector.length
  ) {
    return -1;
  }

  let dotProduct = 0;
  let firstMagnitude = 0;
  let secondMagnitude = 0;

  for (
    let index = 0;
    index <
    firstVector.length;
    index += 1
  ) {
    const firstValue =
      Number(
        firstVector[index]
      );

    const secondValue =
      Number(
        secondVector[index]
      );

    if (
      !Number.isFinite(
        firstValue
      ) ||
      !Number.isFinite(
        secondValue
      )
    ) {
      return -1;
    }

    dotProduct +=
      firstValue *
      secondValue;

    firstMagnitude +=
      firstValue ** 2;

    secondMagnitude +=
      secondValue ** 2;
  }

  if (
    firstMagnitude === 0 ||
    secondMagnitude === 0
  ) {
    return -1;
  }

  return (
    dotProduct /
    (
      Math.sqrt(
        firstMagnitude
      ) *
      Math.sqrt(
        secondMagnitude
      )
    )
  );
};

/* =========================================================
   KNOWLEDGE DATABASE FILTER
========================================================= */

/*
 * Rules:
 *
 * 1. Knowledge must belong to the authenticated user.
 * 2. Knowledge must belong to the selected Twin.
 * 3. Knowledge must have ready status.
 * 4. When a product is selected:
 *    - use knowledge for that product;
 *    - optionally include general Twin knowledge
 *      where productId is null or missing.
 * 5. Never search another user's knowledge.
 */

const buildKnowledgeFilter = ({
  userId,
  twinId,
  productId = null,
  includeGeneralKnowledge = true,
}) => {
  const normalizedUserId =
    normalizeObjectId(
      userId,
      "user ID"
    );

  const normalizedTwinId =
    normalizeObjectId(
      twinId,
      "Twin ID"
    );

  const normalizedProductId =
    normalizeOptionalObjectId(
      productId,
      "product ID"
    );

  const filter = {
    userId:
      normalizedUserId,

    twinId:
      normalizedTwinId,

    status: "ready",
  };

  if (
    normalizedProductId &&
    includeGeneralKnowledge
  ) {
    filter.$or = [
      {
        productId:
          normalizedProductId,
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
  } else if (
    normalizedProductId
  ) {
    /*
     * Strict selected-product mode.
     *
     * Only knowledge directly connected
     * to the selected product is loaded.
     */
    filter.productId =
      normalizedProductId;
  }

  return filter;
};

/* =========================================================
   SEARCH RELEVANT KNOWLEDGE
========================================================= */

exports.searchKnowledge =
  async ({
    userId,
    twinId,
    productId = null,
    query,
    limit =
      DEFAULT_SEARCH_LIMIT,
    minimumSimilarity =
      DEFAULT_MINIMUM_SIMILARITY,
    includeGeneralKnowledge = true,
  }) => {
    const normalizedQuery =
      String(query || "").trim();

    if (!normalizedQuery) {
      throw new Error(
        "Knowledge search query is required."
      );
    }

    const normalizedLimit =
      Math.min(
        Math.max(
          Number(limit) ||
            DEFAULT_SEARCH_LIMIT,
          1
        ),
        20
      );

    const normalizedMinimumSimilarity =
      Number.isFinite(
        Number(
          minimumSimilarity
        )
      )
        ? Number(
            minimumSimilarity
          )
        : DEFAULT_MINIMUM_SIMILARITY;

    /*
     * Generate an embedding for
     * the customer's question.
     */
    const queryEmbedding =
      await exports
        .generateQueryEmbedding(
          normalizedQuery
        );

    /*
     * Build a secure query using:
     *
     * userId + twinId + productId.
     */
    const filter =
      buildKnowledgeFilter({
        userId,
        twinId,
        productId,
        includeGeneralKnowledge,
      });

    /*
     * This only loads knowledge owned
     * by the authenticated user.
     */
    const chunks =
      await KnowledgeChunk.find(
        filter
      )
        .select(
          [
            "+embedding",
            "content",
            "sourceTitle",
            "sourceType",
            "sourceUrl",
            "fileName",
            "productId",
            "chunkIndex",
            "createdAt",
          ].join(" ")
        )
        .lean();

    if (!chunks.length) {
      return [];
    }

    return chunks
      .map((chunk) => {
        const similarity =
          cosineSimilarity(
            queryEmbedding,
            chunk.embedding
          );

        /*
         * Do not return embeddings
         * to the controller or Gemini.
         */
        const {
          embedding,
          ...safeChunk
        } = chunk;

        return {
          ...safeChunk,
          similarity,
        };
      })
      .filter(
        (chunk) =>
          chunk.similarity >=
          normalizedMinimumSimilarity
      )
      .sort(
        (
          firstChunk,
          secondChunk
        ) =>
          secondChunk.similarity -
          firstChunk.similarity
      )
      .slice(
        0,
        normalizedLimit
      );
  };

/* =========================================================
   STRICT PRODUCT-ONLY SEARCH
========================================================= */

/*
 * Use this function during a product-specific
 * live session.
 *
 * It does not include general Twin knowledge.
 * It returns knowledge only for the selected product.
 */

exports.searchProductKnowledge =
  async ({
    userId,
    twinId,
    productId,
    query,
    limit =
      DEFAULT_SEARCH_LIMIT,
    minimumSimilarity =
      DEFAULT_MINIMUM_SIMILARITY,
  }) => {
    if (!productId) {
      throw new Error(
        "Product ID is required for product knowledge search."
      );
    }

    return exports.searchKnowledge({
      userId,
      twinId,
      productId,
      query,
      limit,
      minimumSimilarity,
      includeGeneralKnowledge:
        false,
    });
  };

/* =========================================================
   GENERAL TWIN KNOWLEDGE SEARCH
========================================================= */

/*
 * Use this when no specific product is selected.
 *
 * It loads knowledge belonging only to:
 * authenticated user + selected Twin.
 */

exports.searchTwinKnowledge =
  async ({
    userId,
    twinId,
    query,
    limit =
      DEFAULT_SEARCH_LIMIT,
    minimumSimilarity =
      DEFAULT_MINIMUM_SIMILARITY,
  }) => {
    return exports.searchKnowledge({
      userId,
      twinId,
      productId: null,
      query,
      limit,
      minimumSimilarity,
    });
  };

/* =========================================================
   EXPORTS
========================================================= */

exports.cosineSimilarity =
  cosineSimilarity;

exports.buildKnowledgeFilter =
  buildKnowledgeFilter;

exports.embeddingModel =
  embeddingModel;
