
const socialService = require("./social.service");

exports.startOAuth = (req, res) => {
  try {
    const { platform } = req.params;
    const url = socialService.getOAuthURL(platform);

    res.redirect(url);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// social.controller.js
exports.oauthCallback = async (req, res) => {
  try {
    const { platform } = req.params;
    const { code } = req.query;

    if (!code) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/app/connect?status=failed&message=No code received`
      );
    }

    await socialService.handleCallback(platform, code);

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
    const connections = await socialService.getConnections();

    res.json({
      success: true,
      data: connections
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.deleteConnection = async (req, res) => {
  try {
    const { platform } = req.params;

    await socialService.deleteConnection(platform);

    res.json({
      success: true,
      message: `${platform} disconnected successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};