const fetch = require("node-fetch");
const Connection = require("../../models/Connection");

const REDIRECT_BASE = process.env.REDIRECT_BASE || "http://localhost:8000";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

exports.FRONTEND_URL = FRONTEND_URL;

exports.getOAuthURL = (platform) => {
  const metaAppId = process.env.FACEBOOK_APP_ID;

  if (!metaAppId) {
    throw new Error("FACEBOOK_APP_ID missing in .env");
  }

  if (platform === "facebook") {
    return `https://www.facebook.com/v23.0/dialog/oauth?client_id=${metaAppId}&redirect_uri=${encodeURIComponent(
      `${REDIRECT_BASE}/api/social/callback/facebook`
    )}&scope=public_profile&response_type=code`;
  }

if (platform === "instagram") {
  return `https://www.facebook.com/v23.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(
    `${REDIRECT_BASE}/api/social/callback/instagram`
  )}&scope=public_profile&response_type=code`;
}

  throw new Error("Unsupported platform");
};

exports.handleCallback = async (platform, code) => {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  const redirectUri = `${REDIRECT_BASE}/api/social/callback/${platform}`;

  const tokenUrl =
    `https://graph.facebook.com/v23.0/oauth/access_token` +
    `?client_id=${appId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&client_secret=${appSecret}` +
    `&code=${code}`;

  const tokenResponse = await fetch(tokenUrl);
  const tokenData = await tokenResponse.json();

  console.log("TOKEN DATA:", tokenData);

  if (!tokenData.access_token) {
    throw new Error(tokenData.error?.message || "Access token failed");
  }

  const profileResponse = await fetch(
    `https://graph.facebook.com/me?fields=id,name&access_token=${tokenData.access_token}`
  );

  const profile = await profileResponse.json();

  console.log("PROFILE:", profile);

  const connection = await Connection.findOneAndUpdate(
    { platform, platformUserId: profile.id },
    {
      platform,
      platformUserId: profile.id,
      name: profile.name,
      accessToken: tokenData.access_token,
      connected: true,
    },
    { upsert: true, new: true }
  );

  return connection;
};

exports.getConnections = async () => {
  return Connection.find().sort({ createdAt: -1 });
};

exports.deleteConnection = async (platform) => {
  return Connection.findOneAndDelete({ platform });
};