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
  generateAvatarVideo,
  downloadGeneratedVideo,
  cleanupGeneratedVideoFile,
} = require(
  "./videoGeneration.service"
);

const {
  buildBrandProductSpeech,
} = require(
  "./speech.service"
);

const {
  buildAvatarVideoPrompt,
} = require(
  "./prompt.service"
);

const {
  uploadVideoToCloudinary,
  deleteVideoFromCloudinary,
} = require(
  "./cloudinary.service"
);

/* =========================================================
   HELPERS
========================================================= */

const id = (value) => {
  return String(
    value?._id ||
      value ||
      ""
  ).trim();
};

const messageOf = (error) => {
  return (
    error?.response?.data?.error
      ?.message ||
    error?.response?.data
      ?.message ||
    error?.message ||
    "Avatar video generation failed."
  );
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

const getProductName = (
  product
) => {
  return (
    product?.name ||
    product?.productName ||
    product?.title ||
    "Product"
  );
};

const assertObjectId = (
  value,
  label
) => {
  if (
    !mongoose.Types.ObjectId.isValid(
      value
    )
  ) {
    throw new Error(
      `Invalid ${label}.`
    );
  }
};

/* =========================================================
   UPDATE AVATAR VIDEO JOB
========================================================= */

const updateJob = (
  avatarVideoId,
  userId,
  values
) => {
  return AvatarVideo.findOneAndUpdate(
    {
      _id: avatarVideoId,
      userId,
    },
    {
      $set: values,
    },
    {
      new: true,
      runValidators: true,
    }
  );
};

/* =========================================================
   UPDATE TWIN VIDEO STATE SAFELY
========================================================= */

const updateTwinSafely = async (
  twinId,
  userId,
  values
) => {
  try {
    await Twin.findOneAndUpdate(
      {
        _id: twinId,
        userId,
      },
      {
        $set: values,
      },
      {
        runValidators: false,
      }
    );
  } catch (error) {
    console.error(
      "UPDATE TWIN VIDEO STATE ERROR:",
      messageOf(error)
    );
  }
};

/* =========================================================
   PROCESS AVATAR VIDEO
========================================================= */

const processAvatarVideo =
  async ({
    avatarVideoId,
    userId,
    twinId,
    productId,
  }) => {
    const ids = {
      avatarVideoId:
        id(avatarVideoId),

      userId:
        id(userId),

      twinId:
        id(twinId),

      productId:
        id(productId),
    };

    Object.entries(ids).forEach(
      ([key, value]) => {
        assertObjectId(
          value,
          key
        );
      }
    );

    let temporaryFilePath = "";
    let uploadedPublicId = "";

    try {
      /* =====================================================
         LOAD JOB, TWIN AND PRODUCT
      ===================================================== */

      const [
        job,
        twin,
        product,
      ] = await Promise.all([
        AvatarVideo.findOne({
          _id:
            ids.avatarVideoId,

          userId:
            ids.userId,

          twinId:
            ids.twinId,

          productId:
            ids.productId,
        }),

        Twin.findOne({
          _id:
            ids.twinId,

          userId:
            ids.userId,
        }),

        Product.findOne({
          _id:
            ids.productId,

          userId:
            ids.userId,
        }),
      ]);

      if (!job) {
        throw new Error(
          "Avatar video record not found."
        );
      }

      if (!twin) {
        throw new Error(
          "AI Twin not found."
        );
      }

      if (!product) {
        throw new Error(
          "Product not found."
        );
      }

      if (
        job.status ===
        "completed"
      ) {
        return job;
      }

      /* =====================================================
         VALIDATE TWIN AVATAR IMAGE
      ===================================================== */

      const imageUrl =
        getTwinImage(twin);

      if (!imageUrl) {
        throw new Error(
          "The selected AI Twin has no avatar image."
        );
      }

      /* =====================================================
         GENERATE SPEECH
      ===================================================== */

      await updateJob(
        ids.avatarVideoId,
        ids.userId,
        {
          status:
            "processing",

          progress: 15,

          currentStep: 2,

          startedAt:
            job.startedAt ||
            new Date(),

          completedAt:
            null,

          error: "",
        }
      );

      const speech =
        await buildBrandProductSpeech(
          {
            twin,
            product,
          }
        );

      if (
        !speech ||
        !String(speech).trim()
      ) {
        throw new Error(
          "Unable to generate product speech."
        );
      }

      /* =====================================================
         GENERATE VIDEO PROMPT
      ===================================================== */

      const prompt =
        await buildAvatarVideoPrompt(
          {
            twin,
            product,
            speech,
            imageUrl,
          }
        );

      if (
        !prompt ||
        !String(prompt).trim()
      ) {
        throw new Error(
          "Unable to generate avatar video prompt."
        );
      }

      /* =====================================================
         SAVE SPEECH AND PROMPT
      ===================================================== */

      await updateJob(
        ids.avatarVideoId,
        ids.userId,
        {
          twinName:
            getTwinName(twin),

          productName:
            getProductName(
              product
            ),

          posterUrl:
            imageUrl,

          speech:
            String(
              speech
            ).trim(),

          prompt:
            String(
              prompt
            ).trim(),

          status:
            "processing",

          progress: 30,

          currentStep: 2,

          startedAt:
            job.startedAt ||
            new Date(),

          completedAt:
            null,

          error: "",
        }
      );

      await updateTwinSafely(
        ids.twinId,
        ids.userId,
        {
          avatarVideoStatus:
            "processing",

          avatarVideoSpeech:
            String(
              speech
            ).trim(),

          avatarVideoProductId:
            ids.productId,

          avatarVideoProductName:
            getProductName(
              product
            ),

          avatarVideoError: "",
        }
      );

      /* =====================================================
         START VIDEO GENERATION
      ===================================================== */

      await updateJob(
        ids.avatarVideoId,
        ids.userId,
        {
          status:
            "generating",

          progress: 45,

          currentStep: 3,

          error: "",
        }
      );

      await updateTwinSafely(
        ids.twinId,
        ids.userId,
        {
          avatarVideoStatus:
            "generating",

          avatarVideoError: "",
        }
      );

      const generationResult =
        await generateAvatarVideo(
          {
            imageUrl,
            twin,
            product,
            speech:
              String(
                speech
              ).trim(),

            prompt:
              String(
                prompt
              ).trim(),
          }
        );

      if (!generationResult) {
        throw new Error(
          "Video generation provider returned no result."
        );
      }

      /* =====================================================
         VIDEO GENERATED — PREPARE DOWNLOAD
      ===================================================== */

      await updateJob(
        ids.avatarVideoId,
        ids.userId,
        {
          status:
            "rendering",

          progress: 68,

          currentStep: 4,

          providerJobId:
            generationResult
              .providerJobId ||
            generationResult
              .operationName ||
            "",

          providerResponse:
            generationResult
              .providerResponse ||
            null,

          error: "",
        }
      );

      await updateTwinSafely(
        ids.twinId,
        ids.userId,
        {
          avatarVideoStatus:
            "rendering",

          avatarVideoError: "",
        }
      );

      /* =====================================================
         DOWNLOAD GENERATED VIDEO
      ===================================================== */

      temporaryFilePath =
        await downloadGeneratedVideo(
          {
            generationResult,

            avatarVideoId:
              ids.avatarVideoId,
          }
        );

      if (!temporaryFilePath) {
        throw new Error(
          "Unable to download the generated avatar video."
        );
      }


            /* =====================================================
         MARK VIDEO AS UPLOADING
      ===================================================== */

      await updateJob(
        ids.avatarVideoId,
        ids.userId,
        {
          status:
            "uploading",

          progress: 90,

          currentStep: 5,

          error: "",
        }
      );

      await updateTwinSafely(
        ids.twinId,
        ids.userId,
        {
          avatarVideoStatus:
            "uploading",

          avatarVideoError: "",
        }
      );

      /* =====================================================
         UPLOAD VIDEO TO CLOUDINARY
      ===================================================== */

      const upload =
        await uploadVideoToCloudinary(
          {
            filePath:
              temporaryFilePath,

            folder:
              process.env
                .CLOUDINARY_AVATAR_VIDEO_FOLDER ||
              "twinn/avatar-videos",

            publicId:
              `avatar-video-${ids.avatarVideoId}`,

            overwrite: true,
          }
        );

      if (!upload) {
        throw new Error(
          "Cloudinary upload returned no result."
        );
      }

      if (!upload.secureUrl) {
        throw new Error(
          "Cloudinary did not return a secure video URL."
        );
      }

      uploadedPublicId =
        upload.publicId || "";

      /* =====================================================
         BUILD FINAL VIDEO METADATA
      ===================================================== */

      const width =
        Number(
          upload.width || 0
        );

      const height =
        Number(
          upload.height || 0
        );

      const resolution =
        width > 0 &&
        height > 0
          ? `${width}x${height}`
          : generationResult
              .resolution ||
            "1280x720";

      const duration =
        Number(
          upload.duration ||
            generationResult
              .duration ||
            0
        );

      const fileSize =
        Number(
          upload.bytes ||
            generationResult
              .fileSize ||
            0
        );

      const mimeType =
        generationResult
          .mimeType ||
        upload.resourceType ||
        "video/mp4";

      /* =====================================================
         MARK JOB AS COMPLETED
      ===================================================== */

      const completed =
        await updateJob(
          ids.avatarVideoId,
          ids.userId,
          {
            videoUrl:
              upload.secureUrl,

            cloudinaryPublicId:
              upload.publicId ||
              "",

            duration,

            resolution,

            fileSize,

            mimeType,

            status:
              "completed",

            progress: 100,

            currentStep: 6,

            error: "",

            completedAt:
              new Date(),
          }
        );

      if (!completed) {
        throw new Error(
          "Unable to save completed avatar video."
        );
      }

      /* =====================================================
         UPDATE TWIN WITH FINAL VIDEO
      ===================================================== */

      await updateTwinSafely(
        ids.twinId,
        ids.userId,
        {
          avatarVideoStatus:
            "completed",

          avatarVideoUrl:
            upload.secureUrl,

          avatarVideoSpeech:
            String(
              speech
            ).trim(),

          avatarVideoProductId:
            ids.productId,

          avatarVideoProductName:
            getProductName(
              product
            ),

          avatarVideoError: "",

          avatarVideoGeneratedAt:
            new Date(),
        }
      );

      return completed;

          /* =====================================================
       ERROR HANDLING
    ===================================================== */

    }catch (error) {
      /* ---------------------------------------------
         DELETE ORPHAN CLOUDINARY FILE
      --------------------------------------------- */

      if (uploadedPublicId) {
        try {
          await deleteVideoFromCloudinary(
            uploadedPublicId
          );
        } catch (cleanupError) {
          console.error(
            "ORPHAN VIDEO CLEANUP ERROR:",
            messageOf(cleanupError)
          );
        }
      }

      const errorMessage =
        messageOf(error);

      /* ---------------------------------------------
         UPDATE JOB AS FAILED
      --------------------------------------------- */

      await updateJob(
        ids.avatarVideoId,
        ids.userId,
        {
          status: "failed",

          progress: 0,

          currentStep: 0,

          error: errorMessage,

          completedAt:
            new Date(),
        }
      );

      /* ---------------------------------------------
         UPDATE TWIN STATE
      --------------------------------------------- */

      await updateTwinSafely(
        ids.twinId,
        ids.userId,
        {
          avatarVideoStatus:
            "failed",

          avatarVideoError:
            errorMessage,
        }
      );

      console.error(
        "PROCESS AVATAR VIDEO ERROR:",
        errorMessage
      );

      throw new Error(
        errorMessage
      );
    }

    /* =====================================================
       FINALLY
    ===================================================== */

    finally {
      if (temporaryFilePath) {
        await cleanupGeneratedVideoFile(
          temporaryFilePath
        ).catch(
          (cleanupError) => {
            console.error(
              "TEMP VIDEO CLEANUP ERROR:",
              messageOf(
                cleanupError
              )
            );
          }
        );
      }
    }
  };


  /* =========================================================
   DELETE AVATAR VIDEO ASSET
========================================================= */

const deleteAvatarVideoAsset = async (
  cloudinaryPublicId
) => {
  if (!cloudinaryPublicId) {
    return {
      success: true,
      skipped: true,
    };
  }

  const result =
    await deleteVideoFromCloudinary(
      cloudinaryPublicId
    );

  return {
    success: true,
    skipped: false,
    result,
  };
};

/* =========================================================
   FAIL STALE AVATAR VIDEO JOBS
========================================================= */

const failStaleAvatarVideoJobs = async ({
  olderThanMinutes = 60,
} = {}) => {
  const parsedMinutes = Number(
    olderThanMinutes
  );

  const safeMinutes =
    Number.isFinite(parsedMinutes) &&
    parsedMinutes > 0
      ? parsedMinutes
      : 60;

  const cutoff = new Date(
    Date.now() -
      safeMinutes * 60 * 1000
  );

  const staleStatuses = [
    "queued",
    "processing",
    "generating",
    "rendering",
    "uploading",
  ];

  const result =
    await AvatarVideo.updateMany(
      {
        status: {
          $in: staleStatuses,
        },

        updatedAt: {
          $lt: cutoff,
        },
      },
      {
        $set: {
          status: "failed",

          progress: 0,

          currentStep: 0,

          error:
            "Generation stopped before completion. Please retry.",

          completedAt:
            new Date(),
        },
      }
    );

  return result;
};

/* =========================================================
   GET ACTIVE AVATAR VIDEO JOB
========================================================= */

const getActiveAvatarVideoJob =
  async ({
    userId,
    twinId,
    productId,
  }) => {
    const safeUserId = id(userId);
    const safeTwinId = id(twinId);
    const safeProductId =
      id(productId);

    assertObjectId(
      safeUserId,
      "userId"
    );

    assertObjectId(
      safeTwinId,
      "twinId"
    );

    assertObjectId(
      safeProductId,
      "productId"
    );

    return AvatarVideo.findOne({
      userId: safeUserId,

      twinId: safeTwinId,

      productId: safeProductId,

      status: {
        $in: [
          "queued",
          "processing",
          "generating",
          "rendering",
          "uploading",
        ],
      },
    }).sort({
      createdAt: -1,
    });
  };

/* =========================================================
   GET LATEST AVATAR VIDEO JOB
========================================================= */

const getLatestAvatarVideoJob =
  async ({
    userId,
    twinId,
    productId,
  }) => {
    const safeUserId = id(userId);
    const safeTwinId = id(twinId);
    const safeProductId =
      id(productId);

    assertObjectId(
      safeUserId,
      "userId"
    );

    assertObjectId(
      safeTwinId,
      "twinId"
    );

    if (safeProductId) {
      assertObjectId(
        safeProductId,
        "productId"
      );
    }

    const query = {
      userId: safeUserId,
      twinId: safeTwinId,
    };

    if (safeProductId) {
      query.productId =
        safeProductId;
    }

    return AvatarVideo.findOne(
      query
    ).sort({
      createdAt: -1,
    });
  };

/* =========================================================
   RESET FAILED AVATAR VIDEO JOB
========================================================= */

const resetFailedAvatarVideoJob =
  async ({
    avatarVideoId,
    userId,
    posterUrl = "",
    twinName = "",
    productName = "",
  }) => {
    const safeAvatarVideoId =
      id(avatarVideoId);

    const safeUserId =
      id(userId);

    assertObjectId(
      safeAvatarVideoId,
      "avatarVideoId"
    );

    assertObjectId(
      safeUserId,
      "userId"
    );

    return AvatarVideo.findOneAndUpdate(
      {
        _id: safeAvatarVideoId,
        userId: safeUserId,
        status: "failed",
      },
      {
        $set: {
          twinName:
            String(
              twinName || ""
            ).trim(),

          productName:
            String(
              productName || ""
            ).trim(),

          posterUrl:
            String(
              posterUrl || ""
            ).trim(),

          speech: "",

          prompt: "",

          videoUrl: "",

          cloudinaryPublicId:
            "",

          providerJobId: "",

          providerResponse:
            null,

          duration: 0,

          resolution: "",

          fileSize: 0,

          mimeType:
            "video/mp4",

          status: "queued",

          progress: 5,

          currentStep: 1,

          error: "",

          startedAt:
            new Date(),

          completedAt:
            null,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );
  };

/* =========================================================
   DELETE OLD CLOUDINARY ASSET SAFELY
========================================================= */

const deleteOldVideoAssetSafely =
  async (
    cloudinaryPublicId
  ) => {
    if (!cloudinaryPublicId) {
      return {
        success: true,
        skipped: true,
      };
    }

    try {
      return await deleteAvatarVideoAsset(
        cloudinaryPublicId
      );
    } catch (error) {
      console.error(
        "DELETE OLD AVATAR VIDEO ASSET ERROR:",
        messageOf(error)
      );

      return {
        success: false,
        skipped: false,
        error:
          messageOf(error),
      };
    }
  };

/* =========================================================
   MODULE EXPORTS
========================================================= */

module.exports = {
  processAvatarVideo,

  deleteAvatarVideoAsset,

  deleteOldVideoAssetSafely,

  failStaleAvatarVideoJobs,

  getActiveAvatarVideoJob,

  getLatestAvatarVideoJob,

  resetFailedAvatarVideoJob,
};