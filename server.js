require("dotenv").config();

const app = require("./src/app");
const connectDB = require("./src/config/db");

const {
  startScheduleWorker,
} = require("./src/modules/schedule/schedule.worker");

const PORT = process.env.PORT || 8000;

connectDB()
  .then(() => {
    console.log("MongoDB connected successfully");

    // Start automatic live schedule checking
    startScheduleWorker();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error(
      "MongoDB connection failed:",
      error.message
    );

    process.exit(1);
  });