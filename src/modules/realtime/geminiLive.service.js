const {
  getGenAIClient,
} = require("../../config/genai");

/* =========================================================
   CONFIGURATION
========================================================= */

const liveModel =
  process.env.GEMINI_LIVE_MODEL ||
  "gemini-3.1-flash-live-preview";

const liveVoice =
  process.env.GEMINI_LIVE_VOICE ||
  "Kore";

/* =========================================================
   SAFE BROWSER WEBSOCKET SEND
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

    return true;
  }

  return false;
};

/* =========================================================
   EXTRACT ERROR MESSAGE
========================================================= */

const getErrorMessage = (
  error,
  fallback
) => {
  return (
    error?.message ||
    error?.error?.message ||
    error?.reason ||
    fallback
  );
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
        "Gemini Live API is unavailable in the configured SDK."
      );
    }

    console.log(
      "CREATING GEMINI LIVE SESSION:",
      {
        model:
          liveModel,

        voice:
          liveVoice,

        language,
      }
    );

    const session =
      await ai.live.connect({
        model:
          liveModel,

        config: {
          /*
           * Native audio Live models
           * require AUDIO response output.
           */
          responseModalities: [
            "AUDIO",
          ],

          /*
           * Gemini creates text transcripts
           * from microphone input and model
           * audio output.
           */
          inputAudioTranscription: {},

          outputAudioTranscription: {},

          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName:
                  liveVoice,
              },
            },
          },

          systemInstruction: {
            parts: [
              {
                text:
                  systemPrompt,
              },
            ],
          },

          /*
           * Automatic VAD is enabled by
           * default. Gemini detects when
           * the user starts and stops
           * speaking.
           */
          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled:
                false,
            },
          },
        },

        callbacks: {
          /* ===============================================
             GEMINI OPEN
          =============================================== */

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

                model:
                  liveModel,
              }
            );
          },

          /* ===============================================
             GEMINI MESSAGE
          =============================================== */

          onmessage: (
            message
          ) => {
            try {
              const serverContent =
                message?.serverContent ||
                message?.data
                  ?.serverContent ||
                null;

              if (!serverContent) {
                return;
              }

              /*
               * User microphone transcript.
               */
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

              /*
               * Model audio transcript.
               *
               * This is the main text that
               * should be sent to D-ID.
               */
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

              /*
               * Audio response chunks.
               *
               * Your frontend may ignore these
               * because D-ID speaks the output
               * transcript.
               */
              const parts =
                serverContent
                  ?.modelTurn
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

                const inlineData =
                  part?.inlineData;

                if (
                  inlineData?.data
                ) {
                  safeSend(
                    websocket,
                    {
                      type:
                        "audio.output",

                      event:
                        "audio:output",

                      audio:
                        inlineData.data,

                      mimeType:
                        inlineData
                          .mimeType ||
                        "audio/pcm;rate=24000",

                      sampleRate:
                        24000,
                    }
                  );
                }
              }

              /*
               * Gemini interrupted its answer
               * because user started speaking.
               */
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

              /*
               * Complete user + assistant turn.
               */
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
            } catch (error) {
              console.error(
                "GEMINI MESSAGE PROCESSING ERROR:",
                error
              );

              safeSend(
                websocket,
                {
                  type:
                    "session.error",

                  event:
                    "session:error",

                  message:
                    getErrorMessage(
                      error,
                      "Unable to process Gemini response."
                    ),
                }
              );
            }
          },

          /* ===============================================
             GEMINI ERROR
          =============================================== */

          onerror: (
            error
          ) => {
            const message =
              getErrorMessage(
                error,
                "Gemini Live error."
              );

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

                message,
              }
            );
          },

          /* ===============================================
             GEMINI CLOSE
          =============================================== */

          onclose: (
            event
          ) => {
            const reason =
              event?.reason ||
              "Gemini Live connection closed.";

            console.log(
              "GEMINI LIVE CLOSED:",
              {
                code:
                  event?.code,

                reason,
              }
            );

            safeSend(
              websocket,
              {
                type:
                  "gemini.closed",

                event:
                  "gemini:closed",

                code:
                  event?.code,

                reason,
              }
            );
          },
        },
      });

    return session;
  };

/* =========================================================
   SEND TEXT TO GEMINI LIVE
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
        .sendRealtimeInput ===
      "function"
    ) {
      await liveSession
        .sendRealtimeInput({
          text:
            normalizedText,
        });

      return;
    }

    /*
     * Compatibility fallback for older
     * versions of @google/genai.
     */
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

    throw new Error(
      "Gemini Live session does not support text input."
    );
  };

/* =========================================================
   SEND REALTIME AUDIO TO GEMINI
========================================================= */

const sendAudioToGeminiLive =
  async ({
    liveSession,
    audio,
    mimeType =
      "audio/pcm;rate=16000",
  }) => {
    if (!liveSession) {
      throw new Error(
        "Gemini Live session is unavailable."
      );
    }

    if (!audio) {
      return;
    }

    if (
      typeof liveSession
        .sendRealtimeInput !==
      "function"
    ) {
      throw new Error(
        "Gemini Live session does not support realtime audio input."
      );
    }

    /*
     * Current @google/genai API format.
     *
     * Do not use:
     * media: {...}
     * mediaChunks: [...]
     */
    await liveSession
      .sendRealtimeInput({
        audio: {
          data:
            audio,

          mimeType:
            mimeType ||
            "audio/pcm;rate=16000",
        },
      });
  };

/* =========================================================
   MICROPHONE START
========================================================= */

const startGeminiAudioActivity =
  async (
    liveSession
  ) => {
    if (!liveSession) {
      throw new Error(
        "Gemini Live session is unavailable."
      );
    }

    /*
     * Automatic VAD is enabled.
     *
     * Gemini detects activity from PCM
     * chunks, so no manual activityStart
     * message is required.
     */
    console.log(
      "GEMINI MICROPHONE STREAM STARTED"
    );
  };

/* =========================================================
   MICROPHONE END
========================================================= */

const endGeminiAudioActivity =
  async (
    liveSession
  ) => {
    if (
      !liveSession ||
      typeof liveSession
        .sendRealtimeInput !==
        "function"
    ) {
      return;
    }

    /*
     * Flush any cached input after the
     * microphone stream pauses.
     *
     * The session remains open and can
     * receive additional microphone input.
     */
    await liveSession
      .sendRealtimeInput({
        audioStreamEnd:
          true,
      });

    console.log(
      "GEMINI MICROPHONE STREAM ENDED"
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
      typeof liveSession
        .close ===
      "function"
    ) {
      await liveSession.close();

      return;
    }

    if (
      typeof liveSession
        .disconnect ===
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
  sendAudioToGeminiLive,
  startGeminiAudioActivity,
  endGeminiAudioActivity,
  closeGeminiLiveConnection,
  liveModel,
};