const express = require(
  "express"
);

const router =
  express.Router();

const controller = require(
  "./product.controller"
);

const productService = require(
  "./product.service"
);

const {
  protect,
} = require(
  "../../middleware/auth.middleware"
);

const {
  requireAdmin,
  requireBrandCreator,
} = require(
  "../../middleware/role.middleware"
);

const {
  requireMinimumPlan,
  requireResourceLimit,
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

const {
  normalizeRole,
} = require(
  "../../utils/accessControl"
);

const upload = require(
  "../../config/productUpload"
);

/* =========================================================
   PROTECT ALL PRODUCT ROUTES
========================================================= */

router.use(
  protect
);

/* =========================================================
   PRODUCT IMAGE UPLOAD
========================================================= */

const uploadProductImages =
  upload.array(
    "images",
    20
  );

/* =========================================================
   GET AUTHENTICATED USER ID
========================================================= */

const getUserId = (
  req
) => {
  const userId =
    req.userId ||
    req.auth?.userId ||
    req.user?.id ||
    req.user?._id;

  return userId
    ? String(userId)
    : "";
};

/* =========================================================
   GET CURRENT ROLE
========================================================= */

const getCurrentRole = (
  req
) =>
  normalizeRole(
    req.userRole ||
      req.auth?.role ||
      req.user?.role ||
      "user"
  );

/* =========================================================
   GET PRODUCT ACCESS CONTEXT

   This is the shape expected by product.service.js:

   {
     userId,
     role,
     ownerId
   }
========================================================= */

const getProductAccess = (
  req
) => {
  const userId =
    getUserId(req);

  const role =
    getCurrentRole(req);

  if (!userId) {
    const error =
      new Error(
        "Authenticated user ID is missing"
      );

    error.statusCode =
      401;

    error.code =
      "AUTHENTICATED_USER_ID_MISSING";

    throw error;
  }

  return {
    userId,
    role,

    /*
     Admin/manager operations may optionally specify
     the target brand creator.
    */
    ownerId:
      req.query?.ownerId ||
      req.body?.ownerId ||
      undefined,
  };
};

/* =========================================================
   LIST PRODUCTS
========================================================= */

router.get(
  "/",

  requirePermission(
    PERMISSIONS.PRODUCTS_READ
  ),

  controller.list
);

/* =========================================================
   CREATE PRODUCT
========================================================= */

router.post(
  "/",

  /*
   Current business rule:
   only Brand Creators create products.

   Admin creation has a separate access problem if this
   middleware remains enabled.
  */
  requireBrandCreator,

  requireMinimumPlan(
    "free"
  ),

  requirePermission(
    PERMISSIONS.PRODUCTS_WRITE
  ),

  requireResourceLimit(
    "products",

    async (
      req
    ) => {
      const access =
        getProductAccess(
          req
        );

      /*
       getProductCount now expects an access object,
       not a raw MongoDB ID.
      */
      return productService
        .getProductCount(
          access,
          {
            includeArchived:
              false,
          }
        );
    }
  ),

  uploadProductImages,

  controller.create
);

/* =========================================================
   RESTORE PRODUCT
========================================================= */

router.patch(
  "/:id/restore",

  requireBrandCreator,

  requireMinimumPlan(
    "free"
  ),

  requirePermission(
    PERMISSIONS.PRODUCTS_WRITE
  ),

  controller.restore
);

/* =========================================================
   PERMANENTLY DELETE PRODUCT
========================================================= */

router.delete(
  "/:id/permanent",

  requireAdmin,

  requirePermission(
    PERMISSIONS.PRODUCTS_DELETE
  ),

  controller.permanentRemove
);

/* =========================================================
   GET SINGLE PRODUCT
========================================================= */

router.get(
  "/:id",

  requirePermission(
    PERMISSIONS.PRODUCTS_READ
  ),

  controller.single
);

/* =========================================================
   PATCH PRODUCT
========================================================= */

router.patch(
  "/:id",

  requireBrandCreator,

  requireMinimumPlan(
    "free"
  ),

  requirePermission(
    PERMISSIONS.PRODUCTS_WRITE
  ),

  uploadProductImages,

  controller.update
);

/* =========================================================
   PUT PRODUCT
========================================================= */

router.put(
  "/:id",

  requireBrandCreator,

  requireMinimumPlan(
    "free"
  ),

  requirePermission(
    PERMISSIONS.PRODUCTS_WRITE
  ),

  uploadProductImages,

  controller.update
);

/* =========================================================
   SOFT DELETE PRODUCT
========================================================= */

router.delete(
  "/:id",

  requireBrandCreator,

  requirePermission(
    PERMISSIONS.PRODUCTS_DELETE
  ),

  controller.remove
);

module.exports =
  router;