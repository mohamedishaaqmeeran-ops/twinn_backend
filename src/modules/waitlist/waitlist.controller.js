const waitlistService = require("./waitlist.service");

exports.createWaitlist = async (req, res) => {
  try {
    const {
      fullName,
      email,
      mobile,
      brand,
      referredBy,
    } = req.body;

    if (
      !fullName?.trim() ||
      !email?.trim() ||
      !mobile?.trim() ||
      !brand?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Full name, email, mobile and brand are required.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    if (mobile.trim().length < 8) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid mobile number.",
      });
    }

    const user =
      await waitlistService.createWaitlistUser({
        fullName,
        email,
        mobile,
        brand,
        referredBy,
      });

    return res.status(201).json({
      success: true,
      message: "Waitlist registered successfully.",
      data: user,
    });
  } catch (error) {
    console.error("CREATE WAITLIST ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "This email is already registered on the waitlist.",
      });
    }

    return res.status(400).json({
      success: false,
      message:
        error.message || "Unable to join the waitlist.",
    });
  }
};

exports.getWaitlistUsers = async (req, res) => {
  try {
    const result =
      await waitlistService.getWaitlistUsers({
        search: req.query.search || "",
        status: req.query.status || "",
        page: req.query.page || 1,
        limit: req.query.limit || 50,
      });

    return res.status(200).json({
      success: true,
      count: result.users.length,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      data: result.users,
    });
  } catch (error) {
    console.error("GET WAITLIST USERS ERROR:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message || "Unable to fetch waitlist users.",
    });
  }
};

exports.getWaitlistUser = async (req, res) => {
  try {
    const user =
      await waitlistService.getWaitlistUserById(
        req.params.id
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Waitlist user not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("GET WAITLIST USER ERROR:", error);

    return res.status(400).json({
      success: false,
      message:
        error.message || "Unable to fetch waitlist user.",
    });
  }
};

exports.getWaitlistCount = async (req, res) => {
  try {
    const count =
      await waitlistService.getWaitlistCount();

    return res.status(200).json({
      success: true,
      total_waitlist_users: count,
    });
  } catch (error) {
    console.error("GET WAITLIST COUNT ERROR:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message || "Unable to fetch waitlist count.",
    });
  }
};

exports.updateWaitlistUser = async (req, res) => {
  try {
    const user =
      await waitlistService.updateWaitlistUser(
        req.params.id,
        req.body
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Waitlist user not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Waitlist user updated successfully.",
      data: user,
    });
  } catch (error) {
    console.error("UPDATE WAITLIST USER ERROR:", error);

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Unable to update waitlist user.",
    });
  }
};

exports.deleteWaitlistUser = async (req, res) => {
  try {
    const deletedUser =
      await waitlistService.deleteWaitlistUser(
        req.params.id
      );

    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: "Waitlist user not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Waitlist user deleted successfully.",
      data: deletedUser,
    });
  } catch (error) {
    console.error("DELETE WAITLIST USER ERROR:", error);

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Unable to delete waitlist user.",
    });
  }
};