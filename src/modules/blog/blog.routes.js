const express = require("express");

const router = express.Router();

const controller = require(
  "./blog.controller"
);

const upload = require(
  "../../middleware/upload.middleware"
);

const {
  protect,
} = require(
  "../../middleware/auth.middleware"
);

const {
  requireManagerOrAdmin,
} = require(
  "../../middleware/role.middleware"
);

/* =========================================================
   PUBLIC ROUTES
========================================================= */

router.get(
  "/",
  controller.getPublicBlogs
);

router.get(
  "/featured",
  controller.getFeaturedBlogs
);

router.get(
  "/recent",
  controller.getRecentBlogs
);

router.get(
  "/categories",
  controller.getBlogCategories
);

/* =========================================================
   ADMIN / MANAGER ROUTES
   KEEP THESE BEFORE /:slug
========================================================= */

router.get(
  "/admin",
  protect,
  requireManagerOrAdmin,
  controller.getAdminBlogs
);

router.get(
  "/admin/:blogId",
  protect,
  requireManagerOrAdmin,
  controller.getAdminBlogById
);

router.post(
  "/admin",
  protect,
  requireManagerOrAdmin,
  upload.single("coverImage"),
  controller.createBlog
);

router.patch(
  "/admin/:blogId",
  protect,
  requireManagerOrAdmin,
  upload.single("coverImage"),
  controller.updateBlog
);

router.delete(
  "/admin/:blogId",
  protect,
  requireManagerOrAdmin,
  controller.deleteBlog
);

router.patch(
  "/admin/:blogId/publish",
  protect,
  requireManagerOrAdmin,
  controller.toggleBlogPublishStatus
);

router.patch(
  "/admin/:blogId/featured",
  protect,
  requireManagerOrAdmin,
  controller.toggleBlogFeatured
);

/* =========================================================
   PUBLIC DYNAMIC ROUTES
   KEEP THESE LAST
========================================================= */

router.get(
  "/:slug/related",
  controller.getRelatedBlogs
);

router.get(
  "/:slug",
  controller.getBlogBySlug
);

module.exports = router;