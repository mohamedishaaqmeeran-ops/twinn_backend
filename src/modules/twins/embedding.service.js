const { getGenAIClient } =
  require("../../config/genai");

const KnowledgeChunk =
  require("../../models/KnowledgeChunk");

const embeddingModel =
  process.env.GEMINI_EMBEDDING_MODEL ||
  "gemini-embedding-001";

const getEmbeddingValues = (response) => {
  const embedding =
    response?.embeddings?.[0] ||
    response?.embedding;

  const values =
    embedding?.values ||
    embedding;

  if (!Array.isArray(values)) {
    throw new Error(
      "Gemini did not return a valid embedding."
    );
  }

  return values;
};

exports.generateDocumentEmbedding = async ({
  title,
  content,
}) => {
  const ai = await getGenAIClient();

  const input =
    `title: ${title || "none"} | text: ${content}`;

  const response =
    await ai.models.embedContent({
      model: embeddingModel,
      contents: input,
    });

  return getEmbeddingValues(response);
};

exports.generateQueryEmbedding = async (
  query
) => {
  const ai = await getGenAIClient();

  const input =
    `task: question answering | query: ${query}`;

  const response =
    await ai.models.embedContent({
      model: embeddingModel,
      contents: input,
    });

  return getEmbeddingValues(response);
};

const cosineSimilarity = (
  firstVector,
  secondVector
) => {
  if (
    !Array.isArray(firstVector) ||
    !Array.isArray(secondVector) ||
    firstVector.length !== secondVector.length
  ) {
    return -1;
  }

  let dotProduct = 0;
  let firstMagnitude = 0;
  let secondMagnitude = 0;

  for (
    let index = 0;
    index < firstVector.length;
    index += 1
  ) {
    dotProduct +=
      firstVector[index] *
      secondVector[index];

    firstMagnitude +=
      firstVector[index] ** 2;

    secondMagnitude +=
      secondVector[index] ** 2;
  }

  if (!firstMagnitude || !secondMagnitude) {
    return -1;
  }

  return (
    dotProduct /
    (Math.sqrt(firstMagnitude) *
      Math.sqrt(secondMagnitude))
  );
};

exports.searchKnowledge = async ({
  userId,
  twinId,
  query,
  limit = 5,
}) => {
  const queryEmbedding =
    await exports.generateQueryEmbedding(query);

  const chunks =
    await KnowledgeChunk.find({
      userId,
      twinId,
      status: "ready",
    })
      .select("+embedding")
      .lean();

  return chunks
    .map((chunk) => ({
      ...chunk,

      similarity: cosineSimilarity(
        queryEmbedding,
        chunk.embedding
      ),
    }))
    .filter(
      (chunk) => chunk.similarity > 0
    )
    .sort(
      (first, second) =>
        second.similarity -
        first.similarity
    )
    .slice(0, limit);
};

exports.embeddingModel = embeddingModel;