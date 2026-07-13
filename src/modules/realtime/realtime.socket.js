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

const authenticateSocket = async (
  request
) => {
  const baseUrl =
    process.env.PUBLIC_API_URL ||
    "http://localhost:8000";

  const requestUrl = new URL(
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

  const redis = getRedis();

  const redisKey =
    `realtime-token:${token}`;

  const storedSession =
    await redis.get(redisKey);

  if (!storedSession) {
    return null;
  }

  /*
   * One-time token. Delete it after
   * successful WebSocket authentication.
   */
  await redis.del(redisKey);

  return JSON.parse(
    storedSession
  );
};

const handleRealtimeConnection =
  async ({
    socket,
    auth,
  }) => {
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
          _id: session.productId,
          userId: auth.userId,
        });
    }

    session.status =
      "active";

    session.startedAt =
      session.startedAt ||
      new Date();

    await session.save();

    sendSocketMessage(
      socket,
      {
        event:
          "session:ready",

        sessionId:
          String(session._id),

        twin: {
          id:
            String(twin._id),

          name:
            twin.name,

          image:
            twin.appearance
              ?.avatarUrl ||
            twin.image ||
            "",

          voice:
            twin.voice
              ?.voiceType ||
            twin.voiceName ||
            "Warm Female",
        },

        product: product
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

            case "text:input": {
              /*
               * Gemini Live integration
               * will be added here.
               */

              sendSocketMessage(
                socket,
                {
                  event:
                    "text:received",

                  text:
                    String(
                      message.text ||
                        ""
                    ),
                }
              );

              break;
            }

            case "audio:input": {
              /*
               * Microphone PCM forwarding
               * to Gemini Live will be
               * added here.
               */

              sendSocketMessage(
                socket,
                {
                  event:
                    "audio:received",
                }
              );

              break;
            }

            case "session:stop": {
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
            _id: session._id,
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
        await RealtimeSession.updateOne(
          {
            _id: session._id,
          },
          {
            status: "ended",
            endedAt:
              new Date(),
          }
        );
      }
    );
  };

const createRealtimeSocketServer =
  (httpServer) => {
    const socketServer =
      new WebSocket.Server({
        server: httpServer,

        path: "/realtime",
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

          await handleRealtimeConnection({
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