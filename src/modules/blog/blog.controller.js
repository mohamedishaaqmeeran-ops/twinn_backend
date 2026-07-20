const mongoose = require("mongoose");

const Blog = require("../../models/Blog");

const {
  uploadImage,
  deleteImage,
} = require("../../services/cloudinary.service");

const {
  slugify,
  calculateReadTime,
} = require("./blog.service");

/* =========================================================
   HELPERS
========================================================= */

const userIdOf = (req) => {
  return (
    req.user?._id ||
    req.user?.id ||
    req.user?.userId ||
    ""
  );
};

const text = (value) => {
  return String(value || "").trim();
};

const validId = (value) => {
  return mongoose.Types.ObjectId.isValid(value);
};

const respondError = (
  res,
  status,
  message
) => {
  return res.status(status).json({
    success: false,
    message,
  });
};

const normalizeTags = (tags) => {
  if (!tags) {
    return [];
  }

  if (Array.isArray(tags)) {
    return tags
      .map((tag) => text(tag))
      .filter(Boolean);
  }

  return String(tags)
    .split(",")
    .map((tag) => text(tag))
    .filter(Boolean);
};

const parseBoolean = (
  value,
  fallback = false
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return ["true", "1", "yes"].includes(
    String(value).toLowerCase()
  );
};

const createUniqueSlug = async (
  title,
  excludeBlogId = null
) => {
  const baseSlug =
    slugify(title) ||
    `blog-${Date.now()}`;

  let finalSlug = baseSlug;
  let counter = 1;

  while (true) {
    const query = {
      slug: finalSlug,
    };

    if (excludeBlogId) {
      query._id = {
        $ne: excludeBlogId,
      };
    }

    const exists =
      await Blog.exists(query);

    if (!exists) {
      return finalSlug;
    }

    finalSlug =
      `${baseSlug}-${counter}`;

    counter += 1;
  }
};

/* =========================================================
   CREATE BLOG
   ADMIN ONLY
========================================================= */

exports.createBlog = async (
  req,
  res
) => {
  let uploadedPublicId = "";

  try {
    const userId =
      userIdOf(req);

    if (!userId) {
      return respondError(
        res,
        401,
        "Authentication required."
      );
    }

    const title =
      text(req.body.title);

    const excerpt =
      text(req.body.excerpt);

    const content =
      text(req.body.content);

    const category =
      text(req.body.category) ||
      "General";

    const seoTitle =
      text(req.body.seoTitle);

    const seoDescription =
      text(req.body.seoDescription);

    const tags =
      normalizeTags(
        req.body.tags
      );

    const featured =
      parseBoolean(
        req.body.featured,
        false
      );

    const published =
      parseBoolean(
        req.body.published,
        true
      );

    if (!title) {
      return respondError(
        res,
        400,
        "Blog title is required."
      );
    }

    if (!excerpt) {
      return respondError(
        res,
        400,
        "Blog excerpt is required."
      );
    }

    if (!content) {
      return respondError(
        res,
        400,
        "Blog content is required."
      );
    }

    let coverImage = "";
    let coverImagePublicId = "";

    if (req.file?.buffer) {
      const uploadResult =
        await uploadImage(
          req.file.buffer
        );

      coverImage =
        uploadResult.secure_url ||
        uploadResult.url ||
        "";

      coverImagePublicId =
        uploadResult.public_id ||
        "";

      uploadedPublicId =
        coverImagePublicId;
    }

    const slug =
      await createUniqueSlug(
        title
      );

    const blog =
      await Blog.create({
        userId,

        title,

        slug,

        excerpt,

        content,

        coverImage,

        coverImagePublicId,

        category,

        tags,

        featured,

        published,

        readTime:
          calculateReadTime(
            content
          ),

        views: 0,

        seoTitle:
          seoTitle || title,

        seoDescription:
          seoDescription ||
          excerpt,
      });

    return res.status(201).json({
      success: true,

      message:
        "Blog created successfully.",

      blog,
    });
  } catch (error) {
    console.error(
      "CREATE BLOG ERROR:",
      error
    );

    if (uploadedPublicId) {
      try {
        await deleteImage(
          uploadedPublicId
        );
      } catch (cleanupError) {
        console.error(
          "BLOG IMAGE CLEANUP ERROR:",
          cleanupError?.message
        );
      }
    }

    if (
      error?.code === 11000
    ) {
      return respondError(
        res,
        409,
        "A blog with this slug already exists."
      );
    }

    return respondError(
      res,
      500,
      error?.message ||
        "Unable to create blog."
    );
  }
};

/* =========================================================
   UPDATE BLOG
   ADMIN ONLY
========================================================= */

exports.updateBlog = async (
  req,
  res
) => {
  let newlyUploadedPublicId = "";

  try {
    const userId =
      userIdOf(req);

    const blogId =
      text(req.params.blogId);

    if (!userId) {
      return respondError(
        res,
        401,
        "Authentication required."
      );
    }

    if (!validId(blogId)) {
      return respondError(
        res,
        400,
        "Invalid blog ID."
      );
    }

    const blog =
      await Blog.findById(blogId);

    if (!blog) {
      return respondError(
        res,
        404,
        "Blog not found."
      );
    }

    const previousPublicId =
      blog.coverImagePublicId;

    const newTitle =
      req.body.title !== undefined
        ? text(req.body.title)
        : blog.title;

    const newExcerpt =
      req.body.excerpt !== undefined
        ? text(req.body.excerpt)
        : blog.excerpt;

    const newContent =
      req.body.content !== undefined
        ? text(req.body.content)
        : blog.content;

    if (!newTitle) {
      return respondError(
        res,
        400,
        "Blog title is required."
      );
    }

    if (!newExcerpt) {
      return respondError(
        res,
        400,
        "Blog excerpt is required."
      );
    }

    if (!newContent) {
      return respondError(
        res,
        400,
        "Blog content is required."
      );
    }

    if (
      newTitle !== blog.title
    ) {
      blog.slug =
        await createUniqueSlug(
          newTitle,
          blog._id
        );
    }

    blog.title =
      newTitle;

    blog.excerpt =
      newExcerpt;

    blog.content =
      newContent;

    if (
      req.body.category !==
      undefined
    ) {
      blog.category =
        text(
          req.body.category
        ) || "General";
    }

    if (
      req.body.tags !==
      undefined
    ) {
      blog.tags =
        normalizeTags(
          req.body.tags
        );
    }

    if (
      req.body.featured !==
      undefined
    ) {
      blog.featured =
        parseBoolean(
          req.body.featured,
          blog.featured
        );
    }

    if (
      req.body.published !==
      undefined
    ) {
      blog.published =
        parseBoolean(
          req.body.published,
          blog.published
        );
    }

    if (
      req.body.seoTitle !==
      undefined
    ) {
      blog.seoTitle =
        text(
          req.body.seoTitle
        );
    }

    if (
      req.body.seoDescription !==
      undefined
    ) {
      blog.seoDescription =
        text(
          req.body.seoDescription
        );
    }

    blog.readTime =
      calculateReadTime(
        newContent
      );

    if (req.file?.buffer) {
      const uploadResult =
        await uploadImage(
          req.file.buffer
        );

      const newCoverImage =
        uploadResult.secure_url ||
        uploadResult.url ||
        "";

      const newPublicId =
        uploadResult.public_id ||
        "";

      newlyUploadedPublicId =
        newPublicId;

      blog.coverImage =
        newCoverImage;

      blog.coverImagePublicId =
        newPublicId;
    }

    await blog.save();

    if (
      req.file?.buffer &&
      previousPublicId &&
      previousPublicId !==
        blog.coverImagePublicId
    ) {
      try {
        await deleteImage(
          previousPublicId
        );
      } catch (cleanupError) {
        console.error(
          "OLD BLOG IMAGE DELETE ERROR:",
          cleanupError?.message
        );
      }
    }

    return res.json({
      success: true,

      message:
        "Blog updated successfully.",

      blog,
    });
  } catch (error) {
    console.error(
      "UPDATE BLOG ERROR:",
      error
    );

    if (newlyUploadedPublicId) {
      try {
        await deleteImage(
          newlyUploadedPublicId
        );
      } catch (cleanupError) {
        console.error(
          "NEW BLOG IMAGE CLEANUP ERROR:",
          cleanupError?.message
        );
      }
    }

    if (
      error?.code === 11000
    ) {
      return respondError(
        res,
        409,
        "A blog with this slug already exists."
      );
    }

    return respondError(
      res,
      500,
      error?.message ||
        "Unable to update blog."
    );
  }
};

/* =========================================================
   DELETE BLOG
   ADMIN ONLY
========================================================= */

exports.deleteBlog = async (
  req,
  res
) => {
  try {
    const userId =
      userIdOf(req);

    const blogId =
      text(req.params.blogId);

    if (!userId) {
      return respondError(
        res,
        401,
        "Authentication required."
      );
    }

    if (!validId(blogId)) {
      return respondError(
        res,
        400,
        "Invalid blog ID."
      );
    }

    const blog =
      await Blog.findById(blogId);

    if (!blog) {
      return respondError(
        res,
        404,
        "Blog not found."
      );
    }

    const publicId =
      blog.coverImagePublicId;

    await blog.deleteOne();

    if (publicId) {
      try {
        await deleteImage(
          publicId
        );
      } catch (cleanupError) {
        console.error(
          "DELETE BLOG IMAGE ERROR:",
          cleanupError?.message
        );
      }
    }

    return res.json({
      success: true,

      message:
        "Blog deleted successfully.",

      deletedBlogId:
        String(blog._id),
    });
  } catch (error) {
    console.error(
      "DELETE BLOG ERROR:",
      error
    );

    return respondError(
      res,
      500,
      error?.message ||
        "Unable to delete blog."
    );
  }
};

/* =========================================================
   SERIALIZE BLOG
========================================================= */

const serializeBlog = (blog) => {
  if (!blog) {
    return null;
  }

  const value =
    typeof blog.toObject === "function"
      ? blog.toObject()
      : blog;

  return {
    ...value,

    id: String(
      value._id ||
        value.id ||
        ""
    ),

    _id: String(
      value._id ||
        value.id ||
        ""
    ),

    userId: String(
      value.userId?._id ||
        value.userId ||
        ""
    ),
  };
};

/* =========================================================
   ESCAPE SEARCH TEXT
========================================================= */

const escapeRegExp = (value) => {
  return String(value || "").replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
};

/* =========================================================
   PAGINATION HELPER
========================================================= */

const getPagination = (req) => {
  const parsedPage =
    Number.parseInt(
      req.query.page || "1",
      10
    );

  const parsedLimit =
    Number.parseInt(
      req.query.limit || "9",
      10
    );

  const page =
    Number.isFinite(parsedPage)
      ? Math.max(1, parsedPage)
      : 1;

  const limit =
    Number.isFinite(parsedLimit)
      ? Math.min(
          50,
          Math.max(
            1,
            parsedLimit
          )
        )
      : 9;

  return {
    page,
    limit,
    skip:
      (page - 1) *
      limit,
  };
};

/* =========================================================
   GET PUBLIC BLOGS
   PUBLISHED BLOGS ONLY
========================================================= */

exports.getPublicBlogs = async (
  req,
  res
) => {
  try {
    const {
      page,
      limit,
      skip,
    } = getPagination(req);

    const search =
      text(req.query.search);

    const category =
      text(req.query.category);

    const tag =
      text(req.query.tag);

    const featured =
      text(req.query.featured);

    const sort =
      text(req.query.sort) ||
      "latest";

    const query = {
      published: true,
    };

    if (search) {
      const searchRegex =
        new RegExp(
          escapeRegExp(search),
          "i"
        );

      query.$or = [
        {
          title:
            searchRegex,
        },
        {
          excerpt:
            searchRegex,
        },
        {
          content:
            searchRegex,
        },
        {
          category:
            searchRegex,
        },
        {
          tags:
            searchRegex,
        },
      ];
    }

    if (category) {
      query.category =
        new RegExp(
          `^${escapeRegExp(
            category
          )}$`,
          "i"
        );
    }

    if (tag) {
      query.tags =
        new RegExp(
          `^${escapeRegExp(
            tag
          )}$`,
          "i"
        );
    }

    if (
      featured === "true"
    ) {
      query.featured =
        true;
    }

    if (
      featured === "false"
    ) {
      query.featured =
        false;
    }

    let sortOptions = {
      createdAt: -1,
    };

    if (sort === "oldest") {
      sortOptions = {
        createdAt: 1,
      };
    }

    if (
      sort === "popular"
    ) {
      sortOptions = {
        views: -1,
        createdAt: -1,
      };
    }

    if (
      sort === "title"
    ) {
      sortOptions = {
        title: 1,
      };
    }

    const [
      blogs,
      total,
    ] = await Promise.all([
      Blog.find(query)
        .select(
          "-coverImagePublicId"
        )
        .sort(
          sortOptions
        )
        .skip(skip)
        .limit(limit)
        .lean(),

      Blog.countDocuments(
        query
      ),
    ]);

    return res.json({
      success: true,

      blogs:
        blogs.map(
          serializeBlog
        ),

      pagination: {
        page,
        limit,
        total,

        totalPages:
          total > 0
            ? Math.ceil(
                total /
                  limit
              )
            : 0,

        hasNextPage:
          page *
            limit <
          total,

        hasPreviousPage:
          page > 1,
      },
    });
  } catch (error) {
    console.error(
      "GET PUBLIC BLOGS ERROR:",
      error
    );

    return respondError(
      res,
      500,
      error?.message ||
        "Unable to get blogs."
    );
  }
};

/* =========================================================
   GET FEATURED BLOGS
   PUBLISHED BLOGS ONLY
========================================================= */

exports.getFeaturedBlogs =
  async (req, res) => {
    try {
      const parsedLimit =
        Number.parseInt(
          req.query.limit ||
            "3",
          10
        );

      const limit =
        Number.isFinite(
          parsedLimit
        )
          ? Math.min(
              12,
              Math.max(
                1,
                parsedLimit
              )
            )
          : 3;

      const blogs =
        await Blog.find({
          published: true,
          featured: true,
        })
          .select(
            "-coverImagePublicId"
          )
          .sort({
            createdAt: -1,
          })
          .limit(limit)
          .lean();

      return res.json({
        success: true,

        blogs:
          blogs.map(
            serializeBlog
          ),
      });
    } catch (error) {
      console.error(
        "GET FEATURED BLOGS ERROR:",
        error
      );

      return respondError(
        res,
        500,
        error?.message ||
          "Unable to get featured blogs."
      );
    }
  };

/* =========================================================
   GET RECENT BLOGS
   PUBLISHED BLOGS ONLY
========================================================= */

exports.getRecentBlogs =
  async (req, res) => {
    try {
      const parsedLimit =
        Number.parseInt(
          req.query.limit ||
            "5",
          10
        );

      const limit =
        Number.isFinite(
          parsedLimit
        )
          ? Math.min(
              20,
              Math.max(
                1,
                parsedLimit
              )
            )
          : 5;

      const excludeSlug =
        text(
          req.query
            .excludeSlug
        );

      const query = {
        published: true,
      };

      if (excludeSlug) {
        query.slug = {
          $ne:
            excludeSlug,
        };
      }

      const blogs =
        await Blog.find(
          query
        )
          .select(
            "-coverImagePublicId"
          )
          .sort({
            createdAt: -1,
          })
          .limit(limit)
          .lean();

      return res.json({
        success: true,

        blogs:
          blogs.map(
            serializeBlog
          ),
      });
    } catch (error) {
      console.error(
        "GET RECENT BLOGS ERROR:",
        error
      );

      return respondError(
        res,
        500,
        error?.message ||
          "Unable to get recent blogs."
      );
    }
  };

/* =========================================================
   GET PUBLIC BLOG BY SLUG
   INCREMENTS VIEW COUNT
========================================================= */

exports.getBlogBySlug =
  async (req, res) => {
    try {
      const slug =
        text(
          req.params.slug
        ).toLowerCase();

      if (!slug) {
        return respondError(
          res,
          400,
          "Blog slug is required."
        );
      }

      const blog =
        await Blog.findOneAndUpdate(
          {
            slug,
            published: true,
          },
          {
            $inc: {
              views: 1,
            },
          },
          {
            new: true,
          }
        )
          .select(
            "-coverImagePublicId"
          )
          .lean();

      if (!blog) {
        return respondError(
          res,
          404,
          "Blog not found."
        );
      }

      return res.json({
        success: true,

        blog:
          serializeBlog(
            blog
          ),
      });
    } catch (error) {
      console.error(
        "GET BLOG BY SLUG ERROR:",
        error
      );

      return respondError(
        res,
        500,
        error?.message ||
          "Unable to get blog."
      );
    }
  };

/* =========================================================
   GET RELATED BLOGS
========================================================= */

exports.getRelatedBlogs =
  async (req, res) => {
    try {
      const slug =
        text(
          req.params.slug
        ).toLowerCase();

      const parsedLimit =
        Number.parseInt(
          req.query.limit ||
            "3",
          10
        );

      const limit =
        Number.isFinite(
          parsedLimit
        )
          ? Math.min(
              10,
              Math.max(
                1,
                parsedLimit
              )
            )
          : 3;

      if (!slug) {
        return respondError(
          res,
          400,
          "Blog slug is required."
        );
      }

      const currentBlog =
        await Blog.findOne({
          slug,
          published: true,
        })
          .select(
            "_id category tags"
          )
          .lean();

      if (!currentBlog) {
        return respondError(
          res,
          404,
          "Blog not found."
        );
      }

      const relatedConditions =
        [];

      if (
        currentBlog.category
      ) {
        relatedConditions.push({
          category:
            currentBlog.category,
        });
      }

      if (
        Array.isArray(
          currentBlog.tags
        ) &&
        currentBlog.tags
          .length
      ) {
        relatedConditions.push({
          tags: {
            $in:
              currentBlog.tags,
          },
        });
      }

      const query = {
        _id: {
          $ne:
            currentBlog._id,
        },

        published: true,
      };

      if (
        relatedConditions
          .length
      ) {
        query.$or =
          relatedConditions;
      }

      const blogs =
        await Blog.find(
          query
        )
          .select(
            "-content -coverImagePublicId"
          )
          .sort({
            featured: -1,
            createdAt: -1,
          })
          .limit(limit)
          .lean();

      return res.json({
        success: true,

        blogs:
          blogs.map(
            serializeBlog
          ),
      });
    } catch (error) {
      console.error(
        "GET RELATED BLOGS ERROR:",
        error
      );

      return respondError(
        res,
        500,
        error?.message ||
          "Unable to get related blogs."
      );
    }
  };

/* =========================================================
   GET BLOG CATEGORIES
========================================================= */

exports.getBlogCategories =
  async (req, res) => {
    try {
      const categories =
        await Blog.distinct(
          "category",
          {
            published: true,
            category: {
              $nin: [
                "",
                null,
              ],
            },
          }
        );

      const normalized =
        categories
          .map((category) =>
            text(category)
          )
          .filter(Boolean)
          .sort((a, b) =>
            a.localeCompare(
              b
            )
          );

      return res.json({
        success: true,

        categories:
          normalized,
      });
    } catch (error) {
      console.error(
        "GET BLOG CATEGORIES ERROR:",
        error
      );

      return respondError(
        res,
        500,
        error?.message ||
          "Unable to get blog categories."
      );
    }
  };

/* =========================================================
   GET ADMIN BLOGS
   ADMIN ONLY
========================================================= */

exports.getAdminBlogs =
  async (req, res) => {
    try {
      const userId =
        userIdOf(req);

      if (!userId) {
        return respondError(
          res,
          401,
          "Authentication required."
        );
      }

      const {
        page,
        limit,
        skip,
      } = getPagination(req);

      const search =
        text(
          req.query.search
        );

      const category =
        text(
          req.query.category
        );

      const status =
        text(
          req.query.status
        ).toLowerCase();

      const featured =
        text(
          req.query.featured
        ).toLowerCase();

      const query = {};

      if (search) {
        const searchRegex =
          new RegExp(
            escapeRegExp(
              search
            ),
            "i"
          );

        query.$or = [
          {
            title:
              searchRegex,
          },
          {
            excerpt:
              searchRegex,
          },
          {
            category:
              searchRegex,
          },
          {
            tags:
              searchRegex,
          },
        ];
      }

      if (category) {
        query.category =
          new RegExp(
            `^${escapeRegExp(
              category
            )}$`,
            "i"
          );
      }

      if (
        status ===
        "published"
      ) {
        query.published =
          true;
      }

      if (
        status === "draft"
      ) {
        query.published =
          false;
      }

      if (
        status &&
        ![
          "published",
          "draft",
          "all",
        ].includes(
          status
        )
      ) {
        return respondError(
          res,
          400,
          "Invalid blog status."
        );
      }

      if (
        featured === "true"
      ) {
        query.featured =
          true;
      }

      if (
        featured === "false"
      ) {
        query.featured =
          false;
      }

      const [
        blogs,
        total,
        publishedCount,
        draftCount,
        featuredCount,
      ] = await Promise.all([
        Blog.find(query)
          .sort({
            createdAt: -1,
          })
          .skip(skip)
          .limit(limit)
          .lean(),

        Blog.countDocuments(
          query
        ),

        Blog.countDocuments({
          published: true,
        }),

        Blog.countDocuments({
          published: false,
        }),

        Blog.countDocuments({
          featured: true,
        }),
      ]);

      return res.json({
        success: true,

        blogs:
          blogs.map(
            serializeBlog
          ),

        stats: {
          total:
            publishedCount +
            draftCount,

          published:
            publishedCount,

          drafts:
            draftCount,

          featured:
            featuredCount,
        },

        pagination: {
          page,
          limit,
          total,

          totalPages:
            total > 0
              ? Math.ceil(
                  total /
                    limit
                )
              : 0,

          hasNextPage:
            page *
              limit <
            total,

          hasPreviousPage:
            page > 1,
        },
      });
    } catch (error) {
      console.error(
        "GET ADMIN BLOGS ERROR:",
        error
      );

      return respondError(
        res,
        500,
        error?.message ||
          "Unable to get admin blogs."
      );
    }
  };

/* =========================================================
   GET ADMIN BLOG BY ID
   ADMIN ONLY
========================================================= */

exports.getAdminBlogById =
  async (req, res) => {
    try {
      const userId =
        userIdOf(req);

      const blogId =
        text(
          req.params.blogId
        );

      if (!userId) {
        return respondError(
          res,
          401,
          "Authentication required."
        );
      }

      if (
        !validId(blogId)
      ) {
        return respondError(
          res,
          400,
          "Invalid blog ID."
        );
      }

      const blog =
        await Blog.findById(
          blogId
        );

      if (!blog) {
        return respondError(
          res,
          404,
          "Blog not found."
        );
      }

      return res.json({
        success: true,

        blog:
          serializeBlog(
            blog
          ),
      });
    } catch (error) {
      console.error(
        "GET ADMIN BLOG BY ID ERROR:",
        error
      );

      return respondError(
        res,
        500,
        error?.message ||
          "Unable to get blog."
      );
    }
  };

/* =========================================================
   TOGGLE BLOG PUBLISH STATUS
   ADMIN ONLY
========================================================= */

exports.toggleBlogPublishStatus =
  async (req, res) => {
    try {
      const userId =
        userIdOf(req);

      const blogId =
        text(
          req.params.blogId
        );

      if (!userId) {
        return respondError(
          res,
          401,
          "Authentication required."
        );
      }

      if (
        !validId(blogId)
      ) {
        return respondError(
          res,
          400,
          "Invalid blog ID."
        );
      }

      const blog =
        await Blog.findById(
          blogId
        );

      if (!blog) {
        return respondError(
          res,
          404,
          "Blog not found."
        );
      }

      if (
        req.body.published ===
        undefined
      ) {
        blog.published =
          !blog.published;
      } else {
        blog.published =
          parseBoolean(
            req.body
              .published,
            blog.published
          );
      }

      await blog.save();

      return res.json({
        success: true,

        message:
          blog.published
            ? "Blog published successfully."
            : "Blog moved to draft successfully.",

        blog:
          serializeBlog(
            blog
          ),
      });
    } catch (error) {
      console.error(
        "TOGGLE BLOG PUBLISH ERROR:",
        error
      );

      return respondError(
        res,
        500,
        error?.message ||
          "Unable to update publish status."
      );
    }
  };

/* =========================================================
   TOGGLE FEATURED STATUS
   ADMIN ONLY
========================================================= */

exports.toggleBlogFeatured =
  async (req, res) => {
    try {
      const userId =
        userIdOf(req);

      const blogId =
        text(
          req.params.blogId
        );

      if (!userId) {
        return respondError(
          res,
          401,
          "Authentication required."
        );
      }

      if (
        !validId(blogId)
      ) {
        return respondError(
          res,
          400,
          "Invalid blog ID."
        );
      }

      const blog =
        await Blog.findById(
          blogId
        );

      if (!blog) {
        return respondError(
          res,
          404,
          "Blog not found."
        );
      }

      if (
        req.body.featured ===
        undefined
      ) {
        blog.featured =
          !blog.featured;
      } else {
        blog.featured =
          parseBoolean(
            req.body
              .featured,
            blog.featured
          );
      }

      await blog.save();

      return res.json({
        success: true,

        message:
          blog.featured
            ? "Blog marked as featured."
            : "Blog removed from featured posts.",

        blog:
          serializeBlog(
            blog
          ),
      });
    } catch (error) {
      console.error(
        "TOGGLE BLOG FEATURED ERROR:",
        error
      );

      return respondError(
        res,
        500,
        error?.message ||
          "Unable to update featured status."
      );
    }
  };