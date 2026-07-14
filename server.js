require("dotenv")
  .config();

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

createRealtimeSocketServer(
  server
);

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
      }

      server.listen(
        PORT,
        () => {
          console.log(
            `Server running on port ${PORT}`
          );

          console.log(
            `Realtime WebSocket available at /ws/realtime`
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

startServer();