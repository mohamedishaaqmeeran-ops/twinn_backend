const {
  WebSocketServer,
} = require("ws");

const url =
  require("url");

const {
  initializeRealtimeSession,
} = require(
  "./realtime.service"
);

const RealtimeSession =
  require(
    "../../models/RealtimeSession"
  );

/* =========================================================
   SAFE SEND
========================================================= */

const safeSend = (
  socket,
  payload
) => {
  if (
    socket.readyState ===
    socket.OPEN
  ) {
    socket.send(
      JSON.stringify(
        payload
      )
    );
  }
};

/* =========================================================
   CREATE REALTIME SOCKET SERVER
========================================================= */

const createRealtimeSocketServer =
  (httpServer) => {
    if (!httpServer) {
      throw new Error(
        "HTTP server is required to create the realtime WebSocket server."
      );
    }

    const webSocketServer =
      new WebSocketServer({
        server:
          httpServer,

        path:
          "/ws/realtime",
      });

    console.log(
      "Realtime WebSocket server initialized at /ws/realtime"
    );

    webSocketServer.on(
      "connection",

      async (
        socket,
        request
      ) => {
        let sessionId =
          null;

        let socketToken =
          null;

        let geminiConnection =
          null;

        try {
          const parsedUrl =
            url.parse(
              request.url,
              true
            );

          sessionId =
            parsedUrl.query
              .sessionId;

          socketToken =
            parsedUrl.query
              .socketToken;

          if (
            !sessionId ||
            !socketToken
          ) {
            safeSend(
              socket,
              {
                type:
                  "session.error",

                message:
                  "Session ID and socket token are required.",
              }
            );

            socket.close(
              1008,
              "Missing session credentials"
            );

            return;
          }

          const result =
            await initializeRealtimeSession({
              sessionId,
              socketToken,
              websocket:
                socket,
            });

          geminiConnection =
            result
              .geminiConnection;

          await RealtimeSession
            .updateOne(
              {
                _id:
                  sessionId,

                socketToken,
              },

              {
                $set: {
                  status:
                    "active",

                  connectedAt:
                    new Date(),
                },
              }
            );

          safeSend(
            socket,
            {
              type:
                "session.ready",

              sessionId,

              twinId:
                result.twin
                  ._id,

              productId:
                result.session
                  .productId,

              productScope:
                result.session
                  .productId
                  ? "selected-product"
                  : "user-catalogue",
            }
          );

          socket.on(
            "message",

            async (
              rawMessage
            ) => {
              try {
                const message =
                  JSON.parse(
                    rawMessage
                      .toString()
                  );

                if (
                  message.type ===
                  "ping"
                ) {
                  safeSend(
                    socket,
                    {
                      type:
                        "pong",
                    }
                  );

                  return;
                }

                if (
                  message.type ===
                    "text" ||
                  message.type ===
                    "user.text"
                ) {
                  const text =
                    String(
                      message.text ||
                        message.message ||
                        ""
                    ).trim();

                  if (!text) {
                    return;
                  }

                  if (
                    typeof geminiConnection
                      ?.sendClientContent ===
                    "function"
                  ) {
                    await geminiConnection
                      .sendClientContent({
                        turns: [
                          {
                            role:
                              "user",

                            parts: [
                              {
                                text,
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
                    typeof geminiConnection
                      ?.send ===
                    "function"
                  ) {
                    await geminiConnection
                      .send({
                        clientContent: {
                          turns: [
                            {
                              role:
                                "user",

                              parts: [
                                {
                                  text,
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
                    "Gemini Live connection does not support text messages."
                  );
                }
              } catch (error) {
                console.error(
                  "REALTIME SOCKET MESSAGE ERROR:",
                  error
                );

                safeSend(
                  socket,
                  {
                    type:
                      "session.error",

                    message:
                      error.message ||
                      "Unable to process realtime message.",
                  }
                );
              }
            }
          );

          socket.on(
            "close",

            async () => {
              console.log(
                "Realtime WebSocket disconnected:",
                sessionId
              );

              try {
                if (
                  typeof geminiConnection
                    ?.close ===
                  "function"
                ) {
                  await geminiConnection
                    .close();
                }
              } catch (
                closeError
              ) {
                console.error(
                  "GEMINI CLOSE ERROR:",
                  closeError
                );
              }

              if (
                sessionId &&
                socketToken
              ) {
                await RealtimeSession
                  .updateOne(
                    {
                      _id:
                        sessionId,

                      socketToken,
                    },

                    {
                      $set: {
                        status:
                          "closed",

                        endedAt:
                          new Date(),
                      },
                    }
                  )
                  .catch(
                    console.error
                  );
              }
            }
          );

          socket.on(
            "error",

            (error) => {
              console.error(
                "REALTIME WEBSOCKET ERROR:",
                error
              );
            }
          );
        } catch (error) {
          console.error(
            "REALTIME CONNECTION ERROR:",
            error
          );

          safeSend(
            socket,
            {
              type:
                "session.error",

              message:
                error.message ||
                "Unable to initialize realtime session.",
            }
          );

          if (
            sessionId &&
            socketToken
          ) {
            await RealtimeSession
              .updateOne(
                {
                  _id:
                    sessionId,

                  socketToken,
                },

                {
                  $set: {
                    status:
                      "failed",
                  },
                }
              )
              .catch(
                console.error
              );
          }

          socket.close(
            1008,
            "Realtime initialization failed"
          );
        }
      }
    );

    webSocketServer.on(
      "error",

      (error) => {
        console.error(
          "REALTIME WEBSOCKET SERVER ERROR:",
          error
        );
      }
    );

    return webSocketServer;
  };

/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  createRealtimeSocketServer,
};