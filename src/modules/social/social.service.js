const fetch = require("node-fetch");
const Connection = require("../../models/Connection");

const REDIRECT_BASE = process.env.REDIRECT_BASE || "https://twinn-backend.onrender.com";

exports.getOAuthURL = (platform) => {
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
      "public_profile,pages_show_list,pages_read_engagement,pages_manage_metadata,business_management,instagram_basic"
    )}&response_type=code&auth_type=rerequest`;
  }

  if (platform === "facebook") {
    return `https://www.facebook.com/v23.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=public_profile&response_type=code`;
  }

  throw new Error("Unsupported platform");
};

exports.handleCallback = async (platform, code) => {
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
    `https://graph.facebook.com/v23.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}&access_token=${tokenData.access_token}`;

  let pagesResponse = await fetch(pagesUrl);
  let pagesData = await pagesResponse.json();

  console.log("PAGES RESPONSE:", JSON.stringify(pagesData, null, 2));

  let pages = pagesData.data || [];

  // Business Manager fallback
  if (pages.length === 0) {
    const businessRes = await fetch(
      `https://graph.facebook.com/v23.0/me/businesses?fields=id,name&access_token=${tokenData.access_token}`
    );

    const businessData = await businessRes.json();
    console.log("BUSINESSES:", JSON.stringify(businessData, null, 2));

    for (const business of businessData.data || []) {
      const ownedPagesRes = await fetch(
        `https://graph.facebook.com/v23.0/${business.id}/owned_pages?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}&access_token=${tokenData.access_token}`
      );

      const ownedPagesData = await ownedPagesRes.json();
      console.log("OWNED PAGES:", JSON.stringify(ownedPagesData, null, 2));

      pages.push(...(ownedPagesData.data || []));
    }
  }

  if (pages.length === 0) {
    throw new Error("No Facebook Page found. Add business_management and reconnect.");
  }

  const pageWithInstagram = pages.find((page) => page.instagram_business_account);

  if (!pageWithInstagram) {
    throw new Error("Selected Page has no linked Instagram account.");
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
    `https://graph.facebook.com/v23.0/me?fields=id,name&access_token=${tokenData.access_token}`
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