// modules/social/social.service.js

const fetch = require("node-fetch");
const Connection = require("../../models/Connection");

const REDIRECT_BASE =
  process.env.REDIRECT_BASE || "https://twinn-backend.onrender.com";

const metaVersion = "v23.0";

const getMetaAppId = (platform) => {
  if (platform === "instagram") return process.env.INSTAGRAM_APP_ID;
  if (platform === "facebook") return process.env.FACEBOOK_APP_ID;
  throw new Error("Unsupported platform");
};

const getMetaAppSecret = (platform) => {
  if (platform === "instagram") return process.env.INSTAGRAM_APP_SECRET;
  if (platform === "facebook") return process.env.FACEBOOK_APP_SECRET;
  throw new Error("Unsupported platform");
};

exports.getOAuthURL = (platform, state) => {
  const appId = getMetaAppId(platform);

  if (!appId) throw new Error("Meta App ID missing in .env");

  const redirectUri = `${REDIRECT_BASE}/api/social/callback/${platform}`;

  const instagramScope = [
    "public_profile",
    "pages_show_list",
    "pages_read_engagement",
    "business_management",
    "instagram_basic",
  ].join(",");

const facebookScope = [
  "public_profile",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "pages_manage_metadata",
  "publish_video",
].join(",");

  const scope = platform === "instagram" ? instagramScope : facebookScope;

  return `https://www.facebook.com/${metaVersion}/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${encodeURIComponent(scope)}&response_type=code&auth_type=rerequest&state=${encodeURIComponent(
    state
  )}`;
};

exports.handleCallback = async (platform, code, userId) => {
  if (!userId) {
    throw new Error("User ID missing. Please login and connect again.");
  }

  const appId = getMetaAppId(platform);
  const appSecret = getMetaAppSecret(platform);

  const redirectUri = `${REDIRECT_BASE}/api/social/callback/${platform}`;

  const tokenUrl =
    `https://graph.facebook.com/${metaVersion}/oauth/access_token` +
    `?client_id=${appId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&client_secret=${appSecret}` +
    `&code=${code}`;

  const tokenResponse = await fetch(tokenUrl);
  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(tokenData.error?.message || "Access token failed");
  }

  const pagesUrl =
    `https://graph.facebook.com/${metaVersion}/me/accounts` +
    `?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}` +
    `&access_token=${tokenData.access_token}`;

  const pagesResponse = await fetch(pagesUrl);
  const pagesData = await pagesResponse.json();

  if (!pagesResponse.ok) {
    throw new Error(pagesData.error?.message || "Unable to fetch Facebook pages.");
  }

  const pages = pagesData.data || [];

  if (pages.length === 0) {
    throw new Error("No Facebook Page found for this user.");
  }

 if (platform === "facebook") {
  const pagesUrl =
    `https://graph.facebook.com/v23.0/me/accounts` +
    `?fields=id,name,access_token` +
    `&access_token=${tokenData.access_token}`;

  const pagesResponse = await fetch(pagesUrl);
  const pagesData = await pagesResponse.json();

  if (!pagesResponse.ok) {
    throw new Error(
      pagesData.error?.message || "Unable to fetch Facebook Pages."
    );
  }

  const page = pagesData.data?.[0];

  if (!page) {
    throw new Error(
      "No Facebook Page found. You must be admin of a Facebook Page."
    );
  }

  return Connection.findOneAndUpdate(
    {
      userId,
      platform: "facebook",
    },
    {
      userId,
      platform: "facebook",
      platformUserId: page.id,
      name: page.name,
      pageId: page.id,
      pageName: page.name,
      pageAccessToken: page.access_token,
      accessToken: tokenData.access_token,
      connected: true,
    },
    { upsert: true, new: true }
  );
}

  if (platform === "instagram") {
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

  throw new Error("Unsupported platform");
};

exports.getConnections = async (userId) => {
  return Connection.find({ userId }).sort({ createdAt: -1 });
};

exports.deleteConnection = async (userId, platform) => {
  return Connection.findOneAndDelete({ userId, platform });
};