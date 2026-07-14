const {
  getGenAIClient,
} = require("../config/genai");

const liveModel =
  process.env.GEMINI_LIVE_MODEL ||
  "gemini-2.5-flash-native-audio-preview-12-2025";

/* =========================================================
   SAFE WEBSOCKET SEND
========================================================= */

const safeSend = (
  websocket,
  payload
) => {
  if (
    websocket &&
    websocket.readyState === 1
  ) {
    websocket.send(
      JSON.stringify(payload)
    );
  }
};

/* =========================================================
   CREATE GEMINI LIVE CONNECTION
========================================================= */

const createGeminiLiveConnection =
  async ({
    systemPrompt,
    language = "English",
    websocket,
  }) => {
    if (!systemPrompt) {
      throw new Error(
        "Gemini system prompt is required."
      );
    }

    const ai =
      await getGenAIClient();

    if (
      !ai ||
      !ai.live ||
      typeof ai.live.connect !==
        "function"
    ) {
      throw new Error(
        "Gemini Live API is not available in the configured SDK."
      );
    }

    const session =
      await ai.live.connect({
        model:
          liveModel,

        config: {
          responseModalities: [
            "TEXT",
          ],

          systemInstruction: {
            parts: [
              {
                text:
                  systemPrompt,
              },
            ],
          },
        },

        callbacks: {
          onopen: () => {
            console.log(
              "GEMINI LIVE CONNECTED"
            );

            safeSend(
              websocket,
              {
                type:
                  "gemini.connected",

                event:
                  "gemini.connected",

                language,
              }
            );
          },

          onmessage: (
            message
          ) => {
            try {
              const serverContent =
                message?.serverContent ||
                message?.data
                  ?.serverContent ||
                null;

              const modelTurn =
                serverContent
                  ?.modelTurn;

              const parts =
                modelTurn
                  ?.parts ||
                [];

              for (
                const part of parts
              ) {
                if (
                  part?.text
                ) {
                  safeSend(
                    websocket,
                    {
                      type:
                        "transcript.assistant",

                      event:
                        "transcript:assistant",

                      text:
                        part.text,
                    }
                  );
                }

                if (
                  part?.inlineData
                    ?.data
                ) {
                  safeSend(
                    websocket,
                    {
                      type:
                        "audio.output",

                      event:
                        "audio:output",

                      audio:
                        part
                          .inlineData
                          .data,

                      mimeType:
                        part
                          .inlineData
                          .mimeType,

                      sampleRate:
                        24000,
                    }
                  );
                }
              }

              if (
                serverContent
                  ?.turnComplete
              ) {
                safeSend(
                  websocket,
                  {
                    type:
                      "conversation.turn-complete",

                    event:
                      "conversation:turn-complete",
                  }
                );
              }

              if (
                serverContent
                  ?.interrupted
              ) {
                safeSend(
                  websocket,
                  {
                    type:
                      "conversation.interrupted",

                    event:
                      "conversation:interrupted",
                  }
                );
              }

              const inputTranscript =
                serverContent
                  ?.inputTranscription
                  ?.text;

              if (
                inputTranscript
              ) {
                safeSend(
                  websocket,
                  {
                    type:
                      "transcript.user",

                    event:
                      "transcript:user",

                    text:
                      inputTranscript,
                  }
                );
              }

              const outputTranscript =
                serverContent
                  ?.outputTranscription
                  ?.text;

              if (
                outputTranscript
              ) {
                safeSend(
                  websocket,
                  {
                    type:
                      "transcript.assistant",

                    event:
                      "transcript:assistant",

                    text:
                      outputTranscript,
                  }
                );
              }
            } catch (error) {
              console.error(
                "GEMINI MESSAGE PROCESSING ERROR:",
                error
              );
            }
          },

          onerror: (
            error
          ) => {
            console.error(
              "GEMINI LIVE ERROR:",
              error
            );

            safeSend(
              websocket,
              {
                type:
                  "gemini.error",

                event:
                  "session:error",

                message:
                  error?.message ||
                  "Gemini Live error.",
              }
            );
          },

          onclose: (
            event
          ) => {
            console.log(
              "GEMINI LIVE CLOSED:",
              event
            );

            safeSend(
              websocket,
              {
                type:
                  "gemini.closed",

                event:
                  "gemini:closed",

                reason:
                  event?.reason ||
                  "Gemini Live connection closed.",
              }
            );
          },
        },
      });

    return session;
  };

/* =========================================================
   SEND TEXT
========================================================= */

const sendTextToGeminiLive =
  async ({
    liveSession,
    text,
  }) => {
    const normalizedText =
      String(
        text || ""
      ).trim();

    if (!normalizedText) {
      throw new Error(
        "Text is required."
      );
    }

    if (!liveSession) {
      throw new Error(
        "Gemini Live session is unavailable."
      );
    }

    if (
      typeof liveSession
        .sendClientContent ===
      "function"
    ) {
      await liveSession
        .sendClientContent({
          turns: [
            {
              role:
                "user",

              parts: [
                {
                  text:
                    normalizedText,
                },
              ],
            },
          ],

          turnComplete:
            true,
        });

      return;
    }

    if (
      typeof liveSession.send ===
      "function"
    ) {
      await liveSession.send({
        clientContent: {
          turns: [
            {
              role:
                "user",

              parts: [
                {
                  text:
                    normalizedText,
                },
              ],
            },
          ],

          turnComplete:
            true,
        },
      });

      return;
    }

    throw new Error(
      "Gemini Live session does not support text messages."
    );
  };

/* =========================================================
   CLOSE CONNECTION
========================================================= */

const closeGeminiLiveConnection =
  async (
    liveSession
  ) => {
    if (!liveSession) {
      return;
    }

    if (
      typeof liveSession.close ===
      "function"
    ) {
      await liveSession.close();

      return;
    }

    if (
      typeof liveSession.disconnect ===
      "function"
    ) {
      await liveSession
        .disconnect();
    }
  };

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  createGeminiLiveConnection,
  sendTextToGeminiLive,
  closeGeminiLiveConnection,
  liveModel,
};