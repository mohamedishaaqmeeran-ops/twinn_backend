const {
  loadRealtimeContext,
} = require("./realtime-context.service");

const {
  buildRealtimeSystemPrompt,
} = require("./realtime-prompt.service");

const {
  createGeminiLiveConnection,
} = require("../../services/geminiLive.service");

exports.initializeRealtimeSession = async ({
  sessionId,
  socketToken,
  websocket,
}) => {
  const {
    session,
    twin,
    products,
    knowledgeChunks,
  } = await loadRealtimeContext({
    sessionId,
    socketToken,
  });

  if (!products.length) {
    throw new Error(
      session.productId
        ? "The selected product is unavailable."
        : "No active products were found for this user."
    );
  }

  const systemPrompt = buildRealtimeSystemPrompt({
    twin,
    products,
    knowledgeChunks,
    language: session.language,
    selectedProductId: session.productId,
  });

  const geminiConnection =
    await createGeminiLiveConnection({
      systemPrompt,
      language: session.language,
      websocket,
    });

  return {
    session,
    twin,
    products,
    geminiConnection,
  };
};