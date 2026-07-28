require("dotenv")
  .config();
const {
  execFile,
} = require(
  "child_process"
);
const http =
  require("http");

const app =
  require("./src/app");

const connectDB =
  require(
    "./src/config/db"
  );

const {
  createRealtimeSocketServer,
} = require(
  "./src/modules/realtime/realtime.websocket"
);

const PORT =
  process.env.PORT ||
  8000;

/* =========================================================
   CREATE HTTP SERVER
========================================================= */

const server =
  http.createServer(
    app
  );

/* =========================================================
   CREATE WEBSOCKET SERVER
========================================================= */

const realtimeSocketServer =
  createRealtimeSocketServer(
    server
  );



  /* =========================================================
   VERIFY FFMPEG
========================================================= */

const verifyFfmpeg =
  () => {
    return new Promise(
      (
        resolve,
        reject
      ) => {
        const ffmpegPath =
          process.env
            .FFMPEG_PATH ||
          "/usr/bin/ffmpeg";

        execFile(
          ffmpegPath,
          [
            "-version",
          ],
          (
            error,
            stdout,
            stderr
          ) => {
            if (error) {
              console.error(
                "FFMPEG CHECK ERROR:",
                error.message
              );

              reject(
                new Error(
                  `FFmpeg is unavailable at ${ffmpegPath}`
                )
              );

              return;
            }

            console.log(
              `FFmpeg executable: ${ffmpegPath}`
            );

            console.log(
              (
                stdout ||
                stderr ||
                ""
              )
                .split("\n")
                .slice(0, 3)
                .join("\n")
            );

            resolve();
          }
        );
      }
    );
  };
/* =========================================================
   START SERVER
========================================================= */

const startServer =
  async () => {
    try {
      if (
        typeof connectDB ===
        "function"
      ) {
        await connectDB();
      } else if (
        typeof connectDB
          ?.connect ===
        "function"
      ) {
        await connectDB
          .connect();
      } else {
        throw new Error(
          "Invalid database connection module."
        );
      }
await verifyFfmpeg();
      server.listen(
        PORT,
        "0.0.0.0",
        () => {
          console.log(
            `Server running on port ${PORT}`
          );

          console.log(
            "Realtime WebSocket available at /api/realtime/socket"
          );
        }
      );
    } catch (error) {
      console.error(
        "SERVER START ERROR:",
        error
      );

      process.exit(1);
    }
  };

/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

const shutdown =
  (
    signal
  ) => {
    console.log(
      `${signal} received. Closing server...`
    );

    realtimeSocketServer
      ?.clients
      ?.forEach(
        (
          client
        ) => {
          try {
            client.close(
              1001,
              "Server shutting down"
            );
          } catch {
            // Ignore close error.
          }
        }
      );

    server.close(
      () => {
        console.log(
          "HTTP server closed."
        );

        process.exit(0);
      }
    );

    setTimeout(
      () => {
        console.error(
          "Forced shutdown."
        );

        process.exit(1);
      },
      10000
    ).unref();
  };

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

startServer();