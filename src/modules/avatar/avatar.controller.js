const mongoose = require(
  "mongoose"
);

const MarketplaceAvatar = require(
  "../../models/MarketplaceAvatar"
);

const User = require(
  "../../models/User"
);

const CreditTransaction = require(
  "../../models/CreditTransaction"
);

const avatarSessionService = require(
  "./avatarSession.service"
);

/* =========================================================
   HELPERS
========================================================= */

const getUserId = (req) => {
  const userId =
    req.user?._id ||
    req.user?.id;

  if (!userId) {
    const error = new Error(
      "Authenticated user is required."
    );

    error.statusCode = 401;

    throw error;
  }

  return userId;
};

const isValidObjectId = (
  id
) => {
  return mongoose.Types.ObjectId
    .isValid(id);
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
    message.includes(
      "not found"
    )
  ) {
    return 404;
  }

  if (
    message.includes(
      "invalid"
    ) ||
    message.includes(
      "required"
    ) ||
    message.includes(
      "missing"
    ) ||
    message.includes(
      "not active"
    ) ||
    message.includes(
      "already unlocked"
    ) ||
    message.includes(
      "not enough"
    )
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
   GET MARKETPLACE AVATARS
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
      String(
        search || ""
      ).trim();

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
      sort ===
      "credits-low"
    ) {
      sortQuery = {
        credits: 1,
        createdAt: -1,
      };
    }

    if (
      sort ===
      "credits-high"
    ) {
      sortQuery = {
        credits: -1,
        createdAt: -1,
      };
    }

    if (sort === "newest") {
      sortQuery = {
        createdAt: -1,
      };
    }

    if (sort === "name") {
      sortQuery = {
        name: 1,
      };
    }

    const [avatars, user] =
      await Promise.all([
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
      return res
        .status(404)
        .json({
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

    const avatarsWithStatus =
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
        avatarsWithStatus
          .length,

      avatars:
        avatarsWithStatus,
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
   GET UNLOCKED AVATARS
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
   UNLOCK AVATAR
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
        await MarketplaceAvatar
          .findOne({
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
          existingUser
            .unlockedAvatars ||
          []
        ).some(
          (id) =>
            String(id) ===
            String(
              avatar._id
            )
        );

      if (alreadyUnlocked) {
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

      const updatedUser =
        await User
          .findOneAndUpdate(
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
          )
          .select(
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
        await CreditTransaction
          .create({
            userId,

            type:
              "avatar_unlock",

            credits:
              -avatarCredits,

            balanceAfter:
              updatedUser
                .credits,

            avatarId:
              avatar._id,

            description:
              `Unlocked ${avatar.name}`,
          });
      } catch (
        transactionError
      ) {
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
   CREDIT HISTORY
========================================================= */

exports.getCreditHistory =
  async (req, res) => {
    try {
      const transactions =
        await CreditTransaction
          .find({
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
   CREATE STREAMING SESSION
========================================================= */

exports.createSession =
  async (req, res) => {
    try {
      const result =
        await avatarSessionService
          .createSession({
            userId:
              getUserId(req),

            twinId:
              req.body.twinId ||
              req.body.twin_id,

            realtimeSessionId:
              req.body
                .realtimeSessionId ||
              null,
          });

      return res
        .status(201)
        .json({
          success: true,

          message:
            "Avatar streaming session created.",

          data: result,
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
   SUBMIT ANSWER
========================================================= */

exports.submitAnswer =
  async (req, res) => {
    try {
      const session =
        await avatarSessionService
          .submitAnswer({
            userId:
              getUserId(req),

            avatarSessionId:
              req.params.id,

            answer:
              req.body.answer,
          });

      return res.json({
        success: true,

        message:
          "Avatar WebRTC connection established.",

        data: session,
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
   ADD ICE CANDIDATE
========================================================= */

exports.addIceCandidate =
  async (req, res) => {
    try {
      const result =
        await avatarSessionService
          .addIceCandidate({
            userId:
              getUserId(req),

            avatarSessionId:
              req.params.id,

            candidate:
              req.body
                ?.candidate ??
              null,

            sdpMid:
              req.body?.sdpMid ??
              null,

            sdpMLineIndex:
              req.body
                ?.sdpMLineIndex ??
              null,
          });

      return res.json({
        success: true,

        message:
          result.completed
            ? "ICE gathering completed."
            : "ICE candidate added.",

        data: result,
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
   SPEAK
========================================================= */

exports.speak =
  async (req, res) => {
    try {
      const result =
        await avatarSessionService
          .speak({
            userId:
              getUserId(req),

            avatarSessionId:
              req.params.id,

            text:
              req.body?.text,

            language:
              req.body
                ?.language,

            audioUrl:
              req.body
                ?.audioUrl,
          });

      return res.json({
        success: true,

        message:
          "Avatar speech started.",

        data: result,
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
   GET SESSION
========================================================= */

exports.getSession =
  async (req, res) => {
    try {
      const session =
        await avatarSessionService
          .getSession({
            userId:
              getUserId(req),

            avatarSessionId:
              req.params.id,
          });

      return res.json({
        success: true,
        data: session,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Unable to load avatar session."
      );
    }
  };

/* =========================================================
   END SESSION
========================================================= */

exports.endSession =
  async (req, res) => {
    try {
      const session =
        await avatarSessionService
          .endSession({
            userId:
              getUserId(req),

            avatarSessionId:
              req.params.id,
          });

      return res.json({
        success: true,

        message:
          "Avatar session ended successfully.",

        data: session,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Unable to end avatar session."
      );
    }
  };