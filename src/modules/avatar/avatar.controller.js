const mongoose = require("mongoose");

const MarketplaceAvatar = require(
  "../../models/MarketplaceAvatar"
);

const User = require(
  "../../models/User"
);

const CreditTransaction = require(
  "../../models/CreditTransaction"
);

/*
 * This service handles D-ID/WebRTC
 * streaming avatar sessions.
 */
const avatarService = require(
  "./avatar.service"
);

/* =========================================================
   HELPERS
========================================================= */

const getUserId = (req) => {
  return (
    req.user?._id ||
    req.user?.id
  );
};

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(
    id
  );
};

const getStatusCode = (
  error,
  fallback = 500
) => {
  if (error?.statusCode) {
    return error.statusCode;
  }

  const message = String(
    error?.message || ""
  ).toLowerCase();

  if (
    message.includes("not found")
  ) {
    return 404;
  }

  if (
    message.includes("invalid") ||
    message.includes("required") ||
    message.includes("missing") ||
    message.includes("not active") ||
    message.includes("already unlocked") ||
    message.includes("not enough")
  ) {
    return 400;
  }

  return fallback;
};

const sendError = (
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
      getStatusCode(error)
    )
    .json({
      success: false,

      message:
        error?.message ||
        fallbackMessage,
    });
};

/* =========================================================
   MARKETPLACE — GET ALL AVATARS
========================================================= */

exports.getAvatars = async (
  req,
  res
) => {
  try {
    const {
      category,
      featured,
      search,
      sort = "featured",
    } = req.query;

    const filter = {
      active: true,
    };

    if (
      category &&
      category !== "All"
    ) {
      filter.category =
        category;
    }

    if (
      featured === "true"
    ) {
      filter.featured =
        true;
    }

    const normalizedSearch =
      String(search || "").trim();

    if (normalizedSearch) {
      filter.$or = [
        {
          name: {
            $regex:
              normalizedSearch,

            $options: "i",
          },
        },

        {
          description: {
            $regex:
              normalizedSearch,

            $options: "i",
          },
        },

        {
          category: {
            $regex:
              normalizedSearch,

            $options: "i",
          },
        },
      ];
    }

    let sortQuery = {
      featured: -1,
      createdAt: -1,
    };

    if (
      sort === "credits-low"
    ) {
      sortQuery = {
        credits: 1,
        createdAt: -1,
      };
    }

    if (
      sort === "credits-high"
    ) {
      sortQuery = {
        credits: -1,
        createdAt: -1,
      };
    }

    if (
      sort === "newest"
    ) {
      sortQuery = {
        createdAt: -1,
      };
    }

    if (
      sort === "name"
    ) {
      sortQuery = {
        name: 1,
      };
    }

    const [
      avatars,
      user,
    ] = await Promise.all([
      MarketplaceAvatar.find(
        filter
      )
        .sort(sortQuery)
        .lean(),

      User.findById(
        getUserId(req)
      )
        .select(
          "credits unlockedAvatars"
        )
        .lean(),
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found.",
      });
    }

    const unlockedIds =
      new Set(
        (
          user.unlockedAvatars ||
          []
        ).map((id) =>
          String(id)
        )
      );

    const result =
      avatars.map(
        (avatar) => ({
          ...avatar,

          unlocked:
            unlockedIds.has(
              String(
                avatar._id
              )
            ),
        })
      );

    return res.json({
      success: true,

      credits:
        Number(
          user.credits || 0
        ),

      count:
        result.length,

      avatars:
        result,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to fetch avatars."
    );
  }
};

/* =========================================================
   MARKETPLACE — GET UNLOCKED AVATARS
========================================================= */

exports.getUnlockedAvatars =
  async (req, res) => {
    try {
      const user =
        await User.findById(
          getUserId(req)
        )
          .select(
            "credits unlockedAvatars"
          )
          .populate({
            path:
              "unlockedAvatars",

            match: {
              active: true,
            },
          });

      if (!user) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "User not found.",
          });
      }

      return res.json({
        success: true,

        credits:
          Number(
            user.credits || 0
          ),

        count:
          user.unlockedAvatars
            ?.length || 0,

        avatars:
          user.unlockedAvatars ||
          [],
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Unable to fetch unlocked avatars."
      );
    }
  };

/* =========================================================
   MARKETPLACE — UNLOCK AVATAR
========================================================= */

exports.unlockAvatar =
  async (req, res) => {
    try {
      const avatarId =
        String(
          req.params.avatarId ||
            ""
        ).trim();

      if (
        !isValidObjectId(
          avatarId
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid avatar ID.",
          });
      }

      const avatar =
        await MarketplaceAvatar.findOne({
          _id: avatarId,
          active: true,
        });

      if (!avatar) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Avatar not found.",
          });
      }

      const userId =
        getUserId(req);

      const existingUser =
        await User.findById(
          userId
        ).select(
          "credits unlockedAvatars"
        );

      if (!existingUser) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "User not found.",
          });
      }

      const alreadyUnlocked =
        (
          existingUser.unlockedAvatars ||
          []
        ).some(
          (id) =>
            String(id) ===
            String(
              avatar._id
            )
        );

      if (
        alreadyUnlocked
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Avatar already unlocked.",
          });
      }

      const avatarCredits =
        Number(
          avatar.credits || 0
        );

      /*
       * Atomic update:
       * - checks sufficient credits
       * - checks avatar isn't unlocked
       * - deducts credits
       * - adds avatar to unlocked list
       */
      const updatedUser =
        await User.findOneAndUpdate(
          {
            _id: userId,

            credits: {
              $gte:
                avatarCredits,
            },

            unlockedAvatars: {
              $ne:
                avatar._id,
            },
          },

          {
            $inc: {
              credits:
                -avatarCredits,
            },

            $addToSet: {
              unlockedAvatars:
                avatar._id,
            },
          },

          {
            new: true,
            runValidators: true,
          }
        ).select(
          "credits unlockedAvatars"
        );

      if (!updatedUser) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Not enough credits or avatar already unlocked.",
          });
      }

      try {
        await CreditTransaction.create({
          userId,

          type:
            "avatar_unlock",

          credits:
            -avatarCredits,

          balanceAfter:
            updatedUser.credits,

          avatarId:
            avatar._id,

          description:
            `Unlocked ${avatar.name}`,
        });
      } catch (
        transactionError
      ) {
        /*
         * Log transaction history failure.
         * The avatar unlock itself has already
         * completed successfully.
         */
        console.error(
          "CREDIT TRANSACTION ERROR:",
          transactionError
        );
      }

      return res.json({
        success: true,

        message:
          `${avatar.name} unlocked successfully.`,

        credits:
          updatedUser.credits,

        avatar: {
          ...avatar.toObject(),

          unlocked: true,
        },
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Unable to unlock avatar."
      );
    }
  };

/* =========================================================
   MARKETPLACE — CREDIT HISTORY
========================================================= */

exports.getCreditHistory =
  async (req, res) => {
    try {
      const transactions =
        await CreditTransaction.find({
          userId:
            getUserId(req),
        })
          .populate(
            "avatarId",
            "name image description category"
          )
          .sort({
            createdAt: -1,
          })
          .limit(100)
          .lean();

      return res.json({
        success: true,

        count:
          transactions.length,

        transactions,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Unable to fetch credit history."
      );
    }
  };

/* =========================================================
   STREAMING AVATAR — CREATE WEBRTC SESSION
========================================================= */

exports.createSession =
  async (req, res) => {
    try {
      const {
        twinId,
        realtimeSessionId,
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

      const result =
        await avatarService.createSession({
          userId:
            getUserId(req),

          twinId,

          realtimeSessionId:
            realtimeSessionId ||
            null,
        });

      return res
        .status(201)
        .json({
          success: true,

          message:
            "Avatar streaming session created.",

          ...result,
        });
    } catch (error) {
      return sendError(
        res,
        error,
        "Unable to create avatar session."
      );
    }
  };

/* =========================================================
   STREAMING AVATAR — SUBMIT WEBRTC ANSWER
========================================================= */

exports.submitAnswer =
  async (req, res) => {
    try {
      const answer =
        req.body?.answer;

      if (
        !answer ||
        !answer.type ||
        !answer.sdp
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "A valid WebRTC SDP answer is required.",
          });
      }

      const session =
        await avatarService.submitAnswer({
          userId:
            getUserId(req),

          avatarSessionId:
            req.params.id,

          answer,
        });

      return res.json({
        success: true,

        message:
          "Avatar WebRTC connection established.",

        session,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Unable to submit avatar SDP answer."
      );
    }
  };

/* =========================================================
   STREAMING AVATAR — ADD ICE CANDIDATE
========================================================= */

exports.addIceCandidate =
  async (req, res) => {
    try {
      const {
        candidate = null,
        sdpMid = null,
        sdpMLineIndex = null,
      } = req.body || {};

      const result =
        await avatarService.addIceCandidate({
          userId:
            getUserId(req),

          avatarSessionId:
            req.params.id,

          candidate,

          sdpMid,

          sdpMLineIndex,
        });

      return res.json({
        success: true,

        message:
          candidate === null
            ? "ICE gathering completed."
            : "ICE candidate added.",

        result,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Unable to add ICE candidate."
      );
    }
  };

/* =========================================================
   STREAMING AVATAR — SPEAK
========================================================= */

exports.speak =
  async (req, res) => {
    try {
      const text =
        String(
          req.body?.text || ""
        ).trim();

      if (!text) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Avatar speech text is required.",
          });
      }

      const result =
        await avatarService.speak({
          userId:
            getUserId(req),

          avatarSessionId:
            req.params.id,

          text,
        });

      return res.json({
        success: true,

        message:
          "Avatar speech started.",

        result,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Unable to make avatar speak."
      );
    }
  };

/* =========================================================
   STREAMING AVATAR — END SESSION
========================================================= */

exports.endSession =
  async (req, res) => {
    try {
      const session =
        await avatarService.endSession({
          userId:
            getUserId(req),

          avatarSessionId:
            req.params.id,
        });

      return res.json({
        success: true,

        message:
          "Avatar session ended successfully.",

        session,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Unable to end avatar session."
      );
    }
  };