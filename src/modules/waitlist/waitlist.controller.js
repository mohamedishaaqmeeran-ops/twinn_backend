const waitlistService = require("./waitlist.service");

exports.createWaitlist = async (req, res) => {
  try {
    const { fullName, email, mobile, brand } = req.body;

    if (!fullName || !email || !mobile || !brand) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, mobile and brand are required",
      });
    }

    const user = await waitlistService.createWaitlistUser({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      mobile: mobile.trim(),
      brand: brand.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Waitlist registered successfully",
      data: user,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getWaitlistUsers = async (req, res) => {
  try {
    const users = await waitlistService.getWaitlistUsers();

    return res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getWaitlistCount = async (req, res) => {
  try {
    const count = await waitlistService.getWaitlistCount();

    return res.status(200).json({
      success: true,
      total_waitlist_users: count,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteWaitlistUser = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedUser =
      await waitlistService.deleteWaitlistUser(id);

    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: "Waitlist user not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Waitlist user deleted successfully",
      data: deletedUser,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Unable to delete waitlist user",
    });
  }
};