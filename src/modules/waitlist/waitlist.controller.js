const waitlistService = require("./waitlist.service");

exports.createWaitlist = async (req, res) => {
  try {
    const { fullName, email, mobile, brand } = req.body;

    if (!fullName || !email || !mobile || !brand) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, mobile and brand are required"
      });
    }

    const user = await waitlistService.createWaitlistUser({
      fullName,
      email,
      mobile,
      brand
    });

    res.status(201).json({
      success: true,
      message: "Waitlist registered successfully",
      data: user
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

exports.getWaitlistUsers = async (req, res) => {
  try {
    const users = await waitlistService.getWaitlistUsers();

    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getWaitlistCount = async (req, res) => {
  try {
    const count = await waitlistService.getWaitlistCount();

    res.json({
      success: true,
      total_waitlist_users: count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};