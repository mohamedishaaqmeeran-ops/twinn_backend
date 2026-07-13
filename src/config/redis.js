const Redis = require("ioredis");

let redisClient = null;

const connectRedis = async () => {
  if (redisClient) {
    return redisClient;
  }

  if (!process.env.REDIS_URL) {
    throw new Error(
      "REDIS_URL is missing in environment variables."
    );
  }

  redisClient = new Redis(
    process.env.REDIS_URL,
    {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    }
  );

  redisClient.on(
    "connect",
    () => {
      console.log(
        "Redis connected successfully"
      );
    }
  );

  redisClient.on(
    "error",
    (error) => {
      console.error(
        "Redis error:",
        error.message
      );
    }
  );

  await redisClient.connect();

  return redisClient;
};

const getRedis = () => {
  if (!redisClient) {
    throw new Error(
      "Redis is not connected."
    );
  }

  return redisClient;
};

const closeRedis = async () => {
  if (!redisClient) {
    return;
  }

  await redisClient.quit();
  redisClient = null;
};

module.exports = {
  connectRedis,
  getRedis,
  closeRedis,
};