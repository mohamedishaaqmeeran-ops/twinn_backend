// src/app.js

const express =
  require("express");

const cors =
  require("cors");

const cookieParser =
  require("cookie-parser");

const routes =
  require("./routes");

const app =
  express();

/* =========================================================
   PROXY CONFIGURATION
========================================================= */

app.set(
  "trust proxy",
  1
);

/* =========================================================
   ALLOWED ORIGINS
========================================================= */

const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://twinn.live",
  "https://www.twinn.live",
];

const environmentOrigins =
  String(
    process.env
      .ALLOWED_ORIGINS ||
      ""
  )
    .split(",")
    .map(
      (origin) =>
        origin.trim()
    )
    .filter(Boolean);

const allowedOrigins = [
  ...new Set([
    ...defaultOrigins,
    ...environmentOrigins,
  ]),
];

/* =========================================================
   CORS CONFIGURATION
========================================================= */

const corsOptions = {
  origin(
    origin,
    callback
  ) {
    /*
      Requests from Postman, curl, mobile apps,
      internal services and same-origin clients may
      not include an Origin header.
    */

    if (!origin) {
      return callback(
        null,
        true
      );
    }

    if (
      allowedOrigins.includes(
        origin
      )
    ) {
      return callback(
        null,
        true
      );
    }

    const error =
      new Error(
        `Origin not allowed by CORS: ${origin}`
      );

    error.statusCode =
      403;

    error.code =
      "CORS_ORIGIN_NOT_ALLOWED";

    return callback(
      error
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
    "X-Requested-With",
    "Accept",
    "Origin",
  ],

  exposedHeaders: [
    "Content-Length",
    "Content-Type",
  ],

  optionsSuccessStatus:
    204,
};

app.use(
  cors(
    corsOptions
  )
);

/* =========================================================
   REQUEST PARSERS
========================================================= */

app.use(
  express.json({
    limit:
      process.env.JSON_LIMIT ||
      "20mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit:
      process.env.URLENCODED_LIMIT ||
      "20mb",
  })
);

app.use(
  cookieParser()
);

/* =========================================================
   RESPONSE HEADERS
========================================================= */

app.disable(
  "x-powered-by"
);

/* =========================================================
   ROOT ROUTE
========================================================= */

app.get(
  "/",
  (
    req,
    res
  ) => {
    return res
      .status(200)
      .json({
        success: true,
        message:
          "Twinn Backend Running",
        environment:
          process.env.NODE_ENV ||
          "development",
      });
  }
);

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
  "/api/health",
  (
    req,
    res
  ) => {
    return res
      .status(200)
      .json({
        success: true,
        message:
          "Twinn backend is running",
        timestamp:
          new Date()
            .toISOString(),
        uptimeSeconds:
          Math.floor(
            process.uptime()
          ),
        environment:
          process.env.NODE_ENV ||
          "development",
      });
  }
);

/* =========================================================
   API ROUTES
========================================================= */

app.use(
  "/api",
  routes
);

/* =========================================================
   API NOT FOUND
========================================================= */

app.use(
  "/api",
  (
    req,
    res
  ) => {
    return res
      .status(404)
      .json({
        success: false,
        code:
          "API_ROUTE_NOT_FOUND",
        message:
          `API route not found: ${req.method} ${req.originalUrl}`,
      });
  }
);

/* =========================================================
   APPLICATION NOT FOUND
========================================================= */

app.use(
  (
    req,
    res
  ) => {
    return res
      .status(404)
      .json({
        success: false,
        code:
          "ROUTE_NOT_FOUND",
        message:
          `Route not found: ${req.method} ${req.originalUrl}`,
      });
  }
);

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "GLOBAL APP ERROR:",
      {
        message:
          error.message,
        code:
          error.code,
        method:
          req.method,
        path:
          req.originalUrl,
        stack:
          process.env
            .NODE_ENV ===
          "development"
            ? error.stack
            : undefined,
      }
    );

    if (
      res.headersSent
    ) {
      return next(
        error
      );
    }

    if (
      error.code ===
        "CORS_ORIGIN_NOT_ALLOWED"
    ) {
      return res
        .status(403)
        .json({
          success: false,
          code:
            error.code,
          message:
            "This origin is not allowed to access the API.",
        });
    }

    if (
      error.type ===
      "entity.too.large"
    ) {
      return res
        .status(413)
        .json({
          success: false,
          code:
            "PAYLOAD_TOO_LARGE",
          message:
            "The request payload is too large.",
        });
    }

    if (
      error instanceof
      SyntaxError &&
      error.status ===
        400 &&
      "body" in error
    ) {
      return res
        .status(400)
        .json({
          success: false,
          code:
            "INVALID_JSON",
          message:
            "The request contains invalid JSON.",
        });
    }

    const statusCode =
      Number(
        error.statusCode ||
          error.status
      ) || 500;

    return res
      .status(
        statusCode
      )
      .json({
        success: false,
        code:
          error.code ||
          "INTERNAL_SERVER_ERROR",
        message:
          statusCode >=
            500
            ? "An unexpected server error occurred."
            : error.message ||
              "Request failed.",
        ...(process.env
          .NODE_ENV ===
        "development"
          ? {
              error:
                error.message,
              stack:
                error.stack,
            }
          : {}),
      });
  }
);

module.exports =
  app;