
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
  "/ws/realtime";

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

const normalizeAudioMimeType = (
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

    await RealtimeSession
      .updateOne(
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
      )
      .catch(
        (error) => {
          console.error(
            "REALTIME SESSION STATUS UPDATE ERROR:",
            error
          );
        }
      );
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

const createRealtimeSocketServer = (
  httpServer
) => {
  if (!httpServer) {
    throw new Error(
      "HTTP server is required to initialise realtime WebSocket."
    );
  }

  const webSocketServer =
    new WebSocketServer({
      noServer: true,

      clientTracking:
        true,

      perMessageDeflate:
        false,

      maxPayload:
        MAX_AUDIO_BASE64_LENGTH +
        100_000,
    });

  /* =======================================================
     HTTP UPGRADE
  ======================================================= */

  httpServer.on(
    "upgrade",
    (
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
          networkSocket.destroy();

          return;
        }

        webSocketServer
          .handleUpgrade(
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
          error
        );

        networkSocket.destroy();
      }
    }
  );

  /* =======================================================
     BROWSER CONNECTION
  ======================================================= */

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
       * Maintains order of audio:start,
       * audio chunks and audio:end.
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
          "REALTIME BROWSER CONNECTING:",
          {
            sessionId,
          }
        );

        /*
         * This must validate:
         *
         * sessionId
         * socketToken
         * expiresAt
         * authenticated user
         * selected Twin
         * selected product
         *
         * It also creates Gemini Live.
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
              "session.ready",

            event:
              "session.ready",

            sessionId,

            twinId:
              result?.twin
                ?._id ||
              result?.session
                ?.twinId,

            productId:
              result?.session
                ?.productId,

            language:
              result?.session
                ?.language,

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
                ?._id,

            productId:
              result?.session
                ?.productId,
          }
        );

        /* =================================================
           BROWSER MESSAGE
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
                          sessionId
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
                            message.mimeType
                          );

                        /*
                         * Allow the first chunk to
                         * activate the stream even if
                         * audio:start was missed.
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
                        console.log(
                          "CONVERSATION INTERRUPT:",
                          sessionId
                        );

                        /*
                         * Gemini automatic VAD handles
                         * actual model interruption when
                         * microphone audio arrives.
                         *
                         * This event immediately updates
                         * the browser UI.
                         */
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
                          sessionId
                        );

                        await closeGeminiSafely(
                          geminiSession
                        );

                        geminiSession =
                          null;

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
                              "event.unsupported",

                            event:
                              "event.unsupported",

                            receivedEvent:
                              eventName,
                          }
                        );
                      }
                    }
                  }
                )
                .catch(
                  (error) => {
                    console.error(
                      "REALTIME MESSAGE ERROR:",
                      {
                        sessionId,

                        message:
                          error?.message,

                        stack:
                          error?.stack,
                      }
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
           BROWSER CLOSE
        ================================================= */

        browserSocket.on(
          "close",
          async (
            code,
            reason
          ) => {
            const reasonText =
              reason?.toString() ||
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
             * Wait for currently queued
             * audio operation to settle.
             */
            try {
              await messageQueue;
            } catch {
              // Queue errors were already reported.
            }

            if (
              !sessionClosed
            ) {
              sessionClosed =
                true;

              await closeGeminiSafely(
                geminiSession
              );

              geminiSession =
                null;

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
                  error?.message,
              }
            );
          }
        );
      } catch (error) {
        console.error(
          "REALTIME CONNECTION ERROR:",
          {
            sessionId,

            message:
              error?.message,

            stack:
              error?.stack,
          }
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

        await closeGeminiSafely(
          geminiSession
        );

        geminiSession =
          null;

        await updateSessionStatus({
          sessionId,
          socketToken,

          status:
            "failed",

          extra: {
            endedAt:
              new Date(),

            failureReason:
              error?.message ||
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

  /* =======================================================
     SERVER ERROR
  ======================================================= */

  webSocketServer.on(
    "error",
    (
      error
    ) => {
      console.error(
        "REALTIME WEBSOCKET SERVER ERROR:",
        error
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
