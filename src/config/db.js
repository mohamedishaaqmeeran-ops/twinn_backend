const mongoose = require("mongoose");

let connectionPromise = null;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    console.log("MongoDB already connected");
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  const mongoUri = String(
    process.env.MONGO_URI || ""
  ).trim();

  if (!mongoUri) {
    throw new Error(
      "MONGO_URI is missing in environment variables."
    );
  }

  mongoose.set(
    "bufferCommands",
    false
  );

  connectionPromise = mongoose.connect(
    mongoUri,
    {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 1,
    }
  );

  try {
    await connectionPromise;

    console.log(
      "MongoDB connected successfully"
    );

    mongoose.connection.on(
      "error",
      (error) => {
        console.error(
          "MongoDB connection error:",
          error.message
        );
      }
    );

    mongoose.connection.on(
      "disconnected",
      () => {
        console.warn(
          "MongoDB disconnected"
        );
      }
    );

    return mongoose.connection;
  } catch (error) {
    connectionPromise = null;

    console.error(
      "MongoDB initial connection failed:",
      error.message
    );

    throw error;
  }
};

module.exports = connectDB;