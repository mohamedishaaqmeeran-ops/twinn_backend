const express =
  require("express");

const router =
  express.Router();

const realtimeController =
  require(
    "./realtime.controller"
  );

const {
  protect,
} = require(
  "../../middleware/auth.middleware"
);

/* =========================================================
   VALIDATE IMPORTS
========================================================= */

if (
  typeof protect !==
  "function"
) {
  throw new Error(
    "Realtime routes: protect middleware is not exported correctly."
  );
}

if (
  typeof realtimeController
    .createSession !==
  "function"
) {
  throw new Error(
    "Realtime routes: createSession controller is not exported."
  );
}

if (
  typeof realtimeController
    .getSession !==
  "function"
) {
  throw new Error(
    "Realtime routes: getSession controller is not exported."
  );
}

if (
  typeof realtimeController
    .closeSession !==
  "function"
) {
  throw new Error(
    "Realtime routes: closeSession controller is not exported."
  );
}

/* =========================================================
   SESSION ROUTES
========================================================= */

router.post(
  "/sessions",
  protect,
  realtimeController
    .createSession
);

router.get(
  "/sessions/:id",
  protect,
  realtimeController
    .getSession
);

router.patch(
  "/sessions/:id/close",
  protect,
  realtimeController
    .closeSession
);

/*
 * Compatibility route for the frontend.
 *
 * The current frontend calls:
 * POST /api/realtime/sessions/:id/end
 */

router.post(
  "/sessions/:id/end",
  protect,
  realtimeController
    .closeSession
);

module.exports =
  router;