const Twin =
  require("../../models/Twin");

const Product =
  require("../../models/Product");

const service = require("./twin.service");

const {
  processAvatarVideo,
} = require("./avatar-generation.service");

/* =========================================================
   HELPERS
========================================================= */

const getUserId = (req) =>
  req.user?._id || req.user?.id;

const fail = (
  res,
  error,
  fallbackMessage
) => {
  console.error(
    fallbackMessage,
    error
  );

  return res
    .status(
      error.statusCode || 500
    )
    .json({
      success: false,
      message:
        error.message ||
        fallbackMessage,
    });
};

const checkTwinLimit =
  async (user) => {
    const plan = String(
      user?.plan || "free"
    ).toLowerCase();

    const max =
      plan === "business"
        ? Infinity
        : plan === "pro"
        ? 3
        : 1;

    const count =
      await service.getTwinCount(
        user._id || user.id
      );

    if (
      Number.isFinite(max) &&
      count >= max
    ) {
      const error =
        new Error(
          `Your ${plan} plan supports only ${max} AI Twin(s).`
        );

      error.statusCode = 403;

      throw error;
    }
  };

/* =========================================================
   SAVE BASIC INFO
========================================================= */

exports.saveBasicInfo =
  async (req, res) => {
    try {
      await checkTwinLimit(
        req.user
      );

      const twin =
        await service.createBasicInfo(
          {
            userId:
              getUserId(req),
            payload:
              req.body,
          }
        );

      return res
        .status(201)
        .json({
          success: true,
          message:
            "AI Twin basic information saved successfully.",
          twin,
          data: {
            id: twin._id,
            twinId:
              twin._id,
            twin_id:
              twin._id,
            twin_name:
              twin.name,
          },
        });
    } catch (error) {
      return fail(
        res,
        error,
        "Unable to save basic information."
      );
    }
  };

/* =========================================================
   SAVE APPEARANCE
========================================================= */

/* =========================================================
   SAVE APPEARANCE
========================================================= */

exports.saveAppearance =
  async (req, res) => {
    try {
      const currentUserId =
        getUserId(req);

      const twin =
        await service.saveAppearance({
          userId:
            currentUserId,

          payload:
            req.body,

          file:
            req.file,
        });

      const avatarUrl =
        twin?.appearance
          ?.avatarUrl || "";

      if (!avatarUrl) {
        const error =
          new Error(
            "Avatar image URL was not saved."
          );

        error.statusCode = 400;

        throw error;
      }

      /*
       * Appearance upload only.
       *
       * Do not generate the Veo video here,
       * because a product has not been
       * selected yet.
       */

      twin.appearance.avatarVideoUrl =
        "";

      twin.appearance.avatarVideoPublicId =
        "";

      twin.appearance.avatarVideoStatus =
        "idle";

      twin.appearance.avatarVideoError =
        "";

      twin.appearance.avatarVideoOperation =
        "";

      twin.appearance.avatarVideoPrompt =
        "";

      twin.appearance.avatarVideoSpeech =
        "";

      twin.appearance.avatarVideoProductId =
        null;

      twin.appearance.avatarVideoProductName =
        "";

      twin.appearance.avatarVideoGeneratedAt =
        null;

      twin.appearance.provider =
        "veo";

      await twin.save();

      return res
        .status(201)
        .json({
          success: true,

          message:
            "Appearance saved successfully. Select a product to generate the AI Twin video.",

          processmessage:
            "Appearance saved. Product selection is required before video generation.",

          avatarVideoStatus:
            "idle",

          appearance:
            twin.appearance,

          twin,
        });
    } catch (error) {
      return fail(
        res,
        error,
        "Unable to save appearance."
      );
    }
  };

/* =========================================================
   GET AVATAR VIDEO STATUS
========================================================= */

/* =========================================================
   GET AVATAR VIDEO STATUS
========================================================= */

exports.getAvatarVideoStatus =
  async (req, res) => {
    try {
      const userId =
        req.user.id ||
        req.user._id;

      const twinId =
        req.params.twinId;

      const twin =
        await Twin.findOne({
          _id: twinId,
          userId,
        })
          .select(
            "name brandName appearance.avatarUrl appearance.avatarVideoUrl appearance.avatarVideoStatus appearance.avatarVideoError appearance.avatarVideoProductId appearance.avatarVideoProductName appearance.avatarVideoSpeech appearance.avatarVideoGeneratedAt"
          )
          .lean();

      if (!twin) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "AI Twin not found.",
          });
      }

      return res.json({
        success: true,

        data: {
          twinId:
            twin._id,

          brandName:
            twin.brandName,

          avatarUrl:
            twin.appearance
              ?.avatarUrl ||
            "",

          videoUrl:
            twin.appearance
              ?.avatarVideoUrl ||
            "",

          status:
            twin.appearance
              ?.avatarVideoStatus ||
            "idle",

          error:
            twin.appearance
              ?.avatarVideoError ||
            "",

          productId:
            twin.appearance
              ?.avatarVideoProductId ||
            null,

          productName:
            twin.appearance
              ?.avatarVideoProductName ||
            "",

          speech:
            twin.appearance
              ?.avatarVideoSpeech ||
            "",

          generatedAt:
            twin.appearance
              ?.avatarVideoGeneratedAt ||
            null,
        },
      });
    } catch (error) {
      console.error(
        "GET AVATAR VIDEO STATUS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            error.message ||
            "Unable to get avatar video status.",
        });
    }
  };

/* =========================================================
   RETRY AVATAR VIDEO
========================================================= */

exports.retryAvatarVideo = async (req, res) => {
  try {
    const currentUserId = getUserId(req);

    const twin = await service.getTwin({
      userId: currentUserId,
      twinId: req.params.id,
    });

    const avatarUrl =
      twin.appearance?.avatarUrl || "";

    if (!avatarUrl) {
      const error = new Error(
        "Upload an avatar image before generating a video."
      );

      error.statusCode = 400;
      throw error;
    }

    const productId =
      twin.appearance?.avatarVideoProductId;

    if (!productId) {
      const error = new Error(
        "No product is associated with this avatar video. Please generate a new product video."
      );

      error.statusCode = 400;
      throw error;
    }

    const product = await Product.findOne({
      _id: productId,
      userId: currentUserId,
      status: "active",
    }).lean();

    if (!product) {
      const error = new Error(
        "The associated product no longer exists."
      );

      error.statusCode = 404;
      throw error;
    }

    const status =
      twin.appearance?.avatarVideoStatus;

    if (
      status === "queued" ||
      status === "processing"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Avatar video generation is already running.",
        data: {
          twinId: twin._id,
          status,
        },
      });
    }

    twin.appearance.avatarVideoStatus =
      "queued";

    twin.appearance.avatarVideoError = "";
    twin.appearance.avatarVideoOperation = "";

    await twin.save();

    setImmediate(() => {
      processAvatarVideo({
        twinId: twin._id,
        userId: currentUserId,
        imageUrl: avatarUrl,
        twin,
        product,
      }).catch((error) => {
        console.error(
          "RETRY AVATAR VIDEO ERROR:",
          error
        );
      });
    });

    return res.status(202).json({
      success: true,
      message:
        "Avatar video generation restarted.",
      data: {
        twinId: twin._id,
        productId: product._id,
        productName: product.name,
        status: "queued",
      },
    });
  } catch (error) {
    return fail(
      res,
      error,
      "Unable to restart avatar video generation."
    );
  }
};


  /* =========================================================
   SAVE VOICE
========================================================= */

exports.saveVoice =
  async (req, res) => {
    try {
      const twin =
        await service.saveVoice({
          userId:
            getUserId(req),

          payload:
            req.body,

          file:
            req.file,
        });

      return res
        .status(201)
        .json({
          success: true,

          message:
            "AI Twin voice saved successfully.",

          voice:
            twin.voice,

          twin,
        });
    } catch (error) {
      return fail(
        res,
        error,
        "Unable to save voice."
      );
    }
  };

/* =========================================================
   SAVE GENERAL KNOWLEDGE
========================================================= */

exports.saveKnowledge =
  async (req, res) => {
    try {
      const result =
        await service.saveKnowledge({
          userId:
            getUserId(req),

          payload:
            req.body,

          file:
            req.file,
        });

      const chunks =
        Array.isArray(
          result.chunks
        )
          ? result.chunks.map(
              (chunk) => ({
                id:
                  chunk._id,

                title:
                  chunk.sourceTitle,

                content:
                  chunk.content,

                sourceType:
                  chunk.sourceType,

                sourceUrl:
                  chunk.sourceUrl || "",

                productId:
                  chunk.productId || null,

                status:
                  chunk.status,
              })
            )
          : [];

      return res
        .status(201)
        .json({
          success: true,

          message:
            "Knowledge processed and embedded successfully.",

          chunkCount:
            result.chunkCount ||
            chunks.length,

          chunks,

          twin:
            result.twin,
        });
    } catch (error) {
      return fail(
        res,
        error,
        "Unable to process knowledge."
      );
    }
  };

/* =========================================================
   TRAIN PRODUCT KNOWLEDGE
========================================================= */

exports.trainProduct =
  async (req, res) => {
    try {
      const result =
        await service.trainProduct({
          userId:
            getUserId(req),

          twinId:
            req.params.id,

          productId:
            req.params.productId,

          payload:
            req.body,

          file:
            req.file,
        });

      const chunks =
        Array.isArray(
          result.chunks
        )
          ? result.chunks.map(
              (chunk) => ({
                id:
                  chunk._id,

                title:
                  chunk.sourceTitle,

                content:
                  chunk.content,

                sourceType:
                  chunk.sourceType,

                sourceUrl:
                  chunk.sourceUrl || "",

                productId:
                  chunk.productId || null,

                status:
                  chunk.status,
              })
            )
          : [];

      return res
        .status(201)
        .json({
          success: true,

          message:
            "Product knowledge trained successfully.",

          chunkCount:
            result.chunkCount ||
            chunks.length,

          product:
            result.product || null,

          chunks,

          twin:
            result.twin,
        });
    } catch (error) {
      return fail(
        res,
        error,
        "Unable to train product."
      );
    }
  };


  /* =========================================================
   CHAT WITH AI TWIN
========================================================= */

exports.chatWithTwin =
  async (req, res) => {
    try {
      const result =
        await service.chat({
          userId:
            getUserId(req),

          payload:
            req.body,
        });

      return res.json({
        success: true,

        reply:
          result.reply,

        data:
          result,
      });
    } catch (error) {
      return fail(
        res,
        error,
        "Unable to chat with AI Twin."
      );
    }
  };

/* =========================================================
   TEXT TO SPEECH
========================================================= */

exports.textToSpeech =
  async (req, res) => {
    try {
      const result =
        await service.textToSpeech({
          userId:
            getUserId(req),

          payload:
            req.body,
        });

      return res.json({
        success: true,

        message:
          "Speech generated successfully.",

        data:
          result,
      });
    } catch (error) {
      return fail(
        res,
        error,
        "Unable to generate speech."
      );
    }
  };

/* =========================================================
   SPEECH TO TEXT
========================================================= */

exports.speechToText =
  async (req, res) => {
    try {
      const result =
        await service.speechToText({
          userId:
            getUserId(req),

          payload:
            req.body,

          file:
            req.file,
        });

      return res.json({
        success: true,

        message:
          "Speech transcribed successfully.",

        transcript:
          result.transcript,

        data:
          result,
      });
    } catch (error) {
      return fail(
        res,
        error,
        "Unable to transcribe speech."
      );
    }
  };

/* =========================================================
   SPEECH TO SPEECH
========================================================= */

exports.speechToSpeech =
  async (req, res) => {
    try {
      const result =
        await service.speechToSpeech({
          userId:
            getUserId(req),

          payload:
            req.body,

          file:
            req.file,
        });

      return res.json({
        success: true,

        message:
          "Speech conversation completed successfully.",

        transcript:
          result.transcript,

        reply:
          result.reply,

        audioUrl:
          result.audioUrl,

        conversationId:
          result.conversationId,

        productId:
          result.productId,

        sources:
          result.sources || [],

        data:
          result,
      });
    } catch (error) {
      return fail(
        res,
        error,
        "Unable to complete speech conversation."
      );
    }
  };

/* =========================================================
   CREATE TALKING AVATAR
========================================================= */

exports.createTalkingAvatar =
  async (req, res) => {
    try {
      const result =
        await service.createTalkingAvatar({
          userId:
            getUserId(req),

          payload:
            req.body,
        });

      return res
        .status(202)
        .json({
          success: true,

          message:
            "Talking avatar generation started.",

          data:
            result,
        });
    } catch (error) {
      return fail(
        res,
        error,
        "Unable to create talking avatar."
      );
    }
  };

/* =========================================================
   GET TALKING AVATAR STATUS
========================================================= */

exports.getTalkingAvatarStatus =
  async (req, res) => {
    try {
      const result =
        await service
          .getTalkingAvatarStatus({
            userId:
              getUserId(req),

            generationId:
              req.params
                .generationId,
          });

      return res.json({
        success: true,

        message:
          "Talking avatar status loaded successfully.",

        data:
          result,
      });
    } catch (error) {
      return fail(
        res,
        error,
        "Unable to load talking avatar status."
      );
    }
  };


  /* =========================================================
   GET ALL AI TWINS
========================================================= */

exports.getTwins =
  async (req, res) => {
    try {
      const twins =
        await service.getTwins(
          getUserId(req)
        );

      return res.json({
        success: true,

        count:
          twins.length,

        twins,
      });
    } catch (error) {
      return fail(
        res,
        error,
        "Unable to load AI Twins."
      );
    }
  };

/* =========================================================
   GET SINGLE AI TWIN
========================================================= */

exports.getTwin =
  async (req, res) => {
    try {
      const twin =
        await service.getTwin({
          userId:
            getUserId(req),

          twinId:
            req.params.id,
        });

      return res.json({
        success: true,
        twin,
      });
    } catch (error) {
      return fail(
        res,
        error,
        "Unable to load AI Twin."
      );
    }
  };

/* =========================================================
   GET KNOWLEDGE
========================================================= */

exports.getKnowledge =
  async (req, res) => {
    try {
      const knowledge =
        await service.getKnowledge({
          userId:
            getUserId(req),

          twinId:
            req.params.id,

          productId:
            req.query.productId ||
            null,
        });

      return res.json({
        success: true,

        count:
          knowledge.length,

        knowledge,
      });
    } catch (error) {
      return fail(
        res,
        error,
        "Unable to load knowledge."
      );
    }
  };

/* =========================================================
   GET CONVERSATIONS
========================================================= */

exports.getConversations =
  async (req, res) => {
    try {
      const conversations =
        await service.getConversations({
          userId:
            getUserId(req),

          twinId:
            req.params.id,
        });

      return res.json({
        success: true,

        conversations,
      });
    } catch (error) {
      return fail(
        res,
        error,
        "Unable to load conversations."
      );
    }
  };

/* =========================================================
   UPDATE AI TWIN
========================================================= */

exports.updateTwin =
  async (req, res) => {
    try {
      const twin =
        await service.updateTwin({
          userId:
            getUserId(req),

          twinId:
            req.params.id,

          payload:
            req.body,
        });

      return res.json({
        success: true,

        message:
          "AI Twin updated successfully.",

        twin,
      });
    } catch (error) {
      return fail(
        res,
        error,
        "Unable to update AI Twin."
      );
    }
  };

/* =========================================================
   DELETE AI TWIN
========================================================= */

exports.deleteTwin =
  async (req, res) => {
    try {
      const twin =
        await service.deleteTwin({
          userId:
            getUserId(req),

          twinId:
            req.params.id,
        });

      return res.json({
        success: true,

        message:
          "AI Twin deleted successfully.",

        deletedTwinId:
          twin._id,
      });
    } catch (error) {
      return fail(
        res,
        error,
        "Unable to delete AI Twin."
      );
    }
  };


  /* =========================================================
   GENERATE BRAND + PRODUCT AVATAR VIDEO
========================================================= */

exports.generateProductAvatarVideo =
  async (req, res) => {
    try {
      const userId =
        req.user.id ||
        req.user._id;

      const twinId =
        req.params.twinId;

      const {
        productId,
      } = req.body;

      if (!twinId) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Twin ID is required.",
          });
      }

      if (!productId) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Product ID is required.",
          });
      }

      const twin =
        await Twin.findOne({
          _id: twinId,
          userId,
        }).lean();

      if (!twin) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "AI Twin not found or access denied.",
          });
      }

      if (
        !twin?.appearance
          ?.avatarUrl
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Please upload an avatar image first.",
          });
      }

      const product =
        await Product.findOne({
          _id: productId,
          userId,
          status: "active",
        }).lean();

      if (!product) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Active product not found or access denied.",
          });
      }

      await Twin.findOneAndUpdate(
        {
          _id: twinId,
          userId,
        },
        {
          $set: {
            "appearance.avatarVideoStatus":
              "queued",

            "appearance.avatarVideoError":
              "",

            "appearance.avatarVideoProductId":
              product._id,

            "appearance.avatarVideoProductName":
              product.name,
          },

          $addToSet: {
            productIds:
              product._id,
          },
        }
      );

      /*
       * Run generation in the background.
       * Do not await this process because Veo may take several minutes.
       */

      processAvatarVideo({
        twinId:
          twin._id,

        userId,

        imageUrl:
          twin.appearance
            .avatarUrl,

        twin,

        product,
      }).catch((error) => {
        console.error(
          "BACKGROUND AVATAR VIDEO ERROR:",
          error.message
        );
      });

      return res
        .status(202)
        .json({
          success: true,

          message:
            "Brand and product avatar video generation started.",

          data: {
            twinId:
              twin._id,

            productId:
              product._id,

            productName:
              product.name,

            status:
              "queued",
          },
        });
    } catch (error) {
      console.error(
        "GENERATE PRODUCT AVATAR VIDEO ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            error.message ||
            "Unable to start avatar video generation.",
        });
    }
  };