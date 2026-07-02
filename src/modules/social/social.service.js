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
      "public_profile,pages_show_list,pages_read_engagement,instagram_basic"
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
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v23.0/me/accounts?fields=id,name,access_token&access_token=${tokenData.access_token}`
    );

    const pagesData = await pagesResponse.json();
    console.log("PAGES RESPONSE:", JSON.stringify(pagesData, null, 2));

    if (!pagesData.data || pagesData.data.length === 0) {
      throw new Error("No Facebook Page permission received. Reconnect and select your Page.");
    }

    for (const page of pagesData.data) {
      const igResponse = await fetch(
        `https://graph.facebook.com/v23.0/${page.id}?fields=instagram_business_account{id,username,name,profile_picture_url}&access_token=${page.access_token}`
      );

      const igData = await igResponse.json();
      console.log("IG DATA:", JSON.stringify(igData, null, 2));

      if (igData.instagram_business_account) {
        const ig = igData.instagram_business_account;

        return Connection.findOneAndUpdate(
          { platform: "instagram", platformUserId: ig.id },
          {
            platform: "instagram",
            platformUserId: ig.id,
            username: ig.username,
            name: ig.name || ig.username,
            avatarUrl: ig.profile_picture_url,
            pageId: page.id,
            pageName: page.name,
            pageAccessToken: page.access_token,
            accessToken: tokenData.access_token,
            connected: true,
          },
          { upsert: true, new: true }
        );
      }
    }

    throw new Error("Selected Facebook Page has no linked Instagram Business account.");
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