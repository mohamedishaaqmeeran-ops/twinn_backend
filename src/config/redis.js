const Redis = require("ioredis");

let redisClient = null;

const connectRedis = async () => {
  if (
    redisClient &&
    redisClient.status === "ready"
  ) {
    return redisClient;
  }

  const redisUrl =
    String(
      process.env.REDIS_URL || ""
    ).trim();

  if (!redisUrl) {
    throw new Error(
      "REDIS_URL is missing in Render environment variables."
    );
  }

  if (
    !redisUrl.startsWith("redis://") &&
    !redisUrl.startsWith("rediss://")
  ) {
    throw new Error(
      "REDIS_URL must start with redis:// or rediss://."
    );
  }

  redisClient = new Redis(redisUrl, {
    /*
     * Connect immediately.
     * Do not combine lazyConnect with
     * automatic commands during startup.
     */
    lazyConnect: false,

    enableReadyCheck: true,

    maxRetriesPerRequest: 3,

    connectTimeout: 15000,

    retryStrategy(times) {
      if (times > 10) {
        return null;
      }

      return Math.min(
        times * 500,
        5000
      );
    },

    /*
     * Required only when using a
     * rediss:// TLS URL.
     */
    ...(redisUrl.startsWith(
      "rediss://"
    )
      ? {
          tls: {
            rejectUnauthorized:
              false,
          },
        }
      : {}),
  });

  redisClient.on(
    "connect",
    () => {
      console.log(
        "Redis TCP connection opened"
      );
    }
  );

  redisClient.on(
    "ready",
    () => {
      console.log(
        "Redis connected and ready"
      );
    }
  );

  redisClient.on(
    "reconnecting",
    (delay) => {
      console.log(
        `Redis reconnecting in ${delay}ms`
      );
    }
  );

  redisClient.on(
    "close",
    () => {
      console.warn(
        "Redis connection closed"
      );
    }
  );

  redisClient.on(
    "end",
    () => {
      console.warn(
        "Redis connection ended"
      );
    }
  );

  redisClient.on(
    "error",
    (error) => {
      console.error(
        "REDIS ERROR:",
        error?.message ||
          error
      );

      if (error?.code) {
        console.error(
          "REDIS ERROR CODE:",
          error.code
        );
      }
    }
  );

  /*
   * Since lazyConnect is false,
   * do not call redisClient.connect().
   *
   * Wait until Redis reports ready.
   */
  await new Promise(
    (resolve, reject) => {
      const timeout =
        setTimeout(() => {
          reject(
            new Error(
              "Redis connection timed out after 15 seconds."
            )
          );
        }, 15000);

      const handleReady = () => {
        clearTimeout(timeout);
        cleanup();
        resolve();
      };

      const handleError = (
        error
      ) => {
        clearTimeout(timeout);
        cleanup();

        reject(
          new Error(
            `Redis connection failed: ${
              error?.message ||
              "Unknown Redis error"
            }`
          )
        );
      };

      const handleEnd = () => {
        clearTimeout(timeout);
        cleanup();

        reject(
          new Error(
            "Redis connection ended before becoming ready."
          )
        );
      };

      const cleanup = () => {
        redisClient.off(
          "ready",
          handleReady
        );

        redisClient.off(
          "error",
          handleError
        );

        redisClient.off(
          "end",
          handleEnd
        );
      };

      if (
        redisClient.status ===
        "ready"
      ) {
        handleReady();
        return;
      }

      redisClient.once(
        "ready",
        handleReady
      );

      redisClient.once(
        "error",
        handleError
      );

      redisClient.once(
        "end",
        handleEnd
      );
    }
  );

  const pong =
    await redisClient.ping();

  if (pong !== "PONG") {
    throw new Error(
      "Redis PING verification failed."
    );
  }

  console.log(
    "Redis PING successful"
  );

  return redisClient;
};

const getRedis = () => {
  if (!redisClient) {
    throw new Error(
      "Redis client has not been initialized."
    );
  }

  if (
    redisClient.status !== "ready"
  ) {
    throw new Error(
      `Redis is not ready. Current status: ${redisClient.status}`
    );
  }

  return redisClient;
};

const closeRedis = async () => {
  if (!redisClient) {
    return;
  }

  try {
    if (
      redisClient.status ===
        "ready" ||
      redisClient.status ===
        "connect"
    ) {
      await redisClient.quit();
    } else {
      redisClient.disconnect();
    }
  } catch (error) {
    console.error(
      "Redis shutdown error:",
      error?.message || error
    );

    redisClient.disconnect();
  } finally {
    redisClient = null;
  }
};

module.exports = {
  connectRedis,
  getRedis,
  closeRedis,
};