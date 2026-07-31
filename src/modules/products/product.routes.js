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
  normalizeRole,
  isInternalRole,
} = require(
  "../../utils/accessControl"
);

const upload = require(
  "../../config/productUpload"
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
   USER HELPERS
========================================================= */

const getUserId = (
  req
) =>
  req.userId ||
  req.auth?.userId ||
  req.user?.id ||
  req.user?._id;

const getCurrentRole = (
  req
) =>
  normalizeRole(
    req.userRole ||
      req.auth?.role ||
      req.user?.role
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
   CREATE PRODUCT
========================================================= */

router.post(
  "/",
  protect,
  requireBrandCreator,
  requireMinimumPlan(
    "free"
  ),
  requirePermission(
    "products:write"
  ),
  requireResourceLimit(
    "products",
    async (
      req
    ) =>
      productService
        .getProductCount(
          getTargetOwnerId(
            req
          )
        )
  ),
  uploadProductImages,
  controller.create
);

/* =========================================================
   LIST PRODUCTS
========================================================= */

router.get(
  "/",
  protect,
  requirePermission(
    "products:read"
  ),
  controller.list
);

/* =========================================================
   RESTORE PRODUCT
========================================================= */

router.patch(
  "/:id/restore",
  protect,
  requireBrandCreator,
  requireMinimumPlan(
    "free"
  ),
  requirePermission(
    "products:write"
  ),
  controller.restore
);

/* =========================================================
   PERMANENTLY DELETE PRODUCT
========================================================= */

router.delete(
  "/:id/permanent",
  protect,
  requireAdmin,
  requirePermission(
    "products:delete"
  ),
  controller.permanentRemove
);

/* =========================================================
   GET SINGLE PRODUCT
========================================================= */

router.get(
  "/:id",
  protect,
  requirePermission(
    "products:read"
  ),
  controller.single
);

/* =========================================================
   PATCH PRODUCT
========================================================= */

router.patch(
  "/:id",
  protect,
  requireBrandCreator,
  requireMinimumPlan(
    "free"
  ),
  requirePermission(
    "products:write"
  ),
  uploadProductImages,
  controller.update
);

/* =========================================================
   PUT PRODUCT
========================================================= */

router.put(
  "/:id",
  protect,
  requireBrandCreator,
  requireMinimumPlan(
    "free"
  ),
  requirePermission(
    "products:write"
  ),
  uploadProductImages,
  controller.update
);

/* =========================================================
   SOFT DELETE PRODUCT
========================================================= */

router.delete(
  "/:id",
  protect,
  requireBrandCreator,
  requirePermission(
    "products:delete"
  ),
  controller.remove
);

module.exports =
  router;