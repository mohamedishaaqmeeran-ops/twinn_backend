// modules/admin/admin.routes.js

const express = require("express");
const multer = require("multer");

const router = express.Router();

const adminController = require(
  "./admin.controller"
);

const {
  protect,
} = require(
  "../../middleware/auth.middleware"
);

const {
  requireAdmin,
} = require(
  "../../middleware/role.middleware"
);

/* =========================================================
   CSV UPLOAD CONFIGURATION
========================================================= */

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },

  fileFilter: (
    req,
    file,
    callback
  ) => {
    const validMimeTypes = [
      "text/csv",
      "application/csv",
      "application/vnd.ms-excel",
      "text/plain",
    ];

    const fileName =
      String(
        file.originalname || ""
      ).toLowerCase();

    const isCsvExtension =
      fileName.endsWith(".csv");

    const hasValidMimeType =
      validMimeTypes.includes(
        file.mimetype
      );

    if (
      hasValidMimeType ||
      isCsvExtension
    ) {
      return callback(
        null,
        true
      );
    }

    return callback(
      new Error(
        "Only CSV files are allowed."
      )
    );
  },
});

/* =========================================================
   PROTECT ALL ADMIN ROUTES
========================================================= */

router.use(protect);
router.use(requireAdmin);

/* =========================================================
   ADMIN DASHBOARD
========================================================= */

router.get(
  "/dashboard",
  adminController.getDashboardStats
);

/* =========================================================
   USER ROUTES
========================================================= */

/*
  GET /api/admin/users

  Optional query parameters:

  ?page=1
  ?limit=10
  ?search=ishaaq
  ?role=user
  ?plan=pro
  ?status=Active
  ?sortBy=createdAt
  ?sortOrder=desc
*/

router.get(
  "/users",
  adminController.getUsers
);

/* =========================================================
   EXPORT USERS
========================================================= */

/*
  GET /api/admin/users/export

  Optional filters:

  ?role=contentcreator
  ?plan=business
  ?status=Active
*/

router.get(
  "/users/export",
  adminController.exportUsers
);

/* =========================================================
   IMPORT USERS
========================================================= */

/*
  POST /api/admin/users/import

  multipart/form-data:
  file: users.csv
*/

router.post(
  "/users/import",
  upload.single("file"),
  adminController.importUsers
);

/* =========================================================
   GET SINGLE USER
========================================================= */

router.get(
  "/users/:id",
  adminController.getUserById
);

/* =========================================================
   UPDATE USER STATUS
========================================================= */

/*
  PATCH /api/admin/users/:id/status

  Body:
  {
    "status": "Blocked",
    "reason": "Policy violation"
  }

  Or:
  {
    "status": "Active"
  }
*/

router.patch(
  "/users/:id/status",
  adminController.toggleUserStatus
);

/* =========================================================
   UPDATE USER ROLE
========================================================= */

/*
  PATCH /api/admin/users/:id/role

  Body:
  {
    "role": "manager"
  }

  Available roles:

  user
  admin
  manager
  contentcreator
  brandcreator
*/

router.patch(
  "/users/:id/role",
  adminController.updateUserRole
);

/* =========================================================
   UPDATE USER PLAN
========================================================= */

/*
  PATCH /api/admin/users/:id/plan

  Body:
  {
    "plan": "pro",
    "billingCycle": "monthly"
  }

  Available plans:

  free
  starter
  pro
  business
  agency
*/

router.patch(
  "/users/:id/plan",
  adminController.updateUserPlan
);

/* =========================================================
   UPDATE USER CREDITS
========================================================= */

/*
  PATCH /api/admin/users/:id/credits

  Body:
  {
    "operation": "add",
    "credits": 100
  }

  Supported operations:

  add
  subtract
  set
*/

router.patch(
  "/users/:id/credits",
  adminController.updateUserCredits
);

/* =========================================================
   RESET USER TRIAL
========================================================= */

/*
  PATCH /api/admin/users/:id/trial/reset
*/

router.patch(
  "/users/:id/trial/reset",
  adminController.resetUserTrial
);

/* =========================================================
   DELETE USER
========================================================= */

router.delete(
  "/users/:id",
  adminController.deleteUser
);

/* =========================================================
   MULTER ERROR HANDLER
========================================================= */

router.use(
  (
    error,
    req,
    res,
    next
  ) => {
    if (
      error instanceof
      multer.MulterError
    ) {
      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "CSV file size must be below 5 MB.",
          });
      }

      if (
        error.code ===
        "LIMIT_FILE_COUNT"
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Only one CSV file can be uploaded.",
          });
      }

      return res
        .status(400)
        .json({
          success: false,
          message:
            error.message ||
            "CSV upload failed.",
        });
    }

    if (error) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            error.message ||
            "Unable to upload CSV file.",
        });
    }

    return next();
  }
);

module.exports = router;