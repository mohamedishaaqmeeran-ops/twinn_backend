const mongoose = require("mongoose");

const AvatarVideo = require(
  "../../models/AvatarVideo"
);

const Twin = require(
  "../../models/Twin"
);

const Product = require(
  "../../models/Product"
);

const {
  processAvatarVideo,
  deleteAvatarVideoAsset,
} = require(
  "./avatarVideo.service"
);

/* =========================================================
   CONSTANTS
========================================================= */

const ACTIVE_STATUSES = [
  "queued",
  "processing",
  "generating",
  "rendering",
  "uploading",
];

const ALLOWED_STATUSES = [
  ...ACTIVE_STATUSES,
  "completed",
  "failed",
];

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

const validId = (value) => {
  return mongoose.Types.ObjectId.isValid(
    value
  );
};

const text = (value) => {
  return String(value || "").trim();
};

const getTwinImage = (twin) => {
  return (
    twin?.appearance?.avatarUrl ||
    twin?.appearance?.imageUrl ||
    twin?.appearance?.image ||
    twin?.avatarUrl ||
    twin?.imageUrl ||
    twin?.image ||
    twin?.avatar ||
    ""
  );
};

const getTwinName = (twin) => {
  return (
    twin?.name ||
    twin?.twinName ||
    twin?.twin_name ||
    "AI Twin"
  );
};

const getProductName = (product) => {
  return (
    product?.name ||
    product?.productName ||
    product?.title ||
    "Product"
  );
};

const serialize = (doc) => {
  if (!doc) {
    return null;
  }

  const value =
    typeof doc.toObject === "function"
      ? doc.toObject()
      : doc;

  const documentId =
    value._id ||
    value.id ||
    "";

  return {
    ...value,

    id:
      text(documentId),

    _id:
      text(documentId),

    userId:
      text(
        value.userId?._id ||
          value.userId
      ),

    twinId:
      text(
        value.twinId?._id ||
          value.twinId
      ),

    productId:
      text(
        value.productId?._id ||
          value.productId
      ),
  };
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

/* =========================================================
   START BACKGROUND PROCESS
========================================================= */

const startBackground = (params) => {
  setImmediate(() => {
    processAvatarVideo(params).catch(
      (error) => {
        console.error(
          "AVATAR VIDEO BACKGROUND ERROR:",
          error?.message ||
            "Avatar video generation failed."
        );
      }
    );
  });
};

/* =========================================================
   GENERATE AVATAR VIDEO
========================================================= */

exports.generateAvatarVideo = async (
  req,
  res
) => {
  try {
    const userId =
      userIdOf(req);

    const twinId =
      text(req.params.twinId);

    const productId =
      text(req.body?.productId);

    if (!userId) {
      return respondError(
        res,
        401,
        "Authentication required."
      );
    }

    if (!validId(twinId)) {
      return respondError(
        res,
        400,
        "Invalid AI Twin ID."
      );
    }

    if (!validId(productId)) {
      return respondError(
        res,
        400,
        "Invalid product ID."
      );
    }

    const [
      twin,
      product,
    ] = await Promise.all([
      Twin.findOne({
        _id: twinId,
        userId,
      }),

      Product.findOne({
        _id: productId,
        userId,
      }),
    ]);

    if (!twin) {
      return respondError(
        res,
        404,
        "AI Twin not found."
      );
    }

    if (!product) {
      return respondError(
        res,
        404,
        "Product not found."
      );
    }

    const imageUrl =
      getTwinImage(twin);

    if (!imageUrl) {
      return respondError(
        res,
        400,
        "Upload an avatar image before generating a video."
      );
    }

    const activeJob =
      await AvatarVideo.findOne({
        userId,
        twinId,
        productId,

        status: {
          $in:
            ACTIVE_STATUSES,
        },
      }).sort({
        createdAt: -1,
      });

    if (activeJob) {
      return res.status(202).json({
        success: true,

        message:
          "Avatar video generation is already in progress.",

        avatarVideo:
          serialize(activeJob),
      });
    }

    const job =
      await AvatarVideo.create({
        userId,
        twinId,
        productId,

        twinName:
          getTwinName(twin),

        productName:
          getProductName(product),

        posterUrl:
          imageUrl,

        speech: "",

        prompt: "",

        videoUrl: "",

        cloudinaryPublicId:
          "",

        providerJobId:
          "",

        providerResponse:
          null,

        status:
          "queued",

        progress: 5,

        currentStep: 1,

        error: "",

        startedAt:
          new Date(),

        completedAt:
          null,
      });

    startBackground({
      avatarVideoId:
        String(job._id),

      userId:
        String(userId),

      twinId,

      productId,
    });

    return res.status(202).json({
      success: true,

      message:
        "Avatar video generation started.",

      avatarVideo:
        serialize(job),
    });
  } catch (error) {
    console.error(
      "GENERATE AVATAR VIDEO ERROR:",
      error
    );

    return respondError(
      res,
      500,
      error?.message ||
        "Unable to start avatar video generation."
    );
  }
};

/* =========================================================
   GET AVATAR VIDEO STATUS
========================================================= */

exports.getAvatarVideoStatus =
  async (req, res) => {
    try {
      const userId =
        userIdOf(req);

      const twinId =
        text(req.params.twinId);

      const productId =
        text(req.query.productId);

      if (!userId) {
        return respondError(
          res,
          401,
          "Authentication required."
        );
      }

      if (!validId(twinId)) {
        return respondError(
          res,
          400,
          "Invalid AI Twin ID."
        );
      }

      if (
        productId &&
        !validId(productId)
      ) {
        return respondError(
          res,
          400,
          "Invalid product ID."
        );
      }

      const query = {
        userId,
        twinId,
      };

      if (productId) {
        query.productId =
          productId;
      }

      const job =
        await AvatarVideo.findOne(
          query
        ).sort({
          createdAt: -1,
        });

      if (!job) {
        return res.json({
          success: true,

          avatarVideo: {
            id: "",
            _id: "",

            userId:
              String(userId),

            twinId,

            productId:
              productId || "",

            status:
              "idle",

            progress: 0,

            currentStep: 0,

            videoUrl: "",

            posterUrl: "",

            speech: "",

            prompt: "",

            error: "",

            startedAt:
              null,

            completedAt:
              null,
          },
        });
      }

      return res.json({
        success: true,

        avatarVideo:
          serialize(job),
      });
    } catch (error) {
      console.error(
        "GET AVATAR VIDEO STATUS ERROR:",
        error
      );

      return respondError(
        res,
        500,
        error?.message ||
          "Unable to get avatar video status."
      );
    }
  };

/* =========================================================
   RETRY AVATAR VIDEO
========================================================= */

exports.retryAvatarVideo = async (
  req,
  res
) => {
  try {
    const userId =
      userIdOf(req);

    const twinId =
      text(req.params.twinId);

    const productId =
      text(req.body?.productId);

    if (!userId) {
      return respondError(
        res,
        401,
        "Authentication required."
      );
    }

    if (!validId(twinId)) {
      return respondError(
        res,
        400,
        "Invalid AI Twin ID."
      );
    }

    if (!validId(productId)) {
      return respondError(
        res,
        400,
        "Invalid product ID."
      );
    }

    const [
      twin,
      product,
      activeJob,
    ] = await Promise.all([
      Twin.findOne({
        _id: twinId,
        userId,
      }),

      Product.findOne({
        _id: productId,
        userId,
      }),

      AvatarVideo.findOne({
        userId,
        twinId,
        productId,

        status: {
          $in:
            ACTIVE_STATUSES,
        },
      }).sort({
        createdAt: -1,
      }),
    ]);

    if (!twin) {
      return respondError(
        res,
        404,
        "AI Twin not found."
      );
    }

    if (!product) {
      return respondError(
        res,
        404,
        "Product not found."
      );
    }

    if (activeJob) {
      return res.status(202).json({
        success: true,

        message:
          "Avatar video generation is already in progress.",

        avatarVideo:
          serialize(activeJob),
      });
    }

    const imageUrl =
      getTwinImage(twin);

    if (!imageUrl) {
      return respondError(
        res,
        400,
        "Upload an avatar image before generating a video."
      );
    }

    const failedJob =
      await AvatarVideo.findOne({
        userId,
        twinId,
        productId,
        status: "failed",
      }).sort({
        createdAt: -1,
      });

    let job;

    if (failedJob) {
      if (
        failedJob.cloudinaryPublicId
      ) {
        try {
          await deleteAvatarVideoAsset(
            failedJob
              .cloudinaryPublicId
          );
        } catch (cleanupError) {
          console.error(
            "FAILED VIDEO ASSET CLEANUP ERROR:",
            cleanupError?.message
          );
        }
      }

      failedJob.twinName =
        getTwinName(twin);

      failedJob.productName =
        getProductName(product);

      failedJob.posterUrl =
        imageUrl;

      failedJob.speech = "";

      failedJob.prompt = "";

      failedJob.videoUrl = "";

      failedJob.cloudinaryPublicId =
        "";

      failedJob.providerJobId =
        "";

      failedJob.providerResponse =
        null;

      failedJob.duration = 0;

      failedJob.resolution =
        "";

      failedJob.fileSize = 0;

      failedJob.mimeType =
        "video/mp4";

      failedJob.status =
        "queued";

      failedJob.progress = 5;

      failedJob.currentStep = 1;

      failedJob.error = "";

      failedJob.startedAt =
        new Date();

      failedJob.completedAt =
        null;

      job =
        await failedJob.save();
    } else {
      job =
        await AvatarVideo.create({
          userId,
          twinId,
          productId,

          twinName:
            getTwinName(twin),

          productName:
            getProductName(
              product
            ),

          posterUrl:
            imageUrl,

          speech: "",

          prompt: "",

          videoUrl: "",

          cloudinaryPublicId:
            "",

          providerJobId:
            "",

          providerResponse:
            null,

          duration: 0,

          resolution: "",

          fileSize: 0,

          mimeType:
            "video/mp4",

          status:
            "queued",

          progress: 5,

          currentStep: 1,

          error: "",

          startedAt:
            new Date(),

          completedAt:
            null,
        });
    }

    startBackground({
      avatarVideoId:
        String(job._id),

      userId:
        String(userId),

      twinId,

      productId,
    });

    return res.status(202).json({
      success: true,

      message:
        "Avatar video generation restarted.",

      avatarVideo:
        serialize(job),
    });
  } catch (error) {
    console.error(
      "RETRY AVATAR VIDEO ERROR:",
      error
    );

    return respondError(
      res,
      500,
      error?.message ||
        "Unable to restart avatar video generation."
    );
  }
};

/* =========================================================
   GET AVATAR VIDEO HISTORY
========================================================= */

exports.getAvatarVideoHistory =
  async (req, res) => {
    try {
      const userId =
        userIdOf(req);

      const twinId =
        text(req.params.twinId);

      const productId =
        text(req.query.productId);

      const status =
        text(
          req.query.status
        ).toLowerCase();

      const rawPage =
        Number.parseInt(
          req.query.page || "1",
          10
        );

      const rawLimit =
        Number.parseInt(
          req.query.limit || "10",
          10
        );

      const page =
        Number.isFinite(rawPage)
          ? Math.max(1, rawPage)
          : 1;

      const limit =
        Number.isFinite(rawLimit)
          ? Math.min(
              50,
              Math.max(
                1,
                rawLimit
              )
            )
          : 10;

      if (!userId) {
        return respondError(
          res,
          401,
          "Authentication required."
        );
      }

      if (!validId(twinId)) {
        return respondError(
          res,
          400,
          "Invalid AI Twin ID."
        );
      }

      if (
        productId &&
        !validId(productId)
      ) {
        return respondError(
          res,
          400,
          "Invalid product ID."
        );
      }

      if (
        status &&
        !ALLOWED_STATUSES.includes(
          status
        )
      ) {
        return respondError(
          res,
          400,
          "Invalid avatar video status."
        );
      }

      const query = {
        userId,
        twinId,
      };

      if (productId) {
        query.productId =
          productId;
      }

      if (status) {
        query.status =
          status;
      }

      const [
        items,
        total,
      ] = await Promise.all([
        AvatarVideo.find(query)
          .sort({
            createdAt: -1,
          })
          .skip(
            (page - 1) *
              limit
          )
          .limit(limit),

        AvatarVideo.countDocuments(
          query
        ),
      ]);

      return res.json({
        success: true,

        avatarVideos:
          items.map(serialize),

        pagination: {
          page,
          limit,
          total,

          totalPages:
            total > 0
              ? Math.ceil(
                  total / limit
                )
              : 0,
        },
      });
    } catch (error) {
      console.error(
        "GET AVATAR VIDEO HISTORY ERROR:",
        error
      );

      return respondError(
        res,
        500,
        error?.message ||
          "Unable to get avatar video history."
      );
    }
  };

/* =========================================================
   GET AVATAR VIDEO BY ID
========================================================= */

exports.getAvatarVideoById =
  async (req, res) => {
    try {
      const userId =
        userIdOf(req);

      const twinId =
        text(req.params.twinId);

      const videoId =
        text(req.params.videoId);

      if (!userId) {
        return respondError(
          res,
          401,
          "Authentication required."
        );
      }

      if (!validId(twinId)) {
        return respondError(
          res,
          400,
          "Invalid AI Twin ID."
        );
      }

      if (!validId(videoId)) {
        return respondError(
          res,
          400,
          "Invalid avatar video ID."
        );
      }

      const job =
        await AvatarVideo.findOne({
          _id: videoId,
          userId,
          twinId,
        });

      if (!job) {
        return respondError(
          res,
          404,
          "Avatar video not found."
        );
      }

      return res.json({
        success: true,

        avatarVideo:
          serialize(job),
      });
    } catch (error) {
      console.error(
        "GET AVATAR VIDEO BY ID ERROR:",
        error
      );

      return respondError(
        res,
        500,
        error?.message ||
          "Unable to get avatar video."
      );
    }
  };

/* =========================================================
   DELETE AVATAR VIDEO
========================================================= */

exports.deleteAvatarVideo =
  async (req, res) => {
    try {
      const userId =
        userIdOf(req);

      const twinId =
        text(req.params.twinId);

      const videoId =
        text(req.params.videoId);

      if (!userId) {
        return respondError(
          res,
          401,
          "Authentication required."
        );
      }

      if (!validId(twinId)) {
        return respondError(
          res,
          400,
          "Invalid AI Twin ID."
        );
      }

      if (!validId(videoId)) {
        return respondError(
          res,
          400,
          "Invalid avatar video ID."
        );
      }

      const job =
        await AvatarVideo.findOne({
          _id: videoId,
          userId,
          twinId,
        });

      if (!job) {
        return respondError(
          res,
          404,
          "Avatar video not found."
        );
      }

      if (
        ACTIVE_STATUSES.includes(
          job.status
        )
      ) {
        return respondError(
          res,
          409,
          "Avatar video generation is still in progress."
        );
      }

      if (
        job.cloudinaryPublicId
      ) {
        await deleteAvatarVideoAsset(
          job.cloudinaryPublicId
        );
      }

      await job.deleteOne();

      return res.json({
        success: true,

        message:
          "Avatar video deleted successfully.",

        deletedVideoId:
          String(job._id),
      });
    } catch (error) {
      console.error(
        "DELETE AVATAR VIDEO ERROR:",
        error
      );

      return respondError(
        res,
        500,
        error?.message ||
          "Unable to delete avatar video."
      );
    }
  };