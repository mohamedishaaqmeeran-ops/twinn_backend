require("dotenv").config();

const http = require("http");

const app = require("./src/app");

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
  Number(process.env.PORT) ||
  8000;

const server =
  http.createServer(app);

createRealtimeSocketServer(
  server
);

const startServer = async () => {
  try {
    /*
     * Keep MongoDB connection in only one
     * place. If app.js already connects to
     * MongoDB, do not connect again here.
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
      "SERVER STARTUP ERROR:"
    );

    console.error(
      "Message:",
      error?.message || error
    );

    if (error?.code) {
      console.error(
        "Code:",
        error.code
      );
    }

    if (error?.stack) {
      console.error(
        error.stack
      );
    }

    process.exit(1);
  }
};

const shutdown = async (
  signal
) => {
  console.log(
    `${signal} received. Shutting down...`
  );

  server.close(async () => {
    await closeRedis();
    process.exit(0);
  });
};

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

startServer();