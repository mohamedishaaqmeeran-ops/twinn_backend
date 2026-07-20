const express = require("express");
const multer = require("multer");

const router = express.Router();

const adminController = require("./admin.controller");

const {
  protect,
} = require("../../middleware/auth.middleware");

const {
  requireAdmin,
} = require("../../middleware/admin.middleware");

/* =========================================================
   CSV UPLOAD CONFIGURATION
========================================================= */

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
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

    const isCsvExtension =
      file.originalname
        ?.toLowerCase()
        .endsWith(".csv");

    if (
      validMimeTypes.includes(
        file.mimetype
      ) ||
      isCsvExtension
    ) {
      callback(null, true);
      return;
    }

    callback(
      new Error(
        "Only CSV files are allowed."
      )
    );
  },
});

/* =========================================================
   USER ROUTES
========================================================= */

router.get(
  "/users",
  protect,
  requireAdmin,
  adminController.getUsers
);

/* =========================================================
   IMPORT USERS
========================================================= */

router.post(
  "/users/import",
  protect,
  requireAdmin,
  upload.single("file"),
  adminController.importUsers
);

/* =========================================================
   UPDATE USER STATUS
========================================================= */

router.patch(
  "/users/:id/status",
  protect,
  requireAdmin,
  adminController.toggleUserStatus
);

/* =========================================================
   UPDATE USER PLAN
========================================================= */

router.patch(
  "/users/:id/plan",
  protect,
  requireAdmin,
  adminController.updateUserPlan
);

/* =========================================================
   DELETE USER
========================================================= */

router.delete(
  "/users/:id",
  protect,
  requireAdmin,
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
      return res.status(400).json({
        success: false,
        message:
          error.code ===
          "LIMIT_FILE_SIZE"
            ? "CSV file size must be below 5 MB."
            : error.message,
      });
    }

    if (error) {
      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Unable to upload CSV file.",
      });
    }

    next();
  }
);

module.exports = router;