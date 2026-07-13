let aiClient = null;

const getGenAIClient = async () => {
  if (aiClient) {
    return aiClient;
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is missing in environment variables."
    );
  }

  /*
   * Dynamic import is used because your backend uses CommonJS,
   * while newer SDK packages may expose ESM modules.
   */
  const { GoogleGenAI } = await import("@google/genai");

  aiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  return aiClient;
};

module.exports = {
  getGenAIClient,
};