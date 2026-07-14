const express = require("express");

const router = express.Router();

const realtimeController = require(
  "./realtime.controller"
);

const {
  protect,
} = require(
  "../../middleware/auth.middleware"
);

/* =========================================================
   DEBUG CHECKS
========================================================= */

if (
  typeof protect !==
  "function"
) {
  throw new Error(
    "Realtime routes: protect middleware is not a function. Check auth.middleware exports."
  );
}

if (
  typeof realtimeController.createSession !==
  "function"
) {
  throw new Error(
    "Realtime routes: createSession controller is not exported."
  );
}

if (
  typeof realtimeController.getSession !==
  "function"
) {
  throw new Error(
    "Realtime routes: getSession controller is not exported."
  );
}

if (
  typeof realtimeController.closeSession !==
  "function"
) {
  throw new Error(
    "Realtime routes: closeSession controller is not exported."
  );
}

/* =========================================================
   ROUTES
========================================================= */

router.post(
  "/sessions",
  protect,
  realtimeController.createSession
);

router.get(
  "/sessions/:id",
  protect,
  realtimeController.getSession
);

router.patch(
  "/sessions/:id/close",
  protect,
  realtimeController.closeSession
);

module.exports = router;