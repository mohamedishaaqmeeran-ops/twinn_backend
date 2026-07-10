const User = require("../../models/User");
const Waitlist = require("../../models/Waitlist");

/* ---------------- GET ALL USERS ---------------- */

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select(
        "-passwordHash -password -verificationToken -resetToken"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("GET USERS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to fetch users",
    });
  }
};

/* ---------------- GET WAITLIST ---------------- */

exports.getWaitlist = async (req, res) => {
  try {
    const waitlist = await Waitlist.find().sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: waitlist.length,
      waitlist,
    });
  } catch (error) {
    console.error("GET WAITLIST ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to fetch waitlist",
    });
  }
};

/* ---------------- TOGGLE USER STATUS ---------------- */

exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (String(user._id) === String(req.user._id || req.user.id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot block your own admin account",
      });
    }

    /*
      Supports either:
      1. status field: Active / Blocked
      2. isBlocked boolean field
    */

    if (user.schema.path("isBlocked")) {
      user.isBlocked = !user.isBlocked;
      user.status = user.isBlocked ? "Blocked" : "Active";
    } else {
      user.status =
        user.status === "Blocked" ? "Active" : "Blocked";
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message:
        user.status === "Blocked"
          ? "User blocked successfully"
          : "User unblocked successfully",
      user,
    });
  } catch (error) {
    console.error("TOGGLE USER STATUS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to update user status",
    });
  }
};

/* ---------------- UPDATE USER PLAN ---------------- */

exports.updateUserPlan = async (req, res) => {
  try {
    const plan = String(req.body.plan || "").toLowerCase();

    if (!["free", "pro", "business"].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: "Plan must be free, pro or business",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { plan },
      {
        new: true,
        runValidators: true,
      }
    ).select(
      "-passwordHash -password -verificationToken -resetToken"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User plan updated successfully",
      user,
    });
  } catch (error) {
    console.error("UPDATE USER PLAN ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to update user plan",
    });
  }
};

/* ---------------- GENERAL USER UPDATE ---------------- */

exports.updateUser = async (req, res) => {
  try {
    const allowedFields = [
      "name",
      "fullName",
      "phone",
      "brand",
      "role",
      "status",
      "plan",
    ];

    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
        runValidators: true,
      }
    ).select(
      "-passwordHash -password -verificationToken -resetToken"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      user,
    });
  } catch (error) {
    console.error("UPDATE USER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to update user",
    });
  }
};

/* ---------------- DELETE USER ---------------- */

exports.deleteUser = async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user._id || req.user.id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own admin account",
      });
    }

    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("DELETE USER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to delete user",
    });
  }
};