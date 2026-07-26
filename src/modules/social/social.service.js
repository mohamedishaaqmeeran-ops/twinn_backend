// modules/social/social.service.js

const fetch = require(
  "node-fetch"
);

const {
  google,
} = require(
  "googleapis"
);

const Connection =
  require(
    "../../models/Connection"
  );

/* =========================================================
   CONFIGURATION
========================================================= */

const REDIRECT_BASE =
  process.env.REDIRECT_BASE ||
  "https://twinn-backend.onrender.com";

const META_VERSION =
  process.env.META_API_VERSION ||
  "v23.0";

const SUPPORTED_OAUTH_PLATFORMS = [
  "instagram",
  "facebook",
  "youtube",
];

/* =========================================================
   HELPERS
========================================================= */

const normalizePlatform = (
  platform
) => {
  return String(
    platform || ""
  )
    .trim()
    .toLowerCase();
};

const validateOAuthPlatform = (
  platform
) => {
  const normalizedPlatform =
    normalizePlatform(
      platform
    );

  if (
    !SUPPORTED_OAUTH_PLATFORMS.includes(
      normalizedPlatform
    )
  ) {
    throw new Error(
      `Unsupported OAuth platform: ${
        normalizedPlatform ||
        "unknown"
      }`
    );
  }

  return normalizedPlatform;
};

const ensureValue = (
  value,
  message
) => {
  if (!value) {
    throw new Error(
      message
    );
  }

  return value;
};

const parseJsonResponse =
  async (
    response
  ) => {
    const data =
      await response
        .json()
        .catch(
          () => ({})
        );

    return data;
  };

/* =========================================================
   META CONFIGURATION
========================================================= */

const getMetaAppId = (
  platform
) => {
  if (
    platform ===
    "instagram"
  ) {
    return process.env
      .INSTAGRAM_APP_ID;
  }

  if (
    platform ===
    "facebook"
  ) {
    return process.env
      .FACEBOOK_APP_ID;
  }

  throw new Error(
    `Unsupported Meta platform: ${platform}`
  );
};

const getMetaAppSecret = (
  platform
) => {
  if (
    platform ===
    "instagram"
  ) {
    return process.env
      .INSTAGRAM_APP_SECRET;
  }

  if (
    platform ===
    "facebook"
  ) {
    return process.env
      .FACEBOOK_APP_SECRET;
  }

  throw new Error(
    `Unsupported Meta platform: ${platform}`
  );
};

const getMetaRedirectUri = (
  platform
) => {
  return (
    `${REDIRECT_BASE}` +
    `/api/social/callback/` +
    `${platform}`
  );
};

/* =========================================================
   YOUTUBE OAUTH CLIENT
========================================================= */

const createYouTubeOAuthClient =
  () => {
    const clientId =
      process.env
        .GOOGLE_CLIENT_ID;

    const clientSecret =
      process.env
        .GOOGLE_CLIENT_SECRET;

    const redirectUri =
      process.env
        .YOUTUBE_REDIRECT_URI ||
      `${REDIRECT_BASE}/api/social/callback/youtube`;

    ensureValue(
      clientId,
      "GOOGLE_CLIENT_ID is missing."
    );

    ensureValue(
      clientSecret,
      "GOOGLE_CLIENT_SECRET is missing."
    );

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
    getMetaAppId(
      platform
    );

  ensureValue(
    appId,
    `${platform.toUpperCase()} App ID is missing.`
  );

  const redirectUri =
    getMetaRedirectUri(
      platform
    );

  const instagramScopes = [
    "public_profile",
    "pages_show_list",
    "pages_read_engagement",
    "business_management",
    "instagram_basic",
  ];

  const facebookScopes = [
    "public_profile",
    "pages_show_list",
    "pages_read_engagement",
  ];

  const scopes =
    platform ===
    "instagram"
      ? instagramScopes
      : facebookScopes;

  return (
    `https://www.facebook.com/` +
    `${META_VERSION}/dialog/oauth` +
    `?client_id=${encodeURIComponent(
      appId
    )}` +
    `&redirect_uri=${encodeURIComponent(
      redirectUri
    )}` +
    `&scope=${encodeURIComponent(
      scopes.join(",")
    )}` +
    `&response_type=code` +
    `&auth_type=rerequest` +
    `&state=${encodeURIComponent(
      state
    )}`
  );
};

/* =========================================================
   BUILD YOUTUBE OAUTH URL
========================================================= */

const getYouTubeOAuthURL = (
  state
) => {
  const oauth2Client =
    createYouTubeOAuthClient();

  return oauth2Client.generateAuthUrl(
    {
      access_type:
        "offline",

      prompt:
        "consent",

      include_granted_scopes:
        true,

      state,

      scope: [
        "https://www.googleapis.com/auth/youtube",
        "https://www.googleapis.com/auth/youtube.force-ssl",
      ],
    }
  );
};

/* =========================================================
   GET OAUTH URL
========================================================= */

exports.getOAuthURL = (
  platform,
  state
) => {
  const normalizedPlatform =
    validateOAuthPlatform(
      platform
    );

  ensureValue(
    state,
    "OAuth state is required."
  );

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
    `Unsupported OAuth platform: ${normalizedPlatform}`
  );
};

/* =========================================================
   EXCHANGE META AUTHORIZATION CODE
========================================================= */

const exchangeMetaCode =
  async (
    platform,
    code
  ) => {
    const appId =
      getMetaAppId(
        platform
      );

    const appSecret =
      getMetaAppSecret(
        platform
      );

    ensureValue(
      appId,
      `${platform.toUpperCase()} App ID is missing.`
    );

    ensureValue(
      appSecret,
      `${platform.toUpperCase()} App Secret is missing.`
    );

    ensureValue(
      code,
      "Meta authorization code is missing."
    );

    const redirectUri =
      getMetaRedirectUri(
        platform
      );

    const tokenUrl =
      `https://graph.facebook.com/` +
      `${META_VERSION}/oauth/access_token` +
      `?client_id=${encodeURIComponent(
        appId
      )}` +
      `&client_secret=${encodeURIComponent(
        appSecret
      )}` +
      `&redirect_uri=${encodeURIComponent(
        redirectUri
      )}` +
      `&code=${encodeURIComponent(
        code
      )}`;

    const response =
      await fetch(
        tokenUrl
      );

    const data =
      await parseJsonResponse(
        response
      );

    if (
      !response.ok ||
      !data.access_token
    ) {
      throw new Error(
        data.error?.message ||
        "Meta access token exchange failed."
      );
    }

    return data;
  };

/* =========================================================
   EXCHANGE SHORT-LIVED META TOKEN
========================================================= */

const exchangeLongLivedMetaToken =
  async (
    platform,
    shortLivedToken
  ) => {
    const appId =
      getMetaAppId(
        platform
      );

    const appSecret =
      getMetaAppSecret(
        platform
      );

    if (
      !appId ||
      !appSecret ||
      !shortLivedToken
    ) {
      return {
        access_token:
          shortLivedToken,

        expires_in:
          null,
      };
    }

    const url =
      `https://graph.facebook.com/` +
      `${META_VERSION}/oauth/access_token` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${encodeURIComponent(
        appId
      )}` +
      `&client_secret=${encodeURIComponent(
        appSecret
      )}` +
      `&fb_exchange_token=${encodeURIComponent(
        shortLivedToken
      )}`;

    const response =
      await fetch(
        url
      );

    const data =
      await parseJsonResponse(
        response
      );

    if (
      !response.ok ||
      !data.access_token
    ) {
      console.error(
        "LONG-LIVED META TOKEN ERROR:",
        data.error?.message ||
        data
      );

      return {
        access_token:
          shortLivedToken,

        expires_in:
          null,
      };
    }

    return data;
  };

/* =========================================================
   FETCH FACEBOOK USER PROFILE
========================================================= */

const fetchFacebookUser =
  async (
    accessToken
  ) => {
    const url =
      `https://graph.facebook.com/` +
      `${META_VERSION}/me` +
      `?fields=id,name,picture` +
      `&access_token=${encodeURIComponent(
        accessToken
      )}`;

    const response =
      await fetch(
        url
      );

    const data =
      await parseJsonResponse(
        response
      );

    if (!response.ok) {
      throw new Error(
        data.error?.message ||
        "Unable to fetch Facebook profile."
      );
    }

    return data;
  };

/* =========================================================
   FETCH FACEBOOK PAGES
========================================================= */

const fetchFacebookPages =
  async (
    accessToken,
    includeInstagram =
      false
  ) => {
    const fields =
      includeInstagram
        ? [
            "id",
            "name",
            "picture",
            "access_token",
            "instagram_business_account{id,username,name,profile_picture_url}",
          ].join(",")
        : [
            "id",
            "name",
            "picture",
            "access_token",
          ].join(",");

    const url =
      `https://graph.facebook.com/` +
      `${META_VERSION}/me/accounts` +
      `?fields=${encodeURIComponent(
        fields
      )}` +
      `&access_token=${encodeURIComponent(
        accessToken
      )}`;

    const response =
      await fetch(
        url
      );

    const data =
      await parseJsonResponse(
        response
      );

    if (!response.ok) {
      throw new Error(
        data.error?.message ||
        "Unable to fetch Facebook Pages."
      );
    }

    return Array.isArray(
      data.data
    )
      ? data.data
      : [];
  };

/* =========================================================
   FETCH INSTAGRAM PROFILE
========================================================= */

const fetchInstagramProfile =
  async ({
    instagramAccountId,
    pageAccessToken,
  }) => {
    ensureValue(
      instagramAccountId,
      "Instagram account ID is missing."
    );

    ensureValue(
      pageAccessToken,
      "Facebook Page access token is missing."
    );

    const fields = [
      "id",
      "username",
      "name",
      "profile_picture_url",
    ].join(",");

    const url =
      `https://graph.facebook.com/` +
      `${META_VERSION}/` +
      `${instagramAccountId}` +
      `?fields=${encodeURIComponent(
        fields
      )}` +
      `&access_token=${encodeURIComponent(
        pageAccessToken
      )}`;

    const response =
      await fetch(
        url
      );

    const data =
      await parseJsonResponse(
        response
      );

    if (
      !response.ok ||
      data.error
    ) {
      throw new Error(
        data.error?.message ||
        "Unable to fetch Instagram profile."
      );
    }

    return data;
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

    const longLivedTokenData =
      await exchangeLongLivedMetaToken(
        "facebook",
        tokenData.access_token
      );

    const accessToken =
      longLivedTokenData
        .access_token ||
      tokenData.access_token;

    const [
      profile,
      pages,
    ] =
      await Promise.all([
        fetchFacebookUser(
          accessToken
        ).catch(
          () => null
        ),

        fetchFacebookPages(
          accessToken,
          false
        ),
      ]);

    const page =
      pages[0];

    if (!page) {
      throw new Error(
        "No Facebook Page was found. Create a Facebook Page or grant Twinn permission to manage one."
      );
    }

    if (
      !page.access_token
    ) {
      throw new Error(
        "Facebook Page access token was not returned."
      );
    }

    const pageAvatar =
      page.picture?.data
        ?.url ||
      profile?.picture
        ?.data?.url ||
      "";

    const expiryDate =
      longLivedTokenData
        .expires_in
        ? new Date(
            Date.now() +
              Number(
                longLivedTokenData
                  .expires_in
              ) *
                1000
          )
        : null;

    return Connection.findOneAndUpdate(
      {
        userId,

        platform:
          "facebook",
      },
      {
        $set: {
          userId,

          platform:
            "facebook",

          platformUserId:
            page.id,

          platformUsername:
            page.name ||
            "",

          username:
            page.name ||
            "",

          name:
            page.name ||
            "Facebook Page",

          avatarUrl:
            pageAvatar,

          profilePictureUrl:
            pageAvatar,

          pageId:
            page.id,

          pageName:
            page.name ||
            "Facebook Page",

          pageAccessToken:
            page.access_token,

          accessToken,

          refreshToken:
            "",

          tokenExpiryDate:
            expiryDate,

          connected:
            true,

          metadata: {
            connectionType:
              "oauth",

            facebookUserId:
              profile?.id ||
              "",

            facebookUserName:
              profile?.name ||
              "",

            tokenType:
              longLivedTokenData
                .token_type ||
              tokenData.token_type ||
              "bearer",

            tokenExpiresIn:
              longLivedTokenData
                .expires_in ||
              tokenData.expires_in ||
              null,

            connectedAt:
              new Date(),
          },
        },
      },
      {
        upsert:
          true,

        new:
          true,

        runValidators:
          true,

        setDefaultsOnInsert:
          true,
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

    const longLivedTokenData =
      await exchangeLongLivedMetaToken(
        "instagram",
        tokenData.access_token
      );

    const accessToken =
      longLivedTokenData
        .access_token ||
      tokenData.access_token;

    const pages =
      await fetchFacebookPages(
        accessToken,
        true
      );

    if (!pages.length) {
      throw new Error(
        "No Facebook Page was found for this account."
      );
    }

    const pageWithInstagram =
      pages.find(
        (
          page
        ) =>
          Boolean(
            page
              .instagram_business_account
              ?.id
          ) &&
          Boolean(
            page.access_token
          )
      );

    if (
      !pageWithInstagram
    ) {
      throw new Error(
        "No Instagram professional account linked to a manageable Facebook Page was found."
      );
    }

    const pageAccessToken =
      pageWithInstagram
        .access_token;

    const embeddedInstagram =
      pageWithInstagram
        .instagram_business_account;

    const instagramAccountId =
      embeddedInstagram?.id;

    ensureValue(
      instagramAccountId,
      "Instagram account ID was not returned."
    );

    let profile =
      embeddedInstagram;

    try {
      profile =
        await fetchInstagramProfile(
          {
            instagramAccountId,
            pageAccessToken,
          }
        );
    } catch (error) {
      console.error(
        "INSTAGRAM PROFILE FETCH ERROR:",
        error.message
      );
    }

    const username =
      profile?.username ||
      embeddedInstagram
        ?.username ||
      "";

    const name =
      profile?.name ||
      embeddedInstagram
        ?.name ||
      username ||
      "Instagram Account";

    const avatarUrl =
      profile
        ?.profile_picture_url ||
      embeddedInstagram
        ?.profile_picture_url ||
      "";

    const expiryDate =
      longLivedTokenData
        .expires_in
        ? new Date(
            Date.now() +
              Number(
                longLivedTokenData
                  .expires_in
              ) *
                1000
          )
        : null;

    return Connection.findOneAndUpdate(
      {
        userId,

        platform:
          "instagram",
      },
      {
        $set: {
          userId,

          platform:
            "instagram",

          platformUserId:
            instagramAccountId,

          platformUsername:
            username,

          username,

          name,

          avatarUrl,

          profilePictureUrl:
            avatarUrl,

          instagramAccountId,

          instagramUsername:
            username,

          pageId:
            pageWithInstagram.id,

          pageName:
            pageWithInstagram
              .name ||
            "",

          pageAccessToken,

          accessToken,

          refreshToken:
            "",

          tokenExpiryDate:
            expiryDate,

          connected:
            true,

          instagramLiveStatus:
            "idle",

          metadata: {
            connectionType:
              "oauth",

            instagramAccountId,

            username,

            name,

            profile_picture_url:
              avatarUrl,

            facebookPageId:
              pageWithInstagram.id,

            facebookPageName:
              pageWithInstagram
                .name ||
              "",

            tokenType:
              longLivedTokenData
                .token_type ||
              tokenData.token_type ||
              "bearer",

            tokenExpiresIn:
              longLivedTokenData
                .expires_in ||
              tokenData.expires_in ||
              null,

            connectedAt:
              new Date(),
          },
        },
      },
      {
        upsert:
          true,

        new:
          true,

        runValidators:
          true,

        setDefaultsOnInsert:
          true,
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

    const {
      tokens,
    } =
      await oauth2Client.getToken(
        code
      );

    if (
      !tokens.access_token &&
      !tokens.refresh_token
    ) {
      throw new Error(
        "Google did not return YouTube authorization tokens."
      );
    }

    const existingConnection =
      await Connection.findOne(
        {
          userId,

          platform:
            "youtube",
        }
      ).select(
        [
          "+accessToken",
          "+refreshToken",
        ].join(" ")
      );

    const accessToken =
      tokens.access_token ||
      existingConnection
        ?.accessToken ||
      "";

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

    oauth2Client.setCredentials(
      {
        ...tokens,

        access_token:
          accessToken,

        refresh_token:
          refreshToken,
      }
    );

    const youtube =
      google.youtube(
        {
          version:
            "v3",

          auth:
            oauth2Client,
        }
      );

    const channelResponse =
      await youtube.channels.list(
        {
          part: [
            "id",
            "snippet",
            "status",
            "contentDetails",
          ],

          mine:
            true,
        }
      );

    const channel =
      channelResponse
        .data
        .items?.[0];

    if (!channel) {
      throw new Error(
        "No YouTube channel was found for this Google account."
      );
    }

    const thumbnail =
      channel.snippet
        ?.thumbnails
        ?.high?.url ||
      channel.snippet
        ?.thumbnails
        ?.medium?.url ||
      channel.snippet
        ?.thumbnails
        ?.default?.url ||
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

        platform:
          "youtube",
      },
      {
        $set: {
          userId,

          platform:
            "youtube",

          platformUserId:
            channel.id,

          platformUsername:
            channel.snippet
              ?.title ||
            "",

          username:
            channel.snippet
              ?.title ||
            "",

          name:
            channel.snippet
              ?.title ||
            "YouTube Channel",

          avatarUrl:
            thumbnail,

          profilePictureUrl:
            thumbnail,

          accessToken,

          refreshToken,

          tokenExpiryDate,

          youtubeChannelId:
            channel.id,

          youtubeChannelTitle:
            channel.snippet
              ?.title ||
            "YouTube Channel",

          youtubeChannelThumbnail:
            thumbnail,

          connected:
            true,

          youtubeLiveStatus:
            existingConnection
              ?.youtubeLiveStatus ||
            "idle",

          metadata: {
            connectionType:
              "oauth",

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

            connectedAt:
              new Date(),
          },
        },
      },
      {
        upsert:
          true,

        new:
          true,

        runValidators:
          true,

        setDefaultsOnInsert:
          true,
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
      validateOAuthPlatform(
        platform
      );

    ensureValue(
      code,
      "OAuth authorization code is missing."
    );

    ensureValue(
      userId,
      "User ID is missing."
    );

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
      `Unsupported OAuth platform: ${normalizedPlatform}`
    );
  };

/* =========================================================
   GET AUTHENTICATED YOUTUBE CLIENT
========================================================= */

exports.getYouTubeClientForUser =
  async (
    userId
  ) => {
    ensureValue(
      userId,
      "User ID is required."
    );

    const connection =
      await Connection.findOne(
        {
          userId,

          platform:
            "youtube",

          connected:
            true,
        }
      ).select(
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

    oauth2Client.setCredentials(
      {
        access_token:
          connection.accessToken ||
          undefined,

        refresh_token:
          connection.refreshToken,

        expiry_date:
          connection
            .tokenExpiryDate
            ? new Date(
                connection
                  .tokenExpiryDate
              ).getTime()
            : undefined,
      }
    );

    oauth2Client.on(
      "tokens",
      async (
        tokens
      ) => {
        try {
          const update = {};

          if (
            tokens.access_token
          ) {
            update.accessToken =
              tokens.access_token;
          }

          if (
            tokens.refresh_token
          ) {
            update.refreshToken =
              tokens.refresh_token;
          }

          if (
            tokens.expiry_date
          ) {
            update.tokenExpiryDate =
              new Date(
                tokens.expiry_date
              );
          }

          if (
            Object.keys(
              update
            ).length > 0
          ) {
            await Connection.updateOne(
              {
                _id:
                  connection._id,
              },
              {
                $set:
                  update,
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
      google.youtube(
        {
          version:
            "v3",

          auth:
            oauth2Client,
        }
      );

    return {
      youtube,
      oauth2Client,
      connection,
    };
  };

/* =========================================================
   GET USER CONNECTIONS
========================================================= */

exports.getConnections =
  async (
    userId
  ) => {
    ensureValue(
      userId,
      "User ID is required."
    );

    return Connection.find(
      {
        userId,
      }
    )
      .select(
        [
          "-accessToken",
          "-refreshToken",
          "-pageAccessToken",
          "-instagramStreamKey",
          "-youtubeStreamKey",
          "-rumbleStreamKey",
          "-kickStreamKey",
          "-twitchStreamKey",
          "-twitterStreamKey",
        ].join(" ")
      )
      .sort(
        {
          createdAt:
            -1,
        }
      );
  };

/* =========================================================
   REVOKE META TOKEN
========================================================= */

const revokeMetaConnection =
  async (
    connection
  ) => {
    const token =
      connection.pageAccessToken ||
      connection.accessToken;

    if (!token) {
      return;
    }

    const url =
      `https://graph.facebook.com/` +
      `${META_VERSION}/me/permissions` +
      `?access_token=${encodeURIComponent(
        token
      )}`;

    const response =
      await fetch(
        url,
        {
          method:
            "DELETE",
        }
      );

    const data =
      await parseJsonResponse(
        response
      );

    if (!response.ok) {
      throw new Error(
        data.error?.message ||
        "Unable to revoke Meta authorization."
      );
    }
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
      validateOAuthPlatform(
        platform
      );

    ensureValue(
      userId,
      "User ID is required."
    );

    const connection =
      await Connection.findOne(
        {
          userId,

          platform:
            normalizedPlatform,
        }
      ).select(
        [
          "+accessToken",
          "+refreshToken",
          "+pageAccessToken",
        ].join(" ")
      );

    if (!connection) {
      return null;
    }

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
        console.error(
          "YOUTUBE TOKEN REVOCATION ERROR:",
          error.response?.data ||
          error.message
        );
      }
    }

    if (
      normalizedPlatform ===
        "facebook" ||
      normalizedPlatform ===
        "instagram"
    ) {
      try {
        await revokeMetaConnection(
          connection
        );
      } catch (error) {
        console.error(
          "META TOKEN REVOCATION ERROR:",
          error.message
        );
      }
    }

    await connection.deleteOne();

    return connection;
  };

/* =========================================================
   EXPORT HELPERS
========================================================= */

exports.normalizePlatform =
  normalizePlatform;

exports.validateOAuthPlatform =
  validateOAuthPlatform;

exports.createYouTubeOAuthClient =
  createYouTubeOAuthClient;