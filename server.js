require("dotenv").config();

const http =
  require("http");

const app =
  require("./src/app");

const connectDB =
  require(
    "./src/config/db"
  );

const {
  connectRedis,
  closeRedis,
} = require(
  "./src/config/redis"
);

const {
  startScheduleWorker,
} = require(
  "./src/modules/schedule/schedule.worker"
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
      await connectDB();

      console.log(
        "MongoDB connected successfully"
      );

      await connectRedis();

      console.log(
        "Redis connected successfully"
      );

      startScheduleWorker();

      server.listen(
        PORT,
        () => {
          console.log(
            `Server running on port ${PORT}`
          );
        }
      );
    } catch (error) {
      console.error(
        "Server startup failed:",
        error.message
      );

      process.exit(1);
    }
  };

const shutdown =
  async (signal) => {
    console.log(
      `${signal} received`
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