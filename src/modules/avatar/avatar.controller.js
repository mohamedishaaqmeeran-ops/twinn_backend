const MarketplaceAvatar = require("../../models/MarketplaceAvatar");
const User = require("../../models/User");
const CreditTransaction = require("../../models/CreditTransaction");

exports.getAvatars = async (req, res) => {
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

    if (category && category !== "All") {
      filter.category = category;
    }

    if (featured === "true") {
      filter.featured = true;
    }

    if (search?.trim()) {
      filter.$or = [
        {
          name: {
            $regex: search.trim(),
            $options: "i",
          },
        },
        {
          description: {
            $regex: search.trim(),
            $options: "i",
          },
        },
        {
          category: {
            $regex: search.trim(),
            $options: "i",
          },
        },
      ];
    }

    let sortQuery = {
      featured: -1,
      createdAt: -1,
    };

    if (sort === "credits-low") {
      sortQuery = { credits: 1 };
    }

    if (sort === "credits-high") {
      sortQuery = { credits: -1 };
    }

    const avatars = await MarketplaceAvatar.find(filter).sort(sortQuery);

    const user = await User.findById(req.user.id).select(
      "credits unlockedAvatars"
    );

    const unlockedIds = new Set(
      (user?.unlockedAvatars || []).map((id) => id.toString())
    );

    const result = avatars.map((avatar) => ({
      ...avatar.toObject(),
      unlocked: unlockedIds.has(avatar._id.toString()),
    }));

    res.json({
      success: true,
      credits: user?.credits || 0,
      avatars: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Unable to fetch avatars",
    });
  }
};

exports.getUnlockedAvatars = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("credits unlockedAvatars")
      .populate({
        path: "unlockedAvatars",
        match: { active: true },
      });

    res.json({
      success: true,
      credits: user?.credits || 0,
      avatars: user?.unlockedAvatars || [],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Unable to fetch unlocked avatars",
    });
  }
};

exports.unlockAvatar = async (req, res) => {
  try {
    const { avatarId } = req.params;

    const avatar = await MarketplaceAvatar.findOne({
      _id: avatarId,
      active: true,
    });

    if (!avatar) {
      return res.status(404).json({
        success: false,
        message: "Avatar not found",
      });
    }

    const existingUser = await User.findById(req.user.id).select(
      "credits unlockedAvatars"
    );

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const alreadyUnlocked = existingUser.unlockedAvatars.some(
      (id) => id.toString() === avatar._id.toString()
    );

    if (alreadyUnlocked) {
      return res.status(400).json({
        success: false,
        message: "Avatar already unlocked",
      });
    }

    const updatedUser = await User.findOneAndUpdate(
      {
        _id: req.user.id,
        credits: { $gte: avatar.credits },
        unlockedAvatars: { $ne: avatar._id },
      },
      {
        $inc: {
          credits: -avatar.credits,
        },
        $addToSet: {
          unlockedAvatars: avatar._id,
        },
      },
      {
        new: true,
      }
    ).select("credits unlockedAvatars");

    if (!updatedUser) {
      return res.status(400).json({
        success: false,
        message: "Not enough credits or avatar already unlocked",
      });
    }

    await CreditTransaction.create({
      userId: req.user.id,
      type: "avatar_unlock",
      credits: -avatar.credits,
      balanceAfter: updatedUser.credits,
      avatarId: avatar._id,
      description: `Unlocked ${avatar.name}`,
    });

    res.json({
      success: true,
      message: `${avatar.name} unlocked successfully`,
      credits: updatedUser.credits,
      avatar,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Unable to unlock avatar",
    });
  }
};

exports.getCreditHistory = async (req, res) => {
  try {
    const transactions = await CreditTransaction.find({
      userId: req.user.id,
    })
      .populate("avatarId", "name image")
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      transactions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Unable to fetch credit history",
    });
  }
};