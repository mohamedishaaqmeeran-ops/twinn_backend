const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const routes = require("./routes");

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://twinn.live",
      "https://www.twinn.live",
      "https://ai-twin-63zh.vercel.app",
      "https://ai-twin-iota.vercel.app"
    ],
    credentials: true
  })
);

app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Twinn Backend Running");
});

app.use("/api", routes);

module.exports = app;