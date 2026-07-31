// server.js

require("dotenv").config();

const http = require("http");
const mongoose = require("mongoose");
const { execFile } = require("child_process");

const app = require("./src/app");
const connectDB = require("./src/config/db");

const {
  createRealtimeSocketServer,
} = require(
  "./src/modules/realtime/realtime.websocket"
);

/* =========================================================
   CONFIGURATION
========================================================= */

const PORT =
  Number(process.env.PORT) ||
  8000;

const HOST =
  process.env.HOST ||
  "0.0.0.0";

const FFMPEG_PATH =
  process.env.FFMPEG_PATH ||
  "/usr/bin/ffmpeg";

const REQUIRE_FFMPEG =
  String(
    process.env.REQUIRE_FFMPEG ||
      "false"
  ).toLowerCase() === "true";

/* =========================================================
   RUNTIME STATE
========================================================= */

let server = null;
let realtimeSocketServer = null;
let isShuttingDown = false;

/* =========================================================
   DATABASE CONNECTION
========================================================= */

const initializeDatabase =
  async () => {
    if (
      typeof connectDB ===
      "function"
    ) {
      await connectDB();
      return;
    }

    if (
      typeof connectDB?.connect ===
      "function"
    ) {
      await connectDB.connect();
      return;
    }

    throw new Error(
      "Invalid database connection module. Export a function or an object with connect()."
    );
  };

/* =========================================================
   VERIFY FFMPEG
========================================================= */

const verifyFfmpeg =
  () =>
    new Promise(
      (
        resolve,
        reject
      ) => {
        execFile(
          FFMPEG_PATH,
          ["-version"],
          {
            timeout: 10000,
          },
          (
            error,
            stdout,
            stderr
          ) => {
            if (error) {
              const message =
                `FFmpeg is unavailable at ${FFMPEG_PATH}: ${error.message}`;

              if (
                REQUIRE_FFMPEG
              ) {
                return reject(
                  new Error(
                    message
                  )
                );
              }

              console.warn(
                "FFMPEG WARNING:",
                message
              );

              console.warn(
                "Live streaming features requiring FFmpeg may not work."
              );

              return resolve(
                false
              );
            }

            const versionOutput =
              String(
                stdout ||
                  stderr ||
                  ""
              )
                .split("\n")
                .slice(0, 2)
                .join("\n");

            console.log(
              `FFmpeg executable: ${FFMPEG_PATH}`
            );

            if (
              versionOutput
            ) {
              console.log(
                versionOutput
              );
            }

            return resolve(
              true
            );
          }
        );
      }
    );

/* =========================================================
   CLOSE WEBSOCKET CLIENTS
========================================================= */

const closeWebSocketClients =
  () => {
    if (
      !realtimeSocketServer
    ) {
      return;
    }

    realtimeSocketServer
      .clients
      ?.forEach(
        (client) => {
          try {
            client.close(
              1001,
              "Server shutting down"
            );
          } catch (
            error
          ) {
            console.error(
              "WEBSOCKET CLIENT CLOSE ERROR:",
              error.message
            );
          }
        }
      );
  };

/* =========================================================
   CLOSE HTTP SERVER
========================================================= */

const closeHttpServer =
  () =>
    new Promise(
      (resolve) => {
        if (
          !server ||
          !server.listening
        ) {
          return resolve();
        }

        server.close(
          (error) => {
            if (error) {
              console.error(
                "HTTP SERVER CLOSE ERROR:",
                error.message
              );
            } else {
              console.log(
                "HTTP server closed."
              );
            }

            resolve();
          }
        );
      }
    );

/* =========================================================
   CLOSE DATABASE
========================================================= */

const closeDatabase =
  async () => {
    try {
      if (
        mongoose.connection
          .readyState !== 0
      ) {
        await mongoose.connection.close();

        console.log(
          "MongoDB connection closed."
        );
      }
    } catch (
      error
    ) {
      console.error(
        "DATABASE CLOSE ERROR:",
        error.message
      );
    }
  };

/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

const shutdown =
  async (
    signal,
    exitCode = 0
  ) => {
    if (
      isShuttingDown
    ) {
      return;
    }

    isShuttingDown =
      true;

    console.log(
      `${signal} received. Closing server...`
    );

    const forceExitTimer =
      setTimeout(
        () => {
          console.error(
            "Forced shutdown after timeout."
          );

          process.exit(1);
        },
        10000
      );

    forceExitTimer.unref();

    try {
      closeWebSocketClients();

      await closeHttpServer();
      await closeDatabase();

      clearTimeout(
        forceExitTimer
      );

      process.exit(
        exitCode
      );
    } catch (
      error
    ) {
      console.error(
        "SHUTDOWN ERROR:",
        error
      );

      clearTimeout(
        forceExitTimer
      );

      process.exit(1);
    }
  };

/* =========================================================
   START SERVER
========================================================= */

const startServer =
  async () => {
    try {
      await initializeDatabase();

      await verifyFfmpeg();

      server =
        http.createServer(
          app
        );

      realtimeSocketServer =
        createRealtimeSocketServer(
          server
        );

      server.on(
        "error",
        (error) => {
          console.error(
            "HTTP SERVER ERROR:",
            error
          );
        }
      );

      server.listen(
        PORT,
        HOST,
        () => {
          console.log(
            `Twinn backend running on http://${HOST}:${PORT}`
          );

          console.log(
            "REST API available at /api"
          );

          console.log(
            "Realtime WebSocket available at /api/realtime/socket"
          );
        }
      );
    } catch (
      error
    ) {
      console.error(
        "SERVER START ERROR:",
        error
      );

      await closeDatabase();

      process.exit(1);
    }
  };

/* =========================================================
   PROCESS EVENTS
========================================================= */

process.on(
  "SIGTERM",
  () =>
    shutdown(
      "SIGTERM"
    )
);

process.on(
  "SIGINT",
  () =>
    shutdown(
      "SIGINT"
    )
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "UNCAUGHT EXCEPTION:",
      error
    );

    shutdown(
      "UNCAUGHT_EXCEPTION",
      1
    );
  }
);

process.on(
  "unhandledRejection",
  (reason) => {
    console.error(
      "UNHANDLED REJECTION:",
      reason
    );

    shutdown(
      "UNHANDLED_REJECTION",
      1
    );
  }
);

/* =========================================================
   BOOT
========================================================= */

startServer();