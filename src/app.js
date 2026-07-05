const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const routes = require("./routes");
const paymentController = require("./modules/payment/payment.controller");

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://twinn.live",
      "https://www.twinn.live",
      "https://ai-twin-63zh.vercel.app",
      "https://ai-twin-iota.vercel.app",
    ],
    credentials: true,
  })
);

// Stripe webhook MUST be before express.json()
app.post(
  "/api/payments/stripe/webhook",
  express.raw({ type: "application/json" }),
  paymentController.stripeWebhook
);

app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Twinn Backend Running");
});

app.use("/api", routes);

module.exports = app;