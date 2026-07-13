const WebSocket = require("ws");

const RealtimeSession = require(
  "../../models/RealtimeSession"
);

const Twin = require(
  "../../models/Twin"
);

const Product = require(
  "../../models/Product"
);

const {
  getRedis,
} = require("../../config/redis");

const {
  createGeminiLiveSession,
} = require("./geminiLive.service");

/* =========================================================
   SEND MESSAGE
========================================================= */

const sendSocketMessage = (
  socket,
  payload
) => {
  if (
    socket.readyState !==
    WebSocket.OPEN
  ) {
    return false;
  }

  socket.send(
    JSON.stringify(payload)
  );

  return true;
};

/* =========================================================
   AUTHENTICATE ONE-TIME SOCKET TOKEN
========================================================= */

const authenticateSocket =
  async (request) => {
    const baseUrl =
      process.env.PUBLIC_API_URL ||
      "http://localhost:8000";

    const requestUrl =
      new URL(
        request.url,
        baseUrl
      );

    const token =
      requestUrl.searchParams.get(
        "token"
      );

    if (!token) {
      console.error(
        "WEBSOCKET AUTH ERROR: token missing"
      );

      return null;
    }

    const redis =
      getRedis();

    const redisKey =
      `realtime-token:${token}`;

    const stored =
      await redis.get(redisKey);

    if (!stored) {
      console.error(
        "WEBSOCKET AUTH ERROR: token invalid or expired"
      );

      return null;
    }

    /*
     * Token can be used only once.
     */
    await redis.del(redisKey);

    return JSON.parse(stored);
  };

/* =========================================================
   SAVE TRANSCRIPT
========================================================= */

const appendTranscript =
  async ({
    sessionId,
    role,
    text,
  }) => {
    const normalized =
      String(text || "").trim();

    if (!normalized) {
      return;
    }

    await RealtimeSession.updateOne(
      {
        _id: sessionId,
      },
      {
        $push: {
          transcripts: {
            $each: [
              {
                role,
                text: normalized,
                createdAt:
                  new Date(),
              },
            ],
            $slice: -100,
          },
        },
      }
    );
  };

/* =========================================================
   HANDLE AUTHENTICATED CONNECTION
========================================================= */

const handleRealtimeConnection =
  async ({
    socket,
    auth,
  }) => {
    let gemini = null;
    let geminiReady = false;
    let closing = false;

    const session =
      await RealtimeSession.findOne({
        _id: auth.sessionId,
        userId: auth.userId,
      });

    if (!session) {
      socket.close(
        4004,
        "Realtime session not found"
      );

      return;
    }

    const twin =
      await Twin.findOne({
        _id: session.twinId,
        userId: auth.userId,
      });

    if (!twin) {
      socket.close(
        4004,
        "AI Twin not found"
      );

      return;
    }

    let product = null;

    if (session.productId) {
      product =
        await Product.findOne({
          _id:
            session.productId,

          userId:
            auth.userId,
        });
    }

    session.status =
      "connecting";

    await session.save();

    /*
     * Tell the frontend immediately that the
     * WebSocket and Redis authentication worked.
     */
    sendSocketMessage(
      socket,
      {
        event:
          "socket:connected",

        sessionId:
          String(session._id),

        message:
          "WebSocket connected. Initializing Gemini Live...",
      }
    );

    console.log(
      "WEBSOCKET SESSION CONNECTED:",
      String(session._id)
    );

    /* =====================================================
       REGISTER SOCKET HANDLERS BEFORE GEMINI
    ===================================================== */

    socket.on(
      "message",
      async (rawMessage) => {
        try {
          const message =
            JSON.parse(
              rawMessage.toString()
            );

          console.log(
            "WEBSOCKET MESSAGE:",
            message.event
          );

          switch (
            message.event
          ) {
            case "ping": {
              sendSocketMessage(
                socket,
                {
                  event: "pong",
                  timestamp:
                    Date.now(),
                  geminiReady,
                }
              );

              break;
            }

            case "text:input": {
              if (!geminiReady) {
                sendSocketMessage(
                  socket,
                  {
                    event:
                      "session:error",

                    message:
                      "Gemini Live is still initializing.",
                  }
                );

                break;
              }

              gemini.sendText(
                message.text
              );

              break;
            }

            case "audio:start": {
              if (!geminiReady) {
                sendSocketMessage(
                  socket,
                  {
                    event:
                      "session:error",

                    message:
                      "Gemini Live is still initializing.",
                  }
                );

                break;
              }

              gemini.activityStart();

              break;
            }

            case "audio:input": {
              if (!geminiReady) {
                break;
              }

              if (
                !message.audio
              ) {
                throw new Error(
                  "Audio data is missing."
                );
              }

              const audioBuffer =
                Buffer.from(
                  message.audio,
                  "base64"
                );

              gemini.sendAudio({
                buffer:
                  audioBuffer,

                mimeType:
                  message.mimeType ||
                  "audio/pcm;rate=16000",
              });

              break;
            }

            case "audio:end": {
              if (geminiReady) {
                gemini.activityEnd();
              }

              break;
            }

            case "audio:stream-end": {
              if (geminiReady) {
                gemini.endAudioStream();
              }

              break;
            }

            case "conversation:interrupt": {
              if (geminiReady) {
                try {
                  gemini.activityEnd();
                } catch (error) {
                  console.error(
                    "GEMINI INTERRUPT ERROR:",
                    error.message
                  );
                }
              }

              sendSocketMessage(
                socket,
                {
                  event:
                    "conversation:interrupted",
                }
              );

              break;
            }

            case "session:stop": {
              closing = true;

              socket.close(
                1000,
                "Session ended"
              );

              break;
            }

            default: {
              sendSocketMessage(
                socket,
                {
                  event:
                    "session:error",

                  message:
                    `Unsupported event: ${
                      message.event ||
                      "unknown"
                    }`,
                }
              );
            }
          }
        } catch (error) {
          console.error(
            "WEBSOCKET MESSAGE ERROR:",
            error
          );

          sendSocketMessage(
            socket,
            {
              event:
                "session:error",

              message:
                error.message ||
                "Invalid realtime message.",
            }
          );
        }
      }
    );

    socket.on(
      "error",
      async (error) => {
        console.error(
          "WEBSOCKET CLIENT ERROR:",
          error
        );

        await RealtimeSession.updateOne(
          {
            _id:
              session._id,
          },
          {
            status: "failed",
            lastError:
              error.message,
          }
        );
      }
    );

    socket.on(
      "close",
      async (
        code,
        reason
      ) => {
        console.log(
          "WEBSOCKET CLOSED:",
          {
            sessionId:
              String(
                session._id
              ),

            code,

            reason:
              reason.toString(),

            closing,
          }
        );

        geminiReady = false;

        try {
          gemini?.close();
        } catch (error) {
          console.error(
            "GEMINI CLOSE ERROR:",
            error.message
          );
        }

        await RealtimeSession.updateOne(
          {
            _id:
              session._id,
          },
          {
            status: "ended",
            endedAt:
              new Date(),
          }
        );
      }
    );

    /* =====================================================
       START GEMINI AFTER HANDLERS ARE READY
    ===================================================== */

    try {
      console.log(
        "CREATING GEMINI LIVE SESSION:",
        String(session._id)
      );

      const geminiPromise =
        createGeminiLiveSession({
          userId:
            auth.userId,

          twin,
          product,

          language:
            session.language,

          onReady:
            async ({
              sessionId:
                geminiSessionId,
            }) => {
              geminiReady =
                true;

              session.geminiSessionId =
                geminiSessionId;

              session.status =
                "active";

              session.startedAt =
                new Date();

              session.lastError =
                "";

              await session.save();

              console.log(
                "GEMINI LIVE READY:",
                String(
                  session._id
                )
              );

              sendSocketMessage(
                socket,
                {
                  event:
                    "session:ready",

                  sessionId:
                    String(
                      session._id
                    ),

                  twin: {
                    id:
                      String(
                        twin._id
                      ),

                    name:
                      twin.name,

                    avatarUrl:
                      twin
                        .appearance
                        ?.avatarUrl ||
                      twin.image ||
                      "",

                    language:
                      session.language,

                    voiceName:
                      session.voiceName,
                  },

                  product:
                    product
                      ? {
                          id:
                            String(
                              product._id
                            ),

                          name:
                            product.name,
                        }
                      : null,

                  audio: {
                    inputSampleRate:
                      16000,

                    outputSampleRate:
                      24000,

                    channels: 1,

                    encoding:
                      "pcm_s16le",
                  },
                }
              );
            },

          onAudio:
            async (
              pcmBuffer
            ) => {
              sendSocketMessage(
                socket,
                {
                  event:
                    "audio:output",

                  audio:
                    pcmBuffer.toString(
                      "base64"
                    ),

                  sampleRate:
                    24000,

                  mimeType:
                    "audio/pcm;rate=24000",
                }
              );
            },

          onUserTranscript:
            async (text) => {
              sendSocketMessage(
                socket,
                {
                  event:
                    "transcript:user",

                  text,
                }
              );

              await appendTranscript({
                sessionId:
                  session._id,

                role: "user",

                text,
              });
            },

          onAssistantTranscript:
            async (text) => {
              sendSocketMessage(
                socket,
                {
                  event:
                    "transcript:assistant",

                  text,
                }
              );

              await appendTranscript({
                sessionId:
                  session._id,

                role:
                  "assistant",

                text,
              });
            },

          onTurnComplete:
            () => {
              sendSocketMessage(
                socket,
                {
                  event:
                    "conversation:turn-complete",
                }
              );
            },

          onInterrupted:
            () => {
              sendSocketMessage(
                socket,
                {
                  event:
                    "conversation:interrupted",
                }
              );
            },

          onError:
            async (error) => {
              console.error(
                "GEMINI LIVE ERROR:",
                error
              );

              geminiReady =
                false;

              await RealtimeSession.updateOne(
                {
                  _id:
                    session._id,
                },
                {
                  status:
                    "failed",

                  lastError:
                    error.message,
                }
              );

              sendSocketMessage(
                socket,
                {
                  event:
                    "session:error",

                  message:
                    error.message ||
                    "Gemini Live failed.",
                }
              );
            },

          onClose:
            ({
              code,
              reason,
            }) => {
              geminiReady =
                false;

              console.error(
                "GEMINI LIVE CLOSED:",
                {
                  code,
                  reason,
                }
              );

              sendSocketMessage(
                socket,
                {
                  event:
                    "gemini:closed",

                  code,
                  reason,
                }
              );
            },
        });

      const timeoutPromise =
        new Promise(
          (_, reject) => {
            setTimeout(
              () => {
                reject(
                  new Error(
                    "Gemini Live initialization timed out after 20 seconds."
                  )
                );
              },
              20000
            );
          }
        );

      gemini =
        await Promise.race([
          geminiPromise,
          timeoutPromise,
        ]);
    } catch (error) {
      console.error(
        "REALTIME GEMINI SETUP ERROR:",
        error
      );

      geminiReady = false;

      session.status =
        "failed";

      session.lastError =
        error.message;

      await session.save();

      sendSocketMessage(
        socket,
        {
          event:
            "session:error",

          message:
            error.message ||
            "Gemini Live setup failed.",
        }
      );

      /*
       * Keep the WebSocket open briefly so the
       * browser can receive the error message.
       */
      setTimeout(() => {
        if (
          socket.readyState ===
          WebSocket.OPEN
        ) {
          socket.close(
            1011,
            "Gemini Live setup failed"
          );
        }
      }, 500);
    }
  };

/* =========================================================
   CREATE WEBSOCKET SERVER
========================================================= */

const createRealtimeSocketServer =
  (httpServer) => {
    const socketServer =
      new WebSocket.Server({
        server:
          httpServer,

        path:
          "/realtime",

        maxPayload:
          2 *
          1024 *
          1024,
      });

    socketServer.on(
      "connection",
      async (
        socket,
        request
      ) => {
        console.log(
          "INCOMING WEBSOCKET:",
          request.url
        );

        try {
          const auth =
            await authenticateSocket(
              request
            );

          if (!auth) {
            socket.close(
              4001,
              "Unauthorized"
            );

            return;
          }

          console.log(
            "WEBSOCKET AUTHENTICATED:",
            auth.sessionId
          );

          await handleRealtimeConnection({
            socket,
            auth,
          });
        } catch (error) {
          console.error(
            "WEBSOCKET CONNECTION ERROR:",
            error
          );

          sendSocketMessage(
            socket,
            {
              event:
                "session:error",

              message:
                error.message ||
                "WebSocket connection failed.",
            }
          );

          setTimeout(() => {
            if (
              socket.readyState ===
              WebSocket.OPEN
            ) {
              socket.close(
                1011,
                "Connection failed"
              );
            }
          }, 500);
        }
      }
    );

    socketServer.on(
      "error",
      (error) => {
        console.error(
          "WEBSOCKET SERVER ERROR:",
          error
        );
      }
    );

    console.log(
      "Realtime WebSocket server initialized at /realtime"
    );

    return socketServer;
  };

module.exports = {
  createRealtimeSocketServer,
};