const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const routes = require("./routes");

const app = express();

app.set("trust proxy", 1);

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://twinn.live",
  "https://www.twinn.live",
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (
        allowedOrigins.includes(
          origin
        )
      ) {
        return callback(null, true);
      }

      return callback(
        new Error(
          `Origin not allowed by CORS: ${origin}`
        )
      );
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

app.use(
  express.json({
    limit: "20mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "20mb",
  })
);

app.use(cookieParser());

app.get("/", (req, res) => {
  res.send(
    "Twinn Backend Running"
  );
});

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      success: true,
      message:
        "Twinn backend is running",
      timestamp:
        new Date().toISOString(),
    });
  }
);

app.use("/api", routes);

module.exports = app;