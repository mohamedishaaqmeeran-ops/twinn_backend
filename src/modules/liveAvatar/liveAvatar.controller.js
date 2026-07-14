const liveAvatarService = require(
  "./liveAvatar.service"
);

/* =========================================================
   HELPERS
========================================================= */

const sendError = (
  res,
  error,
  fallbackMessage
) => {
  console.error(fallbackMessage, {
    message: error?.message,
    details: error?.details,
    stack: error?.stack,
  });

  return res
    .status(error?.statusCode || 500)
    .json({
      success: false,

      message:
        error?.message ||
        fallbackMessage,
    });
};

/* =========================================================
   CREATE SHORT-LIVED EMBED
========================================================= */

exports.createEmbed = async (req, res) => {
  try {
    /*
     * For normal users, avatarId and contextId
     * should usually come from backend env or database.
     *
     * Do not accept arbitrary IDs from users unless
     * you intentionally support multiple configured agents.
     */
    const result =
      await liveAvatarService.createEmbed({
        avatarId:
          req.body?.avatarId,

        contextId:
          req.body?.contextId,

        sandbox:
          req.body?.sandbox,
      });

    return res.status(201).json({
      success: true,

      message:
        "LiveAvatar session created successfully.",

      embedUrl: result.url,

      data: {
        embedUrl: result.url,
        avatarId: result.avatarId,
        contextId: result.contextId,
        sandbox: result.sandbox,
      },
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to create LiveAvatar session."
    );
  }
};

/* =========================================================
   TEST CONFIGURATION
========================================================= */

exports.testConfiguration = async (
  req,
  res
) => {
  try {
    const result =
      await liveAvatarService.testConfiguration();

    return res.json({
      success: true,

      message:
        "LiveAvatar configuration is working.",

      embedUrl: result.url,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "LiveAvatar configuration test failed."
    );
  }
};