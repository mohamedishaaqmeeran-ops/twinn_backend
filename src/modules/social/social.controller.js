const jwt = require("jsonwebtoken");
const socialService = require("./social.service");

exports.startOAuth = (req, res) => {
  try {
    const { platform } = req.params;

    const state = jwt.sign(
      { userId: req.user.id },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );

    const url = socialService.getOAuthURL(platform, state);

    res.redirect(url);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.oauthCallback = async (req, res) => {
  try {
    const { platform } = req.params;
    const { code, state } = req.query;

    if (!code) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/app/connect?status=failed&message=${encodeURIComponent(
          req.query.error_message ||
            req.query.error_description ||
            "No code received"
        )}`
      );
    }

    if (!state) {
      throw new Error("OAuth state missing");
    }

    const decoded = jwt.verify(state, process.env.JWT_SECRET);
    const userId = decoded.userId;

    await socialService.handleCallback(platform, code, userId);

    return res.redirect(
      `${process.env.FRONTEND_URL}/app/connect?status=connected&platform=${platform}`
    );
  } catch (error) {
    console.log("OAuth callback error:", error.message);

    return res.redirect(
      `${process.env.FRONTEND_URL}/app/connect?status=failed&message=${encodeURIComponent(
        error.message
      )}`
    );
  }
};

exports.getConnections = async (req, res) => {
  try {
    const connections = await socialService.getConnections(req.user.id);

    res.json({
      success: true,
      data: connections,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteConnection = async (req, res) => {
  try {
    const { platform } = req.params;

    await socialService.deleteConnection(req.user.id, platform);

    res.json({
      success: true,
      message: `${platform} disconnected successfully`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};