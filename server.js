require("dotenv").config();

const http = require("http");
const mongoose = require("mongoose");

const app = require("./src/app");

const connectDB = require(
  "./src/config/db"
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
  "./src/modules/realtime/realtime.websocket"
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

const startServer = async () => {
  try {
    console.log(
      "Connecting to MongoDB..."
    );

    await connectDB();

    console.log(
      "MongoDB ready state:",
      mongoose.connection.readyState
    );

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
      error?.message || error
    );

    console.error(
      error?.stack || ""
    );

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
    try {
      await closeRedis();

      if (
        mongoose.connection.readyState !==
        0
      ) {
        await mongoose.connection.close();
      }
    } catch (error) {
      console.error(
        "Shutdown error:",
        error.message
      );
    } finally {
      process.exit(0);
    }
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