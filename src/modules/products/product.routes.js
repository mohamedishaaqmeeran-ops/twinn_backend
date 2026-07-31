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
  isInternalRole,
} = require(
  "../../utils/accessControl"
);

const upload = require(
  "../../config/productUpload"
);

/* =========================================================
   PROTECT ALL PRODUCT ROUTES
========================================================= */

router.use(protect);

/* =========================================================
   PRODUCT IMAGE UPLOAD
========================================================= */

const uploadProductImages =
  upload.array(
    "images",
    20
  );

/* =========================================================
   USER HELPERS
========================================================= */

const getUserId = (
  req
) =>
  req.userId ||
  req.auth?.userId ||
  req.user?.id ||
  req.user?._id;

/* =========================================================
   CURRENT ROLE
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
   TARGET PRODUCT OWNER
========================================================= */

const getTargetOwnerId = (
  req
) => {
  const currentUserId =
    getUserId(req);

  const role =
    getCurrentRole(req);

  /*
   Admin and manager may create or query products
   for another creator.

   Normal users and creators are always restricted
   to their own account.
  */

  if (
    isInternalRole(role)
  ) {
    return (
      req.body?.ownerId ||
      req.query?.ownerId ||
      currentUserId
    );
  }

  return currentUserId;
};

/* =========================================================
   LIST PRODUCTS

   All authenticated users with products:read
   can access the list.

   The controller must filter products based on role:
   - customer: public/available products
   - creator: own products
   - manager/admin: requested owner or all products
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
      const ownerId =
        getTargetOwnerId(req);

      if (!ownerId) {
        throw new Error(
          "Product owner ID is missing"
        );
      }

      return productService
        .getProductCount(
          ownerId
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

   Admin-only route.
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