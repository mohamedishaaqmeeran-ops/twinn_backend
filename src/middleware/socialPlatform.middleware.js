// middleware/socialPlatform.middleware.js

const SUPPORTED_SOCIAL_PLATFORMS =
  Object.freeze([
    "instagram",
    "facebook",
    "youtube",
    "linkedin",
    "rumble",
    "kick",
    "twitch",
    "twitter",
  ]);

const normalizeSocialPlatform =
  (platform) =>
    String(
      platform || ""
    )
      .trim()
      .toLowerCase()
      .replace(
        /\s+/g,
        ""
      );

const validateSocialPlatform =
  (
    req,
    res,
    next
  ) => {
    const platform =
      normalizeSocialPlatform(
        req.params
          ?.platform
      );

    if (!platform) {
      return res
        .status(400)
        .json({
          success: false,
          code:
            "SOCIAL_PLATFORM_REQUIRED",
          message:
            "Social platform is required.",
        });
    }

    if (
      !SUPPORTED_SOCIAL_PLATFORMS
        .includes(
          platform
        )
    ) {
      return res
        .status(400)
        .json({
          success: false,
          code:
            "SOCIAL_PLATFORM_NOT_SUPPORTED",
          message:
            `Unsupported social platform: ${platform}.`,
          supportedPlatforms:
            SUPPORTED_SOCIAL_PLATFORMS,
        });
    }

    req.params.platform =
      platform;

    return next();
  };

module.exports = {
  SUPPORTED_SOCIAL_PLATFORMS,
  normalizeSocialPlatform,
  validateSocialPlatform,
};