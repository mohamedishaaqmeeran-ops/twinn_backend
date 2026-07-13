const crypto = require("crypto");

const {
  GoogleGenAI,
  Modality,
  Type,
} = require("@google/genai");

const {
  buildRealtimePrompt,
} = require(
  "./realtime.prompt"
);

const realtimeTools = require(
  "./realtime.tools"
);

const GEMINI_LIVE_MODEL =
  process.env.GEMINI_LIVE_MODEL ||
  "gemini-3.1-flash-live-preview";

const VOICE_MAP = {
  "Warm Female": "Kore",
  "Soft Female": "Aoede",
  "Luxury Female": "Leda",
  "Young Male": "Puck",
  "Professional Male": "Charon",
  "Energetic Creator": "Fenrir",
};

const createClient = () => {
  const apiKey = String(
    process.env.GEMINI_API_KEY || ""
  ).trim();

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing."
    );
  }

  return new GoogleGenAI({
    apiKey,
  });
};

const getVoiceName = (twin) => {
  const voice =
    twin.voice || {};

  const configured =
    voice.voiceId ||
    voice.voiceName ||
    voice.voiceType ||
    twin.voiceName ||
    "Kore";

  return (
    VOICE_MAP[configured] ||
    configured
  );
};

const extractAudioParts = (
  message
) => {
  const parts =
    message?.serverContent
      ?.modelTurn?.parts || [];

  return parts
    .map(
      (part) =>
        part?.inlineData?.data
    )
    .filter(Boolean);
};

exports.createGeminiLiveSession =
  async ({
    userId,
    twin,
    product,
    language,

    onReady,
    onAudio,
    onUserTranscript,
    onAssistantTranscript,
    onInterrupted,
    onTurnComplete,
    onError,
    onClose,
  }) => {
    const ai = createClient();

    const internalSessionId =
      crypto.randomUUID();

    let liveSession = null;
    let closed = false;
    let toolCallInProgress =
      false;

    const handleToolCalls =
      async (message) => {
        const functionCalls =
          message?.toolCall
            ?.functionCalls || [];

        if (!functionCalls.length) {
          return;
        }

        toolCallInProgress = true;

        try {
          const functionResponses =
            [];

          for (
            const call of
            functionCalls
          ) {
            let result;

            try {
              if (
                call.name ===
                "search_product_knowledge"
              ) {
                result =
                  await realtimeTools.searchKnowledge({
                    userId,

                    twinId:
                      twin._id,

                    query:
                      call.args
                        ?.query ||
                      "",
                  });
              } else if (
                call.name ===
                "get_product_details"
              ) {
                const requestedProductId =
                  call.args
                    ?.productId ||
                  product?._id;

                if (
                  !requestedProductId
                ) {
                  result = {
                    found: false,
                    message:
                      "No product is currently selected.",
                  };
                } else {
                  result =
                    await realtimeTools.getProductDetails({
                      userId,

                      productId:
                        requestedProductId,
                    });
                }
              } else {
                result = {
                  error:
                    `Unknown tool: ${call.name}`,
                };
              }
            } catch (toolError) {
              result = {
                error:
                  toolError.message ||
                  "Tool execution failed.",
              };
            }

            functionResponses.push({
              id: call.id,
              name: call.name,

              response: {
                result,
              },
            });
          }

          liveSession.sendToolResponse({
            functionResponses,
          });
        } finally {
          toolCallInProgress =
            false;
        }
      };

    liveSession =
      await ai.live.connect({
        model:
          GEMINI_LIVE_MODEL,

        callbacks: {
          onopen() {
            onReady?.({
              sessionId:
                internalSessionId,
            });
          },

          async onmessage(
            message
          ) {
            try {
              const userText =
                message
                  ?.serverContent
                  ?.inputTranscription
                  ?.text;

              if (userText) {
                onUserTranscript?.(
                  userText
                );
              }

              const assistantText =
                message
                  ?.serverContent
                  ?.outputTranscription
                  ?.text;

              if (assistantText) {
                onAssistantTranscript?.(
                  assistantText
                );
              }

              if (
                message
                  ?.serverContent
                  ?.interrupted
              ) {
                onInterrupted?.();
              }

              const encodedAudioParts =
                extractAudioParts(
                  message
                );

              for (
                const encodedAudio of
                encodedAudioParts
              ) {
                const audioBuffer =
                  Buffer.from(
                    encodedAudio,
                    "base64"
                  );

                await onAudio?.(
                  audioBuffer
                );
              }

              if (
                message.toolCall
                  ?.functionCalls
                  ?.length
              ) {
                await handleToolCalls(
                  message
                );
              }

              if (
                message
                  ?.serverContent
                  ?.turnComplete
              ) {
                onTurnComplete?.();
              }
            } catch (error) {
              onError?.(error);
            }
          },

          onerror(event) {
            const message =
              event?.message ||
              event?.error?.message ||
              "Gemini Live connection error.";

            onError?.(
              new Error(message)
            );
          },

          onclose(event) {
            closed = true;

            onClose?.({
              code:
                event?.code,

              reason:
                event?.reason ||
                "Gemini Live closed.",
            });
          },
        },

        config: {
          responseModalities: [
            Modality.AUDIO,
          ],

          systemInstruction: {
            parts: [
              {
                text:
                  buildRealtimePrompt({
                    twin,
                    product,
                    language,
                  }),
              },
            ],
          },

          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName:
                  getVoiceName(
                    twin
                  ),
              },
            },
          },

          inputAudioTranscription:
            {},

          outputAudioTranscription:
            {},

          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled: false,

              prefixPaddingMs:
                100,

              silenceDurationMs:
                700,
            },
          },

          tools: [
            {
              functionDeclarations: [
                {
                  name:
                    "search_product_knowledge",

                  description:
                    "Search the AI Twin's uploaded brand, FAQ, shipping, returns, warranty, policy and product knowledge.",

                  parameters: {
                    type:
                      Type.OBJECT,

                    properties: {
                      query: {
                        type:
                          Type.STRING,

                        description:
                          "The customer question or knowledge search query.",
                      },
                    },

                    required: [
                      "query",
                    ],
                  },
                },

                {
                  name:
                    "get_product_details",

                  description:
                    "Get current product name, description, price, offer price, stock and availability.",

                  parameters: {
                    type:
                      Type.OBJECT,

                    properties: {
                      productId: {
                        type:
                          Type.STRING,

                        description:
                          "MongoDB product ID. Use the selected product ID when available.",
                      },
                    },

                    required: [],
                  },
                },
              ],
            },
          ],
        },
      });

    return {
      id: internalSessionId,

      get isClosed() {
        return closed;
      },

      get toolCallInProgress() {
        return toolCallInProgress;
      },

      sendAudio({
        buffer,
        mimeType =
          "audio/pcm;rate=16000",
      }) {
        if (closed) {
          throw new Error(
            "Gemini Live session is closed."
          );
        }

        if (
          toolCallInProgress
        ) {
          return false;
        }

        if (
          !Buffer.isBuffer(
            buffer
          ) ||
          !buffer.length
        ) {
          return false;
        }

        liveSession.sendRealtimeInput({
          audio: {
            data:
              buffer.toString(
                "base64"
              ),

            mimeType,
          },
        });

        return true;
      },

      sendText(text) {
        if (closed) {
          throw new Error(
            "Gemini Live session is closed."
          );
        }

        if (
          toolCallInProgress
        ) {
          return false;
        }

        const normalized =
          String(text || "").trim();

        if (!normalized) {
          return false;
        }

        liveSession.sendRealtimeInput({
          text: normalized,
        });

        return true;
      },

      endAudioStream() {
        if (closed) {
          return;
        }

        liveSession.sendRealtimeInput({
          audioStreamEnd: true,
        });
      },

      activityStart() {
        if (closed) {
          return;
        }

        liveSession.sendRealtimeInput({
          activityStart: {},
        });
      },

      activityEnd() {
        if (closed) {
          return;
        }

        liveSession.sendRealtimeInput({
          activityEnd: {},
        });
      },

      close() {
        if (closed) {
          return;
        }

        closed = true;

        liveSession.close();
      },
    };
  };