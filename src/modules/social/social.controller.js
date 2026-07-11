const jwt = require("jsonwebtoken");

const socialService = require("./social.service");
const Connection = require("../../models/Connection");

// ---------------------------------
// START SOCIAL OAUTH
// ---------------------------------

exports.startOAuth = (req, res) => {
  try {
    const { platform } = req.params;

    const state = jwt.sign(
      {
        userId: req.user.id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "10m",
      }
    );

    const url = socialService.getOAuthURL(
      platform,
      state
    );

    return res.redirect(url);
  } catch (error) {
    console.error(
      "START OAUTH ERROR:",
      error
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ---------------------------------
// SOCIAL OAUTH CALLBACK
// ---------------------------------

exports.oauthCallback = async (req, res) => {
  try {
    const { platform } = req.params;
    const { code, state } = req.query;

    if (!code) {
      const message =
        req.query.error_message ||
        req.query.error_description ||
        "No authorization code received";

      return res.redirect(
        `${process.env.FRONTEND_URL}/app/connect?status=failed&message=${encodeURIComponent(
          message
        )}`
      );
    }

    if (!state) {
      throw new Error(
        "OAuth state is missing."
      );
    }

    const decoded = jwt.verify(
      state,
      process.env.JWT_SECRET
    );

    const userId = decoded.userId;

    await socialService.handleCallback(
      platform,
      code,
      userId
    );

    return res.redirect(
      `${process.env.FRONTEND_URL}/app/connect?status=connected&platform=${encodeURIComponent(
        platform
      )}`
    );
  } catch (error) {
    console.error(
      "OAUTH CALLBACK ERROR:",
      error
    );

    return res.redirect(
      `${process.env.FRONTEND_URL}/app/connect?status=failed&message=${encodeURIComponent(
        error.message
      )}`
    );
  }
};

// ---------------------------------
// GET USER CONNECTIONS
// ---------------------------------

exports.getConnections = async (
  req,
  res
) => {
  try {
    const connections =
      await Connection.find({
        userId: req.user.id,
      })
        .select(
          [
            "-accessToken",
            "-refreshToken",
            "-pageAccessToken",
            "-instagramStreamKey",
            "-youtubeStreamKey",
          ].join(" ")
        )
        .sort({
          createdAt: -1,
        })
        .lean();

    const safeConnections =
      connections.map((connection) => ({
        ...connection,

        instagramRtmpConfigured:
          Boolean(
            connection.instagramRtmpUrl
          ),

        youtubeRtmpConfigured:
          Boolean(
            connection.youtubeStreamUrl
          ),
      }));

    return res.json({
      success: true,
      data: safeConnections,
    });
  } catch (error) {
    console.error(
      "GET CONNECTIONS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to load social connections.",
    });
  }
};

// ---------------------------------
// DELETE CONNECTION
// ---------------------------------

exports.deleteConnection = async (
  req,
  res
) => {
  try {
    const platform = String(
      req.params.platform || ""
    )
      .trim()
      .toLowerCase();

    const supportedPlatforms = [
      "instagram",
      "facebook",
      "youtube",
      "tiktok",
    ];

    if (
      !supportedPlatforms.includes(platform)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Unsupported social platform.",
      });
    }

    const deletedConnection =
      await socialService.deleteConnection(
        req.user.id,
        platform
      );

    if (!deletedConnection) {
      return res.status(404).json({
        success: false,
        message:
          `${platform} connection was not found.`,
      });
    }

    return res.json({
      success: true,
      message:
        `${platform} disconnected successfully.`,
    });
  } catch (error) {
    console.error(
      "DELETE CONNECTION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ---------------------------------
// SAVE INSTAGRAM RTMP SETTINGS
// ---------------------------------

exports.saveInstagramRtmp = async (
  req,
  res
) => {
  try {
    const rtmpUrl = String(
      req.body.rtmpUrl || ""
    ).trim();

    const streamKey = String(
      req.body.streamKey || ""
    ).trim();

    if (!rtmpUrl || !streamKey) {
      return res.status(400).json({
        success: false,
        message:
          "Instagram RTMP URL and stream key are required.",
      });
    }

    const validRtmpUrl =
      rtmpUrl.startsWith("rtmp://") ||
      rtmpUrl.startsWith("rtmps://");

    if (!validRtmpUrl) {
      return res.status(400).json({
        success: false,
        message:
          "Instagram RTMP URL must start with rtmp:// or rtmps://.",
      });
    }

    const connection =
      await Connection.findOneAndUpdate(
        {
          userId: req.user.id,
          platform: "instagram",
          connected: true,
        },
        {
          $set: {
            instagramRtmpUrl:
              rtmpUrl.replace(/\/+$/, ""),

            instagramStreamKey:
              streamKey.replace(/^\/+/, ""),
          },
        },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!connection) {
      return res.status(404).json({
        success: false,
        message:
          "Connect Instagram before saving RTMP settings.",
      });
    }

    return res.json({
      success: true,
      message:
        "Instagram RTMP settings saved successfully.",

      data: {
        platform: "instagram",
        rtmpConfigured: true,
      },
    });
  } catch (error) {
    console.error(
      "SAVE INSTAGRAM RTMP ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to save Instagram RTMP settings.",
    });
  }
};