const { GoogleGenAI } = require("@google/genai");
const KnowledgeChunk = require("../../models/KnowledgeChunk");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const values = (r) => r?.embeddings?.[0]?.values || r?.embedding?.values || [];
exports.generateDocumentEmbedding = async (text) => values(await ai.models.embedContent({ model, contents: text, config: { taskType: "RETRIEVAL_DOCUMENT" } }));
exports.generateQueryEmbedding = async (text) => values(await ai.models.embedContent({ model, contents: text, config: { taskType: "RETRIEVAL_QUERY" } }));
exports.searchKnowledge = async ({ userId, twinId, productId, query }) => {
  const queryVector = await exports.generateQueryEmbedding(query);
  const filter = { userId, twinId, status: "ready", productId: productId || null };
  try {
    return await KnowledgeChunk.aggregate([{ $vectorSearch: { index: process.env.KNOWLEDGE_VECTOR_INDEX || "knowledge_vector_index", path: "embedding", queryVector, numCandidates: 100, limit: 8, filter } }, { $project: { content: 1, sourceTitle: 1, sourceType: 1, productId: 1, score: { $meta: "vectorSearchScore" } } }]);
  } catch (error) {
    return (await KnowledgeChunk.find(filter).select("content sourceTitle sourceType productId").limit(8).lean()).map(x => ({ ...x, score: null }));
  }
};
