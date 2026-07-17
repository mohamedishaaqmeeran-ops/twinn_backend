const {
  WebSocketServer,
  WebSocket,
} = require("ws");

const {
  URL,
} = require("url");

const RealtimeSession = require(
  "../../models/RealtimeSession"
);

const {
  initializeRealtimeSession,
} = require(
  "./realtime.service"
);

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
   CONFIGURATION
========================================================= */

const REALTIME_PATH =
  "/api/realtime/socket";

const MAX_AUDIO_BASE64_LENGTH =
  Number(
    process.env
      .MAX_REALTIME_AUDIO_BASE64_LENGTH ||
      2_000_000
  );

/* =========================================================
   SAFE SEND
========================================================= */

const safeSend = (
  socket,
  payload
) => {
  if (
    !socket ||
    socket.readyState !==
      WebSocket.OPEN
  ) {
    return false;
  }

  try {
    socket.send(
      JSON.stringify(
        payload
      )
    );

    return true;
  } catch (error) {
    console.error(
      "REALTIME SAFE SEND ERROR:",
      error
    );

    return false;
  }
};

/* =========================================================
   SOCKET EVENT NAME
========================================================= */

const getSocketEvent = (
  message
) => {
  return String(
    message?.event ||
      message?.type ||
      ""
  ).trim();
};

/* =========================================================
   PARSE BROWSER MESSAGE
========================================================= */

const parseBrowserMessage = (
  rawMessage
) => {
  const rawText =
    Buffer.isBuffer(
      rawMessage
    )
      ? rawMessage.toString(
          "utf8"
        )
      : String(
          rawMessage || ""
        );

  if (!rawText.trim()) {
    throw new Error(
      "Empty realtime message received."
    );
  }

  let message;

  try {
    message =
      JSON.parse(
        rawText
      );
  } catch {
    throw new Error(
      "Realtime message must be valid JSON."
    );
  }

  if (
    !message ||
    typeof message !==
      "object" ||
    Array.isArray(message)
  ) {
    throw new Error(
      "Invalid realtime message."
    );
  }

  return message;
};

/* =========================================================
   NORMALIZE AUDIO MIME TYPE
========================================================= */

const normalizeAudioMimeType =
  (
    mimeType
  ) => {
    const normalized =
      String(
        mimeType || ""
      ).trim();

    if (!normalized) {
      return "audio/pcm;rate=16000";
    }

    if (
      !normalized
        .toLowerCase()
        .startsWith(
          "audio/pcm"
        )
    ) {
      throw new Error(
        "Realtime microphone audio must use raw PCM format."
      );
    }

    return normalized;
  };

/* =========================================================
   UPDATE SESSION STATUS
========================================================= */

const updateSessionStatus =
  async ({
    sessionId,
    socketToken,
    status,
    extra = {},
  }) => {
    if (
      !sessionId ||
      !socketToken
    ) {
      return;
    }

    try {
      await RealtimeSession.updateOne(
        {
          _id:
            sessionId,
          socketToken,
        },
        {
          $set: {
            status,
            ...extra,
          },
        }
      );
    } catch (error) {
      console.error(
        "REALTIME SESSION STATUS UPDATE ERROR:",
        error
      );
    }
  };

/* =========================================================
   CLOSE GEMINI SAFELY
========================================================= */

const closeGeminiSafely =
  async (
    geminiSession
  ) => {
    if (!geminiSession) {
      return;
    }

    try {
      await closeGeminiLiveConnection(
        geminiSession
      );
    } catch (error) {
      console.error(
        "GEMINI CLOSE ERROR:",
        error
      );
    }
  };

/* =========================================================
   CREATE REALTIME SOCKET SERVER
========================================================= */

const createRealtimeSocketServer =
  (
    httpServer
  ) => {
    if (!httpServer) {
      throw new Error(
        "HTTP server is required."
      );
    }

    const webSocketServer =
      new WebSocketServer({
        noServer: true,
        clientTracking: true,
        perMessageDeflate: false,
        maxPayload:
          MAX_AUDIO_BASE64_LENGTH +
          100000,
      });


         

    /* =====================================================
       HTTP UPGRADE HANDLER
    ===================================================== */

    httpServer.on(
      "upgrade",
      async (
        request,
        networkSocket,
        head
      ) => {
        try {
          const host =
            request.headers.host ||
            "localhost";

          const requestUrl =
            new URL(
              request.url,
              `http://${host}`
            );

          if (
            requestUrl.pathname !==
            REALTIME_PATH
          ) {
            networkSocket.write(
              "HTTP/1.1 404 Not Found\r\n\r\n"
            );

            networkSocket.destroy();

            return;
          }

          const sessionId =
            requestUrl.searchParams.get(
              "sessionId"
            );

          const socketToken =
            requestUrl.searchParams.get(
              "socketToken"
            ) ||
            requestUrl.searchParams.get(
              "token"
            );

          if (
            !sessionId ||
            !socketToken
          ) {
            networkSocket.write(
              "HTTP/1.1 401 Unauthorized\r\n" +
              "Connection: close\r\n" +
              "\r\n"
            );

            networkSocket.destroy();

            return;
          }

          /*
           * Validate the session before upgrading.
           * This prevents invalid socket requests
           * from becoming full WebSocket connections.
           */

          const session =
            await RealtimeSession.findOne({
              _id: sessionId,
              socketToken,
            })
              .select(
                "_id userId twinId productId status expiresAt socketToken"
              )
              .lean();

          if (!session) {
            networkSocket.write(
              "HTTP/1.1 401 Unauthorized\r\n" +
              "Connection: close\r\n" +
              "\r\n"
            );

            networkSocket.destroy();

            return;
          }

          if (
            session.expiresAt &&
            new Date(
              session.expiresAt
            ).getTime() <
              Date.now()
          ) {
            networkSocket.write(
              "HTTP/1.1 401 Unauthorized\r\n" +
              "Connection: close\r\n" +
              "\r\n"
            );

            networkSocket.destroy();

            return;
          }

          if (
            [
              "closed",
              "ended",
              "failed",
            ].includes(
              String(
                session.status ||
                  ""
              ).toLowerCase()
            )
          ) {
            networkSocket.write(
              "HTTP/1.1 409 Conflict\r\n" +
              "Connection: close\r\n" +
              "\r\n"
            );

            networkSocket.destroy();

            return;
          }

          request.realtimeSession =
            session;

          webSocketServer.handleUpgrade(
            request,
            networkSocket,
            head,
            (
              browserSocket
            ) => {
              webSocketServer.emit(
                "connection",
                browserSocket,
                request
              );
            }
          );
        } catch (error) {
          console.error(
            "REALTIME UPGRADE ERROR:",
            {
              message:
                error?.message,
              stack:
                error?.stack,
            }
          );

          try {
            networkSocket.write(
              "HTTP/1.1 500 Internal Server Error\r\n" +
              "Connection: close\r\n" +
              "\r\n"
            );
          } catch {
            // Ignore network write errors.
          }

          networkSocket.destroy();
        }
      }
    );

    /* =====================================================
       BROWSER CONNECTION
    ===================================================== */

    webSocketServer.on(
      "connection",
      async (
        browserSocket,
        request
      ) => {
        let sessionId =
          null;

        let socketToken =
          null;

        let geminiSession =
          null;

        let sessionClosed =
          false;

        let microphoneActive =
          false;

        /*
         * Ensures realtime events are processed
         * in the order they are received.
         */
        let messageQueue =
          Promise.resolve();

        try {
          const host =
            request.headers.host ||
            "localhost";

          const requestUrl =
            new URL(
              request.url,
              `http://${host}`
            );

          sessionId =
            requestUrl.searchParams.get(
              "sessionId"
            );

          socketToken =
            requestUrl.searchParams.get(
              "socketToken"
            ) ||
            requestUrl.searchParams.get(
              "token"
            );

          if (!sessionId) {
            throw new Error(
              "Realtime session ID is required."
            );
          }

          if (!socketToken) {
            throw new Error(
              "Realtime socket token is required."
            );
          }

          console.log(
            "REALTIME BROWSER CONNECTED:",
            {
              sessionId,
            }
          );

          safeSend(
            browserSocket,
            {
              type:
                "socket:connected",

              event:
                "socket:connected",

              sessionId,

              timestamp:
                Date.now(),
            }
          );

          /*
           * This service must validate:
           *
           * - session
           * - socket token
           * - expiry
           * - authenticated user
           * - selected Twin
           * - selected product
           *
           * It must also create
           * the Gemini Live connection.
           */

          const result =
            await initializeRealtimeSession({
              sessionId,
              socketToken,
              websocket:
                browserSocket,
            });

          geminiSession =
            result
              ?.geminiConnection;

          if (!geminiSession) {
            throw new Error(
              "Gemini Live session was not created."
            );
          }

          await updateSessionStatus({
            sessionId,
            socketToken,

            status:
              "active",

            extra: {
              connectedAt:
                new Date(),
            },
          });

          safeSend(
            browserSocket,
            {
              type:
                "session:ready",

              event:
                "session:ready",

              sessionId,

              twinId:
                result?.twin
                  ?._id ||
                result?.session
                  ?.twinId,

              productId:
                result?.session
                  ?.productId ||
                null,

              language:
                result?.session
                  ?.language ||
                "English",

              productScope:
                result?.session
                  ?.productId
                  ? "selected-product"
                  : "user-products",
            }
          );

          console.log(
            "REALTIME SESSION READY:",
            {
              sessionId,

              twinId:
                result?.twin
                  ?._id ||
                result?.session
                  ?.twinId,

              productId:
                result?.session
                  ?.productId ||
                null,
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
              messageQueue =
                messageQueue
                  .then(
                    async () => {
                      if (
                        browserSocket
                          .readyState !==
                        WebSocket.OPEN
                      ) {
                        return;
                      }

                      const message =
                        parseBrowserMessage(
                          rawMessage
                        );

                      const eventName =
                        getSocketEvent(
                          message
                        );

                      if (!eventName) {
                        throw new Error(
                          "Realtime event name is required."
                        );
                      }

                      switch (
                        eventName
                      ) {
                        /* ===============================
                           PING
                        =============================== */

                        case "ping": {
                          safeSend(
                            browserSocket,
                            {
                              type:
                                "pong",

                              event:
                                "pong",

                              timestamp:
                                Date.now(),
                            }
                          );

                          break;
                        }

                        /* ===============================
                           TEXT INPUT
                        =============================== */

                        case "conversation:text":
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
                            throw new Error(
                              "Text input cannot be empty."
                            );
                          }

                          if (
                            text.length >
                            10_000
                          ) {
                            throw new Error(
                              "Text input is too long."
                            );
                          }

                          console.log(
                            "REALTIME TEXT INPUT:",
                            {
                              sessionId,
                              textLength:
                                text.length,
                            }
                          );

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
                          if (
                            microphoneActive
                          ) {
                            break;
                          }

                          microphoneActive =
                            true;

                          console.log(
                            "MICROPHONE AUDIO START:",
                            {
                              sessionId,
                            }
                          );

                          await startGeminiAudioActivity(
                            geminiSession
                          );

                          break;
                        }

                        /* ===============================
                           PCM AUDIO INPUT
                        =============================== */

                        case "audio:input": {
                          const audio =
                            String(
                              message.audio ||
                                message.data ||
                                ""
                            ).trim();

                          if (!audio) {
                            break;
                          }

                          if (
                            audio.length >
                            MAX_AUDIO_BASE64_LENGTH
                          ) {
                            throw new Error(
                              "Microphone audio chunk is too large."
                            );
                          }

                          const mimeType =
                            normalizeAudioMimeType(
                              message.mimeType ||
                                message
                                  .mime_type
                            );

                          /*
                           * If audio:start was not received,
                           * start the audio activity automatically.
                           */

                          if (
                            !microphoneActive
                          ) {
                            microphoneActive =
                              true;

                            await startGeminiAudioActivity(
                              geminiSession
                            );
                          }

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
                          if (
                            !microphoneActive
                          ) {
                            break;
                          }

                          microphoneActive =
                            false;

                          console.log(
                            "MICROPHONE AUDIO END:",
                            {
                              sessionId,
                            }
                          );

                          await endGeminiAudioActivity(
                            geminiSession
                          );

                          break;
                        }

                        /* ===============================
                           CONVERSATION INTERRUPT
                        =============================== */

                        case "conversation:interrupt": {
                          console.log(
                            "CONVERSATION INTERRUPT:",
                            {
                              sessionId,
                            }
                          );

                          /*
                           * Gemini Live normally handles
                           * interruption automatically when
                           * new user audio arrives.
                           *
                           * This message immediately updates
                           * the browser state.
                           */

                          safeSend(
                            browserSocket,
                            {
                              type:
                                "conversation:interrupted",

                              event:
                                "conversation:interrupted",

                              sessionId,

                              timestamp:
                                Date.now(),
                            }
                          );

                          break;
                        }

                        /* ===============================
                           STOP SESSION
                        =============================== */

                        case "session:stop":
                        case "session:end": {
                          if (
                            sessionClosed
                          ) {
                            break;
                          }

                          sessionClosed =
                            true;

                          microphoneActive =
                            false;

                          console.log(
                            "REALTIME SESSION STOP:",
                            {
                              sessionId,
                            }
                          );

                          if (
                            geminiSession
                          ) {
                            await closeGeminiSafely(
                              geminiSession
                            );

                            geminiSession =
                              null;
                          }

                          await updateSessionStatus({
                            sessionId,
                            socketToken,

                            status:
                              "closed",

                            extra: {
                              endedAt:
                                new Date(),
                            },
                          });

                          safeSend(
                            browserSocket,
                            {
                              type:
                                "session:closed",

                              event:
                                "session:closed",

                              sessionId,
                            }
                          );

                          if (
                            browserSocket
                              .readyState ===
                            WebSocket.OPEN
                          ) {
                            browserSocket.close(
                              1000,
                              "Session ended"
                            );
                          }

                          break;
                        }

                        /* ===============================
                           UNKNOWN EVENT
                        =============================== */

                        default: {
                          console.warn(
                            "UNHANDLED REALTIME EVENT:",
                            {
                              sessionId,
                              eventName,
                            }
                          );

                          safeSend(
                            browserSocket,
                            {
                              type:
                                "event:unsupported",

                              event:
                                "event:unsupported",

                              receivedEvent:
                                eventName,

                              message:
                                `Unsupported realtime event: ${eventName}`,
                            }
                          );
                        }
                      }
                    }
                  )
                  .catch(
                    (
                      error
                    ) => {
                      console.error(
                        "REALTIME MESSAGE ERROR:",
                        {
                          sessionId,

                          message:
                            error
                              ?.message,

                          stack:
                            error
                              ?.stack,
                        }
                      );

                      safeSend(
                        browserSocket,
                        {
                          type:
                            "session:error",

                          event:
                            "session:error",

                          message:
                            error
                              ?.message ||
                            "Unable to process realtime input.",

                          sessionId,
                        }
                      );
                    }
                  );
            }
          );


                    /* =================================================
             BROWSER CLOSE
          ================================================= */

          browserSocket.on(
            "close",
            async (
              code,
              reason
            ) => {
              const reasonText =
                reason
                  ?.toString() ||
                "";

              console.log(
                "BROWSER SOCKET CLOSED:",
                {
                  sessionId,
                  code,
                  reason:
                    reasonText,
                }
              );

              microphoneActive =
                false;

              /*
               * Wait until queued realtime
               * operations finish.
               */
              try {
                await messageQueue;
              } catch {
                // Queue errors were already handled.
              }

              if (
                sessionClosed
              ) {
                return;
              }

              sessionClosed =
                true;

              if (
                geminiSession
              ) {
                await closeGeminiSafely(
                  geminiSession
                );

                geminiSession =
                  null;
              }

              await updateSessionStatus({
                sessionId,
                socketToken,

                status:
                  "closed",

                extra: {
                  endedAt:
                    new Date(),

                  closeCode:
                    code,

                  closeReason:
                    reasonText,
                },
              });
            }
          );

          /* =================================================
             BROWSER ERROR
          ================================================= */

          browserSocket.on(
            "error",
            (
              error
            ) => {
              console.error(
                "BROWSER SOCKET ERROR:",
                {
                  sessionId,

                  message:
                    error
                      ?.message,

                  stack:
                    error
                      ?.stack,
                }
              );
            }
          );
        } catch (
          error
        ) {
          console.error(
            "REALTIME CONNECTION ERROR:",
            {
              sessionId,

              message:
                error
                  ?.message,

              stack:
                error
                  ?.stack,
            }
          );

          safeSend(
            browserSocket,
            {
              type:
                "session:error",

              event:
                "session:error",

              sessionId,

              message:
                error
                  ?.message ||
                "Unable to initialise realtime session.",
            }
          );

          if (
            geminiSession
          ) {
            await closeGeminiSafely(
              geminiSession
            );

            geminiSession =
              null;
          }

          await updateSessionStatus({
            sessionId,
            socketToken,

            status:
              "failed",

            extra: {
              endedAt:
                new Date(),

              failureReason:
                error
                  ?.message ||
                "Realtime initialization failed.",
            },
          });

          if (
            browserSocket
              .readyState ===
              WebSocket.OPEN ||
            browserSocket
              .readyState ===
              WebSocket.CONNECTING
          ) {
            browserSocket.close(
              1008,
              "Realtime initialization failed"
            );
          }
        }
      }
    );

    /* =====================================================
       WEBSOCKET SERVER ERROR
    ===================================================== */

    webSocketServer.on(
      "error",
      (
        error
      ) => {
        console.error(
          "REALTIME WEBSOCKET SERVER ERROR:",
          {
            message:
              error
                ?.message,

            stack:
              error
                ?.stack,
          }
        );
      }
    );

    /* =====================================================
       WEBSOCKET SERVER CLOSE
    ===================================================== */

    webSocketServer.on(
      "close",
      () => {
        console.log(
          "Realtime WebSocket server closed."
        );
      }
    );

    console.log(
      `Realtime WebSocket initialized: ${REALTIME_PATH}`
    );

    return webSocketServer;
  };

/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  createRealtimeSocketServer,
};