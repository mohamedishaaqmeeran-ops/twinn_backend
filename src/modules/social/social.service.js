const fetch = require("node-fetch");
const Connection = require("../../models/Connection");

const REDIRECT_BASE = process.env.REDIRECT_BASE || "https://twinn-backend.onrender.com";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://twinn.live";

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
  return `https://www.facebook.com/v23.0/dialog/oauth?client_id=${process.env.INSTAGRAM_APP_ID}&redirect_uri=${encodeURIComponent(
    `${REDIRECT_BASE}/api/social/callback/instagram`
  )}&scope=${encodeURIComponent(
    "public_profile,pages_show_list,pages_read_engagement,instagram_basic"
  )}&response_type=code`;
}

  throw new Error("Unsupported platform");
};

exports.handleCallback = async (platform, code) => {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = `${REDIRECT_BASE}/api/social/callback/${platform}`;

  const tokenUrl =
    `https://graph.facebook.com/v23.0/oauth/access_token` +
    `?client_id=${appId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&client_secret=${appSecret}` +
    `&code=${code}`;

  const tokenResponse = await fetch(tokenUrl);
  const tokenData = await tokenResponse.json();

  if (!tokenData.access_token) {
    throw new Error(tokenData.error?.message || "Access token failed");
  }

  if (platform === "instagram") {
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v23.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}&access_token=${tokenData.access_token}`
    );

    const pagesData = await pagesResponse.json();

    if (!pagesData.data?.length) {
      throw new Error("No Facebook Page found for this account.");
    }

    const pageWithInstagram = pagesData.data.find(
      (page) => page.instagram_business_account
    );

    if (!pageWithInstagram) {
      throw new Error("No Instagram account linked to your Facebook Page.");
    }

    const ig = pageWithInstagram.instagram_business_account;

    return Connection.findOneAndUpdate(
      { platform: "instagram", platformUserId: ig.id },
      {
        platform: "instagram",
        platformUserId: ig.id,
        username: ig.username,
        name: ig.name || ig.username,
        avatarUrl: ig.profile_picture_url,
        pageId: pageWithInstagram.id,
        pageName: pageWithInstagram.name,
        pageAccessToken: pageWithInstagram.access_token,
        accessToken: tokenData.access_token,
        connected: true,
      },
      { upsert: true, new: true }
    );
  }

  const profileResponse = await fetch(
    `https://graph.facebook.com/me?fields=id,name&access_token=${tokenData.access_token}`
  );

  const profile = await profileResponse.json();

  return Connection.findOneAndUpdate(
    { platform: "facebook", platformUserId: profile.id },
    {
      platform: "facebook",
      platformUserId: profile.id,
      name: profile.name,
      accessToken: tokenData.access_token,
      connected: true,
    },
    { upsert: true, new: true }
  );
};

exports.getConnections = async () => {
  return Connection.find().sort({ createdAt: -1 });
};

exports.deleteConnection = async (platform) => {
  return Connection.findOneAndDelete({ platform });
};