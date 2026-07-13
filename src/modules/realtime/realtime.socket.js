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
} = require(
  "../../config/redis"
);

const {
  createGeminiLiveSession,
} = require(
  "./geminiLive.service"
);

const sendSocketMessage = (
  socket,
  payload
) => {
  if (
    socket.readyState ===
    WebSocket.OPEN
  ) {
    socket.send(
      JSON.stringify(payload)
    );
  }
};

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
      return null;
    }

    const redis =
      getRedis();

    const redisKey =
      `realtime-token:${token}`;

    const stored =
      await redis.get(
        redisKey
      );

    if (!stored) {
      return null;
    }

    /*
     * One-time WebSocket token.
     */
    await redis.del(redisKey);

    return JSON.parse(stored);
  };

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

const handleConnection =
  async ({
    socket,
    auth,
  }) => {
    let gemini = null;
    let closing = false;

    const session =
      await RealtimeSession.findOne({
        _id: auth.sessionId,
        userId: auth.userId,
      });

    if (!session) {
      socket.close(
        4004,
        "Session not found"
      );

      return;
    }

    try {
      session.status =
        "connecting";

      await session.save();

      const twin =
        await Twin.findOne({
          _id: session.twinId,
          userId: auth.userId,
        });

      if (!twin) {
        throw new Error(
          "AI Twin not found."
        );
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

      gemini =
        await createGeminiLiveSession({
          userId:
            auth.userId,

          twin,
          product,

          language:
            session.language,

          onReady: async ({
            sessionId:
              geminiSessionId,
          }) => {
            session.geminiSessionId =
              geminiSessionId;

            session.status =
              "active";

            session.startedAt =
              new Date();

            await session.save();

            sendSocketMessage(
              socket,
              {
                event:
                  "session:ready",

                sessionId:
                  String(
                    session._id
                  ),

                audio: {
                  inputSampleRate:
                    16000,

                  outputSampleRate:
                    24000,

                  channels: 1,

                  encoding:
                    "pcm_s16le",
                },

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

                  voiceName:
                    session.voiceName,

                  language:
                    session.language,
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

                  mimeType:
                    "audio/pcm;rate=24000",

                  sampleRate:
                    24000,
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

          onInterrupted:
            async () => {
              session.status =
                "interrupted";

              await session.save();

              sendSocketMessage(
                socket,
                {
                  event:
                    "conversation:interrupted",
                }
              );
            },

          onTurnComplete:
            async () => {
              if (
                session.status ===
                "interrupted"
              ) {
                session.status =
                  "active";

                await session.save();
              }

              sendSocketMessage(
                socket,
                {
                  event:
                    "conversation:turn-complete",
                }
              );
            },

          onError:
            async (error) => {
              console.error(
                "GEMINI LIVE ERROR:",
                error
              );

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
                    "Gemini Live failed.",
                }
              );
            },

          onClose:
            async ({
              code,
              reason,
            }) => {
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

      socket.on(
        "message",
        async (rawMessage) => {
          try {
            const message =
              JSON.parse(
                rawMessage.toString()
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
                  }
                );

                break;
              }

              case "audio:input": {
                if (
                  !message.audio
                ) {
                  throw new Error(
                    "Audio data is missing."
                  );
                }

                const pcmBuffer =
                  Buffer.from(
                    message.audio,
                    "base64"
                  );

                gemini.sendAudio({
                  buffer:
                    pcmBuffer,

                  mimeType:
                    message.mimeType ||
                    "audio/pcm;rate=16000",
                });

                break;
              }

              case "audio:start": {
                gemini.activityStart();

                break;
              }

              case "audio:end": {
                gemini.activityEnd();

                break;
              }

              case "audio:stream-end": {
                gemini.endAudioStream();

                break;
              }

              case "text:input": {
                gemini.sendText(
                  message.text
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
              "REALTIME MESSAGE ERROR:",
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
            "REALTIME SOCKET ERROR:",
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
        async () => {
          if (closing) {
            console.log(
              "Realtime session closed by client."
            );
          }

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
    } catch (error) {
      console.error(
        "REALTIME SETUP ERROR:",
        error
      );

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
            "Realtime setup failed.",
        }
      );

      socket.close(
        1011,
        "Realtime setup failed"
      );
    }
  };

const createRealtimeSocketServer =
  (httpServer) => {
    const socketServer =
      new WebSocket.Server({
        server: httpServer,

        path: "/realtime",

        maxPayload:
          2 * 1024 * 1024,
      });

    socketServer.on(
      "connection",
      async (
        socket,
        request
      ) => {
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

          await handleConnection({
            socket,
            auth,
          });
        } catch (error) {
          console.error(
            "REALTIME CONNECTION ERROR:",
            error
          );

          sendSocketMessage(
            socket,
            {
              event:
                "session:error",

              message:
                error.message ||
                "Realtime connection failed.",
            }
          );

          socket.close(
            1011,
            "Connection failed"
          );
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