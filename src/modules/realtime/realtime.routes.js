// modules/realtime/realtime.routes.js

const express = require(
  "express"
);

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

const {
  requireBrandCreator,
} = require(
  "../../middleware/role.middleware"
);

const {
  requireMinimumPlan,
} = require(
  "../../middleware/plan.middleware"
);

const {
  requirePermission,
} = require(
  "../../middleware/permission.middleware"
);

const {
  PERMISSIONS,
} = require(
  "../../config/permissions"
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
  typeof requireBrandCreator !==
  "function"
) {
  throw new Error(
    "Realtime routes: requireBrandCreator middleware is not exported correctly."
  );
}

if (
  typeof requireMinimumPlan !==
  "function"
) {
  throw new Error(
    "Realtime routes: requireMinimumPlan middleware is not exported correctly."
  );
}

if (
  typeof requirePermission !==
  "function"
) {
  throw new Error(
    "Realtime routes: requirePermission middleware is not exported correctly."
  );
}

if (
  !PERMISSIONS ||
  typeof PERMISSIONS !==
    "object"
) {
  throw new Error(
    "Realtime routes: PERMISSIONS configuration is not exported correctly."
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
   ALL REALTIME ROUTES REQUIRE AUTHENTICATION
========================================================= */

router.use(
  protect
);

/* =========================================================
   CREATE REALTIME SESSION

   Allowed:
   - brandcreator
   - manager
   - admin

   Required:
   - free plan or higher
   - realtime:create
========================================================= */

router.post(
  "/sessions",

  requireBrandCreator,

  requireMinimumPlan(
    "free"
  ),

  requirePermission(
    PERMISSIONS
      .REALTIME_CREATE
  ),

  realtimeController
    .createSession
);

/* =========================================================
   GET REALTIME SESSION
========================================================= */

router.get(
  "/sessions/:id",

  requireBrandCreator,

  requirePermission(
    PERMISSIONS
      .REALTIME_READ
  ),

  realtimeController
    .getSession
);

/* =========================================================
   CLOSE REALTIME SESSION
========================================================= */

router.patch(
  "/sessions/:id/close",

  requireBrandCreator,

  requirePermission(
    PERMISSIONS
      .REALTIME_CLOSE
  ),

  realtimeController
    .closeSession
);

/* =========================================================
   FRONTEND COMPATIBILITY END ROUTE
========================================================= */

router.post(
  "/sessions/:id/end",

  requireBrandCreator,

  requirePermission(
    PERMISSIONS
      .REALTIME_CLOSE
  ),

  realtimeController
    .closeSession
);

module.exports =
  router;