require("dotenv").config();

const http = require("http");

const app = require(
  "./src/app"
);

const {
  connectRedis,
  closeRedis,
} = require(
  "./src/config/redis"
);

const {
  createRealtimeSocketServer,
} = require(
  "./src/modules/realtime/realtime.socket"
);

const PORT =
  Number(
    process.env.PORT
  ) || 8000;

const server =
  http.createServer(app);

createRealtimeSocketServer(
  server
);

const startServer =
  async () => {
    try {
      /*
       * MongoDB is already connected
       * from your existing app.js.
       *
       * Do not connect MongoDB again
       * here if app.js already does it.
       */

      console.log(
        "Connecting to Redis..."
      );

      await connectRedis();

      console.log(
        "Redis connected successfully"
      );

      server.listen(
        PORT,
        "0.0.0.0",
        () => {
          console.log(
            `Server running on port ${PORT}`
          );
        }
      );
    } catch (error) {
      console.error(
        "SERVER STARTUP ERROR:",
        error
      );

      process.exit(1);
    }
  };

const shutdown =
  async (signal) => {
    console.log(
      `${signal} received. Shutting down...`
    );

    server.close(
      async () => {
        await closeRedis();

        process.exit(0);
      }
    );
  };

process.on(
  "SIGTERM",
  () =>
    shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () =>
    shutdown("SIGINT")
);

startServer();