const {
  WebSocketServer,
} = require("ws");

const {
  URL,
} = require("url");

const RealtimeSession = require(
  "../../models/RealtimeSession"
);

const {
  initializeRealtimeSession,
} = require("./realtime.service");

const {
  sendTextToGeminiLive,
  sendAudioToGeminiLive,
  startGeminiAudioActivity,
  endGeminiAudioActivity,
  closeGeminiLiveConnection,
} = require(
  "./geminiLive.service"
);

/* =========================================================
   SAFE SEND
========================================================= */

const safeSend = (
  socket,
  payload
) => {
  if (
    socket &&
    socket.readyState === 1
  ) {
    socket.send(
      JSON.stringify(payload)
    );
  }
};

/* =========================================================
   NORMALIZE EVENT NAME
========================================================= */

const getSocketEvent = (
  message
) => {
  return (
    message?.event ||
    message?.type ||
    ""
  );
};

/* =========================================================
   CREATE REALTIME SOCKET SERVER
========================================================= */

const createRealtimeSocketServer = (
  httpServer
) => {
  if (!httpServer) {
    throw new Error(
      "HTTP server is required."
    );
  }

  /*
   * noServer mode avoids path and upgrade
   * conflicts with Express/Render.
   */
  const webSocketServer =
    new WebSocketServer({
      noServer: true,
    });

  httpServer.on(
    "upgrade",
    (
      request,
      socket,
      head
    ) => {
      try {
        const requestUrl =
          new URL(
            request.url,
            `http://${request.headers.host}`
          );

        if (
          requestUrl.pathname !==
          "/ws/realtime"
        ) {
          socket.destroy();
          return;
        }

        webSocketServer
          .handleUpgrade(
            request,
            socket,
            head,
            (websocket) => {
              webSocketServer.emit(
                "connection",
                websocket,
                request
              );
            }
          );
      } catch (error) {
        console.error(
          "WEBSOCKET UPGRADE ERROR:",
          error
        );

        socket.destroy();
      }
    }
  );

  webSocketServer.on(
    "connection",
    async (
      browserSocket,
      request
    ) => {
      let sessionId = null;
      let socketToken = null;
      let geminiSession = null;
      let sessionClosed = false;

      /*
       * Prevent overlapping async audio sends.
       */
      let audioSendQueue =
        Promise.resolve();

      try {
        const requestUrl =
          new URL(
            request.url,
            `http://${request.headers.host}`
          );

        sessionId =
          requestUrl.searchParams.get(
            "sessionId"
          );

        socketToken =
          requestUrl.searchParams.get(
            "socketToken"
          );

        if (
          !sessionId ||
          !socketToken
        ) {
          throw new Error(
            "Session ID and socket token are required."
          );
        }

        /*
         * Validate and initialise:
         * user + Twin + product + Gemini.
         */
        const result =
          await initializeRealtimeSession({
            sessionId,
            socketToken,
            websocket:
              browserSocket,
          });

        geminiSession =
          result.geminiConnection;

        if (!geminiSession) {
          throw new Error(
            "Gemini Live session was not created."
          );
        }

        await RealtimeSession.updateOne(
          {
            _id:
              sessionId,

            socketToken,

            expiresAt: {
              $gt: new Date(),
            },
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
          browserSocket,
          {
            type:
              "session.ready",

            event:
              "session.ready",

            sessionId,

            twinId:
              result.twin?._id,

            productId:
              result.session
                ?.productId,
          }
        );

        /* =================================================
           BROWSER MESSAGE HANDLER
        ================================================= */

        browserSocket.on(
          "message",
          (
            rawMessage
          ) => {
            /*
             * Queue messages so PCM chunks remain
             * in the correct order.
             */
            audioSendQueue =
              audioSendQueue
                .then(
                  async () => {
                    const message =
                      JSON.parse(
                        rawMessage.toString()
                      );

                    const eventName =
                      getSocketEvent(
                        message
                      );

                    switch (
                      eventName
                    ) {
                      /* ===============================
                         CONNECTION PING
                      =============================== */

                      case "ping": {
                        safeSend(
                          browserSocket,
                          {
                            type:
                              "pong",

                            event:
                              "pong",
                          }
                        );

                        break;
                      }

                      /* ===============================
                         TEXT INPUT
                      =============================== */

                      case "text":
                      case "text:input":
                      case "user.text": {
                        const text =
                          String(
                            message.text ||
                              message.message ||
                              ""
                          ).trim();

                        if (!text) {
                          break;
                        }

                        await sendTextToGeminiLive({
                          liveSession:
                            geminiSession,

                          text,
                        });

                        break;
                      }

                      /* ===============================
                         MICROPHONE START
                      =============================== */

                      case "audio:start": {
                        console.log(
                          "MICROPHONE AUDIO START:",
                          sessionId
                        );

                        await startGeminiAudioActivity(
                          geminiSession
                        );

                        break;
                      }

                      /* ===============================
                         MICROPHONE PCM CHUNK
                      =============================== */

                      case "audio:input": {
                        const audio =
                          message.audio;

                        if (!audio) {
                          break;
                        }

                        const mimeType =
                          message.mimeType ||
                          "audio/pcm;rate=16000";

                        await sendAudioToGeminiLive({
                          liveSession:
                            geminiSession,

                          audio,

                          mimeType,
                        });

                        break;
                      }

                      /* ===============================
                         MICROPHONE END
                      =============================== */

                      case "audio:end": {
                        console.log(
                          "MICROPHONE AUDIO END:",
                          sessionId
                        );

                        await endGeminiAudioActivity(
                          geminiSession
                        );

                        break;
                      }

                      /* ===============================
                         INTERRUPT
                      =============================== */

                      case "conversation:interrupt": {
                        safeSend(
                          browserSocket,
                          {
                            type:
                              "conversation.interrupted",

                            event:
                              "conversation:interrupted",
                          }
                        );

                        break;
                      }

                      /* ===============================
                         STOP SESSION
                      =============================== */

                      case "session:stop": {
                        sessionClosed =
                          true;

                        await closeGeminiLiveConnection(
                          geminiSession
                        );

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
                          );

                        browserSocket.close(
                          1000,
                          "Session ended"
                        );

                        break;
                      }

                      default: {
                        console.log(
                          "UNHANDLED BROWSER EVENT:",
                          eventName
                        );
                      }
                    }
                  }
                )
                .catch(
                  (error) => {
                    console.error(
                      "REALTIME MESSAGE ERROR:",
                      error
                    );

                    safeSend(
                      browserSocket,
                      {
                        type:
                          "session.error",

                        event:
                          "session:error",

                        message:
                          error?.message ||
                          "Unable to process realtime input.",
                      }
                    );
                  }
                );
          }
        );

        /* =================================================
           SOCKET CLOSE
        ================================================= */

        browserSocket.on(
          "close",
          async (
            code,
            reason
          ) => {
            console.log(
              "BROWSER SOCKET CLOSED:",
              {
                sessionId,
                code,
                reason:
                  reason?.toString(),
              }
            );

            if (
              !sessionClosed
            ) {
              try {
                await closeGeminiLiveConnection(
                  geminiSession
                );
              } catch (
                error
              ) {
                console.error(
                  "GEMINI CLOSE ERROR:",
                  error
                );
              }

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

        browserSocket.on(
          "error",
          (error) => {
            console.error(
              "BROWSER SOCKET ERROR:",
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
          browserSocket,
          {
            type:
              "session.error",

            event:
              "session:error",

            message:
              error?.message ||
              "Unable to initialise realtime session.",
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

                  endedAt:
                    new Date(),
                },
              }
            )
            .catch(
              console.error
            );
        }

        browserSocket.close(
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
        "REALTIME SOCKET SERVER ERROR:",
        error
      );
    }
  );

  console.log(
    "Realtime WebSocket initialized: /ws/realtime"
  );

  return webSocketServer;
};

module.exports = {
  createRealtimeSocketServer,
};