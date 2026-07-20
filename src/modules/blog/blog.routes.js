const express = require("express");

const router = express.Router();

const controller = require("./blog.controller");

const upload = require("../../middleware/upload.middleware");

const {
  protect,
} = require("../../middleware/auth.middleware");

const requireAdmin =
  require("../../middleware/admin.middleware");

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

router.get(
  "/:slug",
  controller.getBlogBySlug
);

router.get(
  "/:slug/related",
  controller.getRelatedBlogs
);

/* =========================================================
   ADMIN ROUTES
========================================================= */

router.get(
  "/admin",
  protect,
  requireAdmin,
  controller.getAdminBlogs
);

router.get(
  "/admin/:blogId",
  protect,
  requireAdmin,
  controller.getAdminBlogById
);

router.post(
  "/admin",
  protect,
  requireAdmin,
  upload.single("coverImage"),
  controller.createBlog
);

router.patch(
  "/admin/:blogId",
  protect,
  requireAdmin,
  upload.single("coverImage"),
  controller.updateBlog
);

router.delete(
  "/admin/:blogId",
  protect,
  requireAdmin,
  controller.deleteBlog
);

router.patch(
  "/admin/:blogId/publish",
  protect,
  requireAdmin,
  controller.toggleBlogPublishStatus
);

router.patch(
  "/admin/:blogId/featured",
  protect,
  requireAdmin,
  controller.toggleBlogFeatured
);

module.exports = router;