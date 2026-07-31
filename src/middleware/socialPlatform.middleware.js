const SUPPORTED_SOCIAL_PLATFORMS = Object.freeze([
  "instagram",
  "facebook",
  "youtube",
  "linkedin",
  "tiktok",
  "rumble",
  "kick",
  "twitch",
  "twitter",
  "loco",
  "nimo",
]);

const normalizeSocialPlatform = (platform) => {
  const value = String(platform || "")
    .trim()
    .toLowerCase();

  if (["x", "twitter/x", "x/twitter"].includes(value)) {
    return "twitter";
  }

  if (["nimotv", "nimo tv"].includes(value)) {
    return "nimo";
  }

  if (["locotv", "loco tv"].includes(value)) {
    return "loco";
  }

  return value;
};

const validateSocialPlatform = (req, res, next) => {
  const platform = normalizeSocialPlatform(req.params?.platform);

  if (!SUPPORTED_SOCIAL_PLATFORMS.includes(platform)) {
    return res.status(400).json({
      success: false,
      code: "UNSUPPORTED_SOCIAL_PLATFORM",
      message: `Unsupported platform: ${platform || "unknown"}`,
      supportedPlatforms: SUPPORTED_SOCIAL_PLATFORMS,
    });
  }

  req.params.platform = platform;
  req.socialPlatform = platform;
  return next();
};

module.exports = {
  SUPPORTED_SOCIAL_PLATFORMS,
  normalizeSocialPlatform,
  validateSocialPlatform,
};
