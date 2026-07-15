// modules/social/social.service.js

const fetch = require("node-fetch");
const { google } = require("googleapis");

const Connection = require("../../models/Connection");

/* =========================================================
   CONFIGURATION
========================================================= */

const REDIRECT_BASE =
  process.env.REDIRECT_BASE ||
  "https://twinn-backend.onrender.com";

const META_VERSION =
  process.env.META_API_VERSION ||
  "v23.0";

const SUPPORTED_PLATFORMS = [
  "instagram",
  "facebook",
  "youtube",
];

/* =========================================================
   NORMALIZE PLATFORM
========================================================= */

const normalizePlatform = (platform) => {
  return String(platform || "")
    .trim()
    .toLowerCase();
};

/* =========================================================
   VALIDATE PLATFORM
========================================================= */

const validatePlatform = (platform) => {
  const normalizedPlatform =
    normalizePlatform(platform);

  if (
    !SUPPORTED_PLATFORMS.includes(
      normalizedPlatform
    )
  ) {
    throw new Error(
      `Unsupported social platform: ${normalizedPlatform || "unknown"}`
    );
  }

  return normalizedPlatform;
};

/* =========================================================
   META CONFIGURATION
========================================================= */

const getMetaAppId = (platform) => {
  if (platform === "instagram") {
    return process.env.INSTAGRAM_APP_ID;
  }

  if (platform === "facebook") {
    return process.env.FACEBOOK_APP_ID;
  }

  throw new Error(
    `Unsupported Meta platform: ${platform}`
  );
};

const getMetaAppSecret = (platform) => {
  if (platform === "instagram") {
    return process.env.INSTAGRAM_APP_SECRET;
  }

  if (platform === "facebook") {
    return process.env.FACEBOOK_APP_SECRET;
  }

  throw new Error(
    `Unsupported Meta platform: ${platform}`
  );
};

const getMetaRedirectUri = (platform) => {
  return (
    `${REDIRECT_BASE}/api/social/callback/` +
    `${platform}`
  );
};

/* =========================================================
   YOUTUBE OAUTH CLIENT
========================================================= */

const createYouTubeOAuthClient = () => {
  const clientId =
    process.env.GOOGLE_CLIENT_ID;

  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET;

  const redirectUri =
    process.env.YOUTUBE_REDIRECT_URI ||
    `${REDIRECT_BASE}/api/social/callback/youtube`;

  if (!clientId) {
    throw new Error(
      "GOOGLE_CLIENT_ID is missing in the environment variables."
    );
  }

  if (!clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_SECRET is missing in the environment variables."
    );
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
};

/* =========================================================
   BUILD META OAUTH URL
========================================================= */

const getMetaOAuthURL = (
  platform,
  state
) => {
  const appId =
    getMetaAppId(platform);

  if (!appId) {
    throw new Error(
      `${platform.toUpperCase()} App ID is missing in the environment variables.`
    );
  }

  const redirectUri =
    getMetaRedirectUri(platform);

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
  ].join(",");

  const scope =
    platform === "instagram"
      ? instagramScope
      : facebookScope;

  return (
    `https://www.facebook.com/${META_VERSION}/dialog/oauth` +
    `?client_id=${encodeURIComponent(appId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&response_type=code` +
    `&auth_type=rerequest` +
    `&state=${encodeURIComponent(state)}`
  );
};

/* =========================================================
   BUILD YOUTUBE OAUTH URL
========================================================= */

const getYouTubeOAuthURL = (state) => {
  const oauth2Client =
    createYouTubeOAuthClient();

  return oauth2Client.generateAuthUrl({
    access_type: "offline",

    /*
     * Google may not return a refresh token
     * for subsequent authorizations unless
     * consent is requested again.
     */
    prompt: "consent",

    include_granted_scopes: true,

    state,

    scope: [
      "https://www.googleapis.com/auth/youtube",
    ],
  });
};

/* =========================================================
   GET OAUTH URL
========================================================= */

exports.getOAuthURL = (
  platform,
  state
) => {
  const normalizedPlatform =
    validatePlatform(platform);

  if (!state) {
    throw new Error(
      "OAuth state is required."
    );
  }

  if (
    normalizedPlatform ===
      "instagram" ||
    normalizedPlatform ===
      "facebook"
  ) {
    return getMetaOAuthURL(
      normalizedPlatform,
      state
    );
  }

  if (
    normalizedPlatform ===
    "youtube"
  ) {
    return getYouTubeOAuthURL(
      state
    );
  }

  throw new Error(
    `Unsupported social platform: ${normalizedPlatform}`
  );
};

/* =========================================================
   EXCHANGE META AUTHORIZATION CODE
========================================================= */

const exchangeMetaCode = async (
  platform,
  code
) => {
  const appId =
    getMetaAppId(platform);

  const appSecret =
    getMetaAppSecret(platform);

  if (!appId) {
    throw new Error(
      `${platform.toUpperCase()} App ID is missing.`
    );
  }

  if (!appSecret) {
    throw new Error(
      `${platform.toUpperCase()} App Secret is missing.`
    );
  }

  const redirectUri =
    getMetaRedirectUri(platform);

  const tokenUrl =
    `https://graph.facebook.com/${META_VERSION}/oauth/access_token` +
    `?client_id=${encodeURIComponent(appId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&client_secret=${encodeURIComponent(appSecret)}` +
    `&code=${encodeURIComponent(code)}`;

  const tokenResponse =
    await fetch(tokenUrl);

  const tokenData =
    await tokenResponse
      .json()
      .catch(() => ({}));

  if (
    !tokenResponse.ok ||
    !tokenData.access_token
  ) {
    throw new Error(
      tokenData.error?.message ||
        "Meta access token exchange failed."
    );
  }

  return tokenData;
};

/* =========================================================
   FETCH FACEBOOK PAGES
========================================================= */

const fetchFacebookPages = async (
  accessToken,
  includeInstagram = false
) => {
  const fields = includeInstagram
    ? [
        "id",
        "name",
        "access_token",
        "instagram_business_account{id,username,name,profile_picture_url}",
      ].join(",")
    : [
        "id",
        "name",
        "access_token",
      ].join(",");

  const pagesUrl =
    `https://graph.facebook.com/${META_VERSION}/me/accounts` +
    `?fields=${encodeURIComponent(fields)}` +
    `&access_token=${encodeURIComponent(accessToken)}`;

  const pagesResponse =
    await fetch(pagesUrl);

  const pagesData =
    await pagesResponse
      .json()
      .catch(() => ({}));

  if (!pagesResponse.ok) {
    throw new Error(
      pagesData.error?.message ||
        "Unable to fetch Facebook Pages."
    );
  }

  return Array.isArray(
    pagesData.data
  )
    ? pagesData.data
    : [];
};

/* =========================================================
   HANDLE FACEBOOK CALLBACK
========================================================= */

const handleFacebookCallback =
  async (
    code,
    userId
  ) => {
    const tokenData =
      await exchangeMetaCode(
        "facebook",
        code
      );

    const pages =
      await fetchFacebookPages(
        tokenData.access_token,
        false
      );

    const page = pages[0];

    if (!page) {
      throw new Error(
        "No Facebook Page found. You must have permission to manage a Facebook Page."
      );
    }

    if (!page.access_token) {
      throw new Error(
        "Facebook Page access token was not returned."
      );
    }

    return Connection.findOneAndUpdate(
      {
        userId,
        platform: "facebook",
      },
      {
        $set: {
          userId,
          platform: "facebook",

          platformUserId:
            page.id,

          username:
            page.name || "",

          name:
            page.name ||
            "Facebook Page",

          pageId:
            page.id,

          pageName:
            page.name ||
            "Facebook Page",

          pageAccessToken:
            page.access_token,

          accessToken:
            tokenData.access_token,

          connected: true,

          metadata: {
            tokenType:
              tokenData.token_type ||
              "bearer",

            tokenExpiresIn:
              tokenData.expires_in ||
              null,
          },
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );
  };

/* =========================================================
   HANDLE INSTAGRAM CALLBACK
========================================================= */

const handleInstagramCallback =
  async (
    code,
    userId
  ) => {
    const tokenData =
      await exchangeMetaCode(
        "instagram",
        code
      );

    const pages =
      await fetchFacebookPages(
        tokenData.access_token,
        true
      );

    if (!pages.length) {
      throw new Error(
        "No Facebook Page found for this user."
      );
    }

    const pageWithInstagram =
      pages.find(
        (page) =>
          page.instagram_business_account
      );

    if (!pageWithInstagram) {
      throw new Error(
        "No Instagram professional account is linked to your Facebook Page."
      );
    }

    const instagramAccount =
      pageWithInstagram
        .instagram_business_account;

    if (!instagramAccount?.id) {
      throw new Error(
        "Instagram account ID was not returned."
      );
    }

    return Connection.findOneAndUpdate(
      {
        userId,
        platform: "instagram",
      },
      {
        $set: {
          userId,
          platform: "instagram",

          platformUserId:
            instagramAccount.id,

          username:
            instagramAccount.username ||
            "",

          name:
            instagramAccount.name ||
            instagramAccount.username ||
            "Instagram Account",

          avatarUrl:
            instagramAccount
              .profile_picture_url ||
            "",

          pageId:
            pageWithInstagram.id,

          pageName:
            pageWithInstagram.name ||
            "",

          pageAccessToken:
            pageWithInstagram
              .access_token ||
            "",

          accessToken:
            tokenData.access_token,

          connected: true,

          metadata: {
            tokenType:
              tokenData.token_type ||
              "bearer",

            tokenExpiresIn:
              tokenData.expires_in ||
              null,
          },
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );
  };

/* =========================================================
   HANDLE YOUTUBE CALLBACK
========================================================= */

const handleYouTubeCallback =
  async (
    code,
    userId
  ) => {
    const oauth2Client =
      createYouTubeOAuthClient();

    const tokenResponse =
      await oauth2Client.getToken(
        code
      );

    const tokens =
      tokenResponse.tokens;

    if (
      !tokens.access_token &&
      !tokens.refresh_token
    ) {
      throw new Error(
        "Google did not return YouTube authorization tokens."
      );
    }

    oauth2Client.setCredentials(
      tokens
    );

    const youtube =
      google.youtube({
        version: "v3",
        auth: oauth2Client,
      });

    const channelResponse =
      await youtube.channels.list({
        part: [
          "id",
          "snippet",
          "status",
        ],

        mine: true,
      });

    const channel =
      channelResponse.data
        .items?.[0];

    if (!channel) {
      throw new Error(
        "No YouTube channel was found for this Google account. Create a YouTube channel and connect again."
      );
    }

    const existingConnection =
      await Connection.findOne({
        userId,
        platform: "youtube",
      }).select(
        [
          "+accessToken",
          "+refreshToken",
        ].join(" ")
      );

    /*
     * Google normally returns a refresh token
     * only during the first authorization or
     * when prompt=consent is used.
     */
    const refreshToken =
      tokens.refresh_token ||
      existingConnection
        ?.refreshToken ||
      "";

    if (!refreshToken) {
      throw new Error(
        "Google did not return a refresh token. Revoke Twinn from your Google Account permissions and connect YouTube again."
      );
    }

    const accessToken =
      tokens.access_token ||
      existingConnection
        ?.accessToken ||
      "";

    const thumbnail =
      channel.snippet
        ?.thumbnails?.high?.url ||
      channel.snippet
        ?.thumbnails?.medium?.url ||
      channel.snippet
        ?.thumbnails?.default
        ?.url ||
      "";

    const tokenExpiryDate =
      tokens.expiry_date
        ? new Date(
            tokens.expiry_date
          )
        : existingConnection
            ?.tokenExpiryDate ||
          null;

    return Connection.findOneAndUpdate(
      {
        userId,
        platform: "youtube",
      },
      {
        $set: {
          userId,
          platform: "youtube",

          platformUserId:
            channel.id,

          username:
            channel.snippet?.title ||
            "",

          name:
            channel.snippet?.title ||
            "YouTube Channel",

          avatarUrl:
            thumbnail,

          accessToken,

          refreshToken,

          tokenExpiryDate,

          youtubeChannelId:
            channel.id,

          youtubeChannelTitle:
            channel.snippet?.title ||
            "YouTube Channel",

          youtubeChannelThumbnail:
            thumbnail,

          connected: true,

          youtubeLiveStatus:
            existingConnection
              ?.youtubeLiveStatus ||
            "idle",

          metadata: {
            channelDescription:
              channel.snippet
                ?.description ||
              "",

            channelCustomUrl:
              channel.snippet
                ?.customUrl ||
              "",

            country:
              channel.snippet
                ?.country ||
              "",

            privacyStatus:
              channel.status
                ?.privacyStatus ||
              "",
          },
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );
  };

/* =========================================================
   HANDLE OAUTH CALLBACK
========================================================= */

exports.handleCallback =
  async (
    platform,
    code,
    userId
  ) => {
    const normalizedPlatform =
      validatePlatform(platform);

    if (!code) {
      throw new Error(
        "OAuth authorization code is missing."
      );
    }

    if (!userId) {
      throw new Error(
        "User ID is missing. Please log in and connect again."
      );
    }

    if (
      normalizedPlatform ===
      "facebook"
    ) {
      return handleFacebookCallback(
        code,
        userId
      );
    }

    if (
      normalizedPlatform ===
      "instagram"
    ) {
      return handleInstagramCallback(
        code,
        userId
      );
    }

    if (
      normalizedPlatform ===
      "youtube"
    ) {
      return handleYouTubeCallback(
        code,
        userId
      );
    }

    throw new Error(
      `Unsupported social platform: ${normalizedPlatform}`
    );
  };

/* =========================================================
   GET AUTHENTICATED YOUTUBE CLIENT
========================================================= */

exports.getYouTubeClientForUser =
  async (userId) => {
    if (!userId) {
      throw new Error(
        "User ID is required."
      );
    }

    const connection =
      await Connection.findOne({
        userId,
        platform: "youtube",
        connected: true,
      }).select(
        [
          "+accessToken",
          "+refreshToken",
          "+youtubeStreamKey",
        ].join(" ")
      );

    if (!connection) {
      throw new Error(
        "YouTube is not connected."
      );
    }

    if (
      !connection.refreshToken
    ) {
      throw new Error(
        "YouTube refresh token is missing. Disconnect and reconnect YouTube."
      );
    }

    const oauth2Client =
      createYouTubeOAuthClient();

    oauth2Client.setCredentials({
      access_token:
        connection.accessToken ||
        undefined,

      refresh_token:
        connection.refreshToken,

      expiry_date:
        connection.tokenExpiryDate
          ? new Date(
              connection.tokenExpiryDate
            ).getTime()
          : undefined,
    });

    /*
     * Save refreshed Google tokens whenever
     * googleapis refreshes the access token.
     */
    oauth2Client.on(
      "tokens",
      async (tokens) => {
        try {
          const tokenUpdate = {};

          if (
            tokens.access_token
          ) {
            tokenUpdate.accessToken =
              tokens.access_token;
          }

          if (
            tokens.refresh_token
          ) {
            tokenUpdate.refreshToken =
              tokens.refresh_token;
          }

          if (
            tokens.expiry_date
          ) {
            tokenUpdate.tokenExpiryDate =
              new Date(
                tokens.expiry_date
              );
          }

          if (
            Object.keys(
              tokenUpdate
            ).length > 0
          ) {
            await Connection.updateOne(
              {
                _id:
                  connection._id,
              },
              {
                $set:
                  tokenUpdate,
              }
            );
          }
        } catch (error) {
          console.error(
            "SAVE REFRESHED YOUTUBE TOKEN ERROR:",
            error.message
          );
        }
      }
    );

    const youtube =
      google.youtube({
        version: "v3",
        auth: oauth2Client,
      });

    return {
      youtube,
      oauth2Client,
      connection,
    };
  };

/* =========================================================
   GET CONNECTIONS
========================================================= */

exports.getConnections =
  async (userId) => {
    if (!userId) {
      throw new Error(
        "User ID is required."
      );
    }

    return Connection.find({
      userId,
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
      });
  };

/* =========================================================
   DELETE CONNECTION
========================================================= */

exports.deleteConnection =
  async (
    userId,
    platform
  ) => {
    const normalizedPlatform =
      validatePlatform(platform);

    if (!userId) {
      throw new Error(
        "User ID is required."
      );
    }

    const connection =
      await Connection.findOne({
        userId,
        platform:
          normalizedPlatform,
      }).select(
        [
          "+accessToken",
          "+refreshToken",
        ].join(" ")
      );

    if (!connection) {
      return null;
    }

    /*
     * Revoke Google authorization when the
     * user disconnects YouTube.
     */
    if (
      normalizedPlatform ===
        "youtube" &&
      connection.refreshToken
    ) {
      try {
        const oauth2Client =
          createYouTubeOAuthClient();

        await oauth2Client.revokeToken(
          connection.refreshToken
        );
      } catch (error) {
        /*
         * Still remove the local connection if
         * Google token revocation fails.
         */
        console.error(
          "YOUTUBE TOKEN REVOCATION ERROR:",
          error.response?.data ||
            error.message
        );
      }
    }

    await connection.deleteOne();

    return connection;
  };