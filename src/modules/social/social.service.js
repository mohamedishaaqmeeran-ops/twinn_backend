const fetch = require("node-fetch");
const Connection = require("../../models/Connection");

const REDIRECT_BASE =
  process.env.REDIRECT_BASE || "https://twinn-backend.onrender.com";

exports.getOAuthURL = (platform, state) => {
  const appId =
    platform === "instagram"
      ? process.env.INSTAGRAM_APP_ID
      : process.env.FACEBOOK_APP_ID;

  if (!appId) throw new Error("Meta App ID missing in .env");

  const redirectUri = `${REDIRECT_BASE}/api/social/callback/${platform}`;

  if (platform === "instagram") {
    return `https://www.facebook.com/v23.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${encodeURIComponent(
      "public_profile,pages_show_list,pages_read_engagement,business_management,instagram_basic"
    )}&response_type=code&auth_type=rerequest&state=${encodeURIComponent(
      state
    )}`;
  }

  if (platform === "facebook") {
    return `https://www.facebook.com/v23.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=public_profile&response_type=code&state=${encodeURIComponent(
      state
    )}`;
  }

  throw new Error("Unsupported platform");
};

exports.handleCallback = async (platform, code, userId) => {
  const appId =
    platform === "instagram"
      ? process.env.INSTAGRAM_APP_ID
      : process.env.FACEBOOK_APP_ID;

  const appSecret =
    platform === "instagram"
      ? process.env.INSTAGRAM_APP_SECRET
      : process.env.FACEBOOK_APP_SECRET;

  const redirectUri = `${REDIRECT_BASE}/api/social/callback/${platform}`;

  const tokenUrl =
    `https://graph.facebook.com/v23.0/oauth/access_token` +
    `?client_id=${appId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&client_secret=${appSecret}` +
    `&code=${code}`;

  const tokenResponse = await fetch(tokenUrl);
  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(tokenData.error?.message || "Access token failed");
  }

  if (platform === "instagram") {
    const pagesUrl =
      `https://graph.facebook.com/v23.0/me/accounts` +
      `?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}` +
      `&access_token=${tokenData.access_token}`;

    const pagesResponse = await fetch(pagesUrl);
    const pagesData = await pagesResponse.json();

    const pages = pagesData.data || [];

    if (pages.length === 0) {
      throw new Error("No Facebook Page found for this user.");
    }

    const pageWithInstagram = pages.find(
      (page) => page.instagram_business_account
    );

    if (!pageWithInstagram) {
      throw new Error("This Facebook Page has no linked Instagram account.");
    }

    const ig = pageWithInstagram.instagram_business_account;

    return Connection.findOneAndUpdate(
      {
        userId,
        platform: "instagram",
      },
      {
        userId,
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
    `https://graph.facebook.com/v23.0/me?fields=id,name&access_token=${tokenData.access_token}`
  );

  const profile = await profileResponse.json();

  return Connection.findOneAndUpdate(
    {
      userId,
      platform: "facebook",
    },
    {
      userId,
      platform: "facebook",
      platformUserId: profile.id,
      name: profile.name,
      accessToken: tokenData.access_token,
      connected: true,
    },
    { upsert: true, new: true }
  );
};

exports.getConnections = async (userId) => {
  return Connection.find({ userId }).sort({ createdAt: -1 });
};

exports.deleteConnection = async (userId, platform) => {
  return Connection.findOneAndDelete({ userId, platform });
};