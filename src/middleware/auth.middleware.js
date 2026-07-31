const jwt =
  require("jsonwebtoken");

const mongoose =
  require("mongoose");

const User =
  require("../models/User");

const {
  PLANS,
  PLAN_LIMITS,
} = require(
  "../config/plans"
);

const {
  normalizeRole,
  normalizePlan,
  isInternalRole,
  isBrandCreator,
} = require(
  "../utils/accessControl"
);

/* =========================================================
   CONFIGURATION
========================================================= */

const AUTH_COOKIE_NAME =
  process.env
    .AUTH_COOKIE_NAME ||
  "token";

const isProduction =
  process.env.NODE_ENV ===
  "production";

/* =========================================================
   COOKIE HELPERS
========================================================= */

const getClearCookieOptions =
  () => ({
    httpOnly: true,

    secure:
      isProduction,

    sameSite:
      isProduction
        ? "none"
        : "lax",

    path: "/",
  });

const clearAuthCookie = (
  res
) => {
  res.clearCookie(
    AUTH_COOKIE_NAME,
    getClearCookieOptions()
  );
};

/* =========================================================
   RESPONSE HELPERS
========================================================= */

const sendUnauthorized = (
  res,
  code,
  message
) =>
  res.status(401).json({
    success: false,
    code,
    message,
  });

const sendForbidden = (
  res,
  code,
  message,
  extra = {}
) =>
  res.status(403).json({
    success: false,
    code,
    message,
    ...extra,
  });

const sendServerError = (
  res,
  code,
  message
) =>
  res.status(500).json({
    success: false,
    code,
    message,
  });

/* =========================================================
   GET REQUEST TOKEN
========================================================= */

const getRequestToken = (
  req
) => {
  const cookieToken =
    String(
      req.cookies?.[
        AUTH_COOKIE_NAME
      ] || ""
    ).trim();

  if (cookieToken) {
    return cookieToken;
  }

  const authorization =
    String(
      req.headers
        ?.authorization ||
        ""
    ).trim();

  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i
    );

  return match
    ? String(
        match[1]
      ).trim()
    : null;
};

/* =========================================================
   VERIFY ACCESS TOKEN
========================================================= */

const verifyAccessToken = (
  token
) => {
  const secret =
    String(
      process.env
        .JWT_SECRET ||
        ""
    ).trim();

  if (!secret) {
    const error =
      new Error(
        "JWT_SECRET is missing."
      );

    error.code =
      "JWT_CONFIGURATION_ERROR";

    throw error;
  }

  return jwt.verify(
    token,
    secret,
    {
      algorithms: [
        "HS256",
      ],

      issuer:
        process.env
          .JWT_ISSUER ||
        "twinn-api",

      audience:
        process.env
          .JWT_AUDIENCE ||
        "twinn-client",
    }
  );
};

/* =========================================================
   NORMALIZE SUBSCRIPTION STATE
========================================================= */

const getSubscriptionState = (
  user,
  role,
  plan
) => {
  const creator =
    isBrandCreator(role);

  if (!creator) {
    return {
      plan: null,
      planLimits: null,
      subscriptionStatus:
        "inactive",
      isTrialActive:
        false,
      isPaidPlanActive:
        false,
      isSubscriptionActive:
        false,
      isPlanExpired:
        false,
      trialDaysRemaining:
        0,
      trialExpiresAt:
        null,
      planExpiresAt:
        null,
      requiresUpgrade:
        false,
    };
  }

  const effectivePlan =
    normalizePlan(plan) ||
    PLANS.FREE;

  const planLimits =
    PLAN_LIMITS[
      effectivePlan
    ] ||
    PLAN_LIMITS[
      PLANS.FREE
    ];

  const trialActive =
    Boolean(
      user.isTrialActive
    );

  const paidPlanActive =
    Boolean(
      user.isPaidPlanActive
    );

  const subscriptionActive =
    Boolean(
      user.isSubscriptionActive
    );

  const planExpired =
    Boolean(
      user.isPlanExpired
    );

  return {
    plan:
      effectivePlan,

    planLimits,

    subscriptionStatus:
      user.subscriptionStatus ||
      "inactive",

    isTrialActive:
      trialActive,

    isPaidPlanActive:
      paidPlanActive,

    isSubscriptionActive:
      subscriptionActive,

    isPlanExpired:
      planExpired,

    trialDaysRemaining:
      Number(
        user.trialDaysRemaining ||
          0
      ),

    trialExpiresAt:
      user.trialExpiresAt ||
      null,

    planExpiresAt:
      user.planExpiresAt ||
      null,

    requiresUpgrade:
      !subscriptionActive,
  };
};

/* =========================================================
   UPDATE EXPIRED SUBSCRIPTION STATUS
========================================================= */

const synchronizeSubscriptionStatus =
  async (
    user,
    role,
    plan
  ) => {
    if (
      !isBrandCreator(role)
    ) {
      return false;
    }

    let changed =
      false;

    const now =
      Date.now();

    /*
     Free Trial expiration
    */

    if (
      plan ===
        PLANS.FREE &&
      user.trialExpiresAt &&
      new Date(
        user.trialExpiresAt
      ).getTime() <= now &&
      user.subscriptionStatus !==
        "expired"
    ) {
      user.subscriptionStatus =
        "expired";

      changed =
        true;
    }

    /*
     Starter, Pro and Business expiration
    */

    if (
      plan !==
        PLANS.FREE &&
      plan !==
        PLANS.AGENCY &&
      user.planExpiresAt &&
      new Date(
        user.planExpiresAt
      ).getTime() <= now &&
      user.subscriptionStatus ===
        "active"
    ) {
      user.subscriptionStatus =
        "expired";

      changed =
        true;
    }

    /*
     Agency can remain active without an expiry
     because it is a manually managed contract.
    */

    if (changed) {
      await User.updateOne(
        {
          _id:
            user._id,
        },
        {
          $set: {
            subscriptionStatus:
              user.subscriptionStatus,
          },
        }
      );
    }

    return changed;
  };

/* =========================================================
   PROTECT
========================================================= */

exports.protect = async (
  req,
  res,
  next
) => {
  const token =
    getRequestToken(
      req
    );

  if (!token) {
    return sendUnauthorized(
      res,
      "TOKEN_MISSING",
      "Authentication token is missing"
    );
  }

  let decoded;

  try {
    decoded =
      verifyAccessToken(
        token
      );
  } catch (error) {
    clearAuthCookie(
      res
    );

    if (
      error.code ===
      "JWT_CONFIGURATION_ERROR"
    ) {
      console.error(
        "JWT CONFIGURATION ERROR:",
        error.message
      );

      return sendServerError(
        res,
        "AUTH_CONFIGURATION_ERROR",
        "Authentication service is not configured correctly"
      );
    }

    if (
      error.name ===
      "TokenExpiredError"
    ) {
      return sendUnauthorized(
        res,
        "TOKEN_EXPIRED",
        "Your session has expired. Please log in again."
      );
    }

    if (
      error.name ===
      "NotBeforeError"
    ) {
      return sendUnauthorized(
        res,
        "TOKEN_NOT_ACTIVE",
        "Authentication token is not active yet"
      );
    }

    return sendUnauthorized(
      res,
      "INVALID_TOKEN",
      "Invalid authentication token"
    );
  }

  /*
   This prevents refresh tokens or other JWT
   types from being accepted as access tokens.
  */

  if (
    decoded.accessType &&
    decoded.accessType !==
      "access"
  ) {
    clearAuthCookie(
      res
    );

    return sendUnauthorized(
      res,
      "INVALID_TOKEN_TYPE",
      "Invalid authentication token type"
    );
  }

  const userId =
    decoded?.id ||
    decoded?.userId ||
    decoded?.sub;

  if (!userId) {
    clearAuthCookie(
      res
    );

    return sendUnauthorized(
      res,
      "INVALID_TOKEN_PAYLOAD",
      "Authentication token does not contain a user identifier"
    );
  }

  if (
    !mongoose.Types
      .ObjectId
      .isValid(userId)
  ) {
    clearAuthCookie(
      res
    );

    return sendUnauthorized(
      res,
      "INVALID_USER_IDENTIFIER",
      "Authentication token contains an invalid user identifier"
    );
  }

  let user;

  try {
    user =
      await User
        .findById(
          userId
        )
        .select(
          "+tokenVersion"
        );
  } catch (error) {
    console.error(
      "AUTH USER LOOKUP ERROR:",
      error
    );

    return sendServerError(
      res,
      "USER_LOOKUP_FAILED",
      "Unable to verify the user account"
    );
  }

  if (!user) {
    clearAuthCookie(
      res
    );

    return sendUnauthorized(
      res,
      "USER_NOT_FOUND",
      "User account was not found"
    );
  }

  /* =======================================================
     TOKEN VERSION CHECK
  ======================================================= */

  const decodedTokenVersion =
    Number(
      decoded.tokenVersion ||
        0
    );

  const currentTokenVersion =
    Number(
      user.tokenVersion ||
        0
    );

  if (
    decodedTokenVersion !==
    currentTokenVersion
  ) {
    clearAuthCookie(
      res
    );

    return sendUnauthorized(
      res,
      "SESSION_REVOKED",
      "Your session is no longer valid. Please log in again."
    );
  }

  /* =======================================================
     ACCOUNT STATUS CHECK
  ======================================================= */

  if (
    user.isBlocked ||
    user.status ===
      "Blocked"
  ) {
    clearAuthCookie(
      res
    );

    return sendForbidden(
      res,
      "ACCOUNT_BLOCKED",
      user.blockedReason ||
        "Your account has been blocked"
    );
  }

  if (
    user.status !==
    "Active"
  ) {
    clearAuthCookie(
      res
    );

    return sendForbidden(
      res,
      "ACCOUNT_INACTIVE",
      "Your account is not active"
    );
  }

  /* =======================================================
     ROLE AND PLAN
  ======================================================= */

  const role =
    normalizeRole(
      user.role
    );

  if (!role) {
    clearAuthCookie(
      res
    );

    return sendForbidden(
      res,
      "INVALID_USER_ROLE",
      "Your account role is invalid"
    );
  }

  const creator =
    isBrandCreator(
      role
    );

  const plan =
    creator
      ? normalizePlan(
          user.plan
        ) ||
        PLANS.FREE
      : null;

  /*
   Keep MongoDB status synchronized when a
   trial or paid plan expires during an active session.

   A failure here should not log the user out.
  */

  try {
    await synchronizeSubscriptionStatus(
      user,
      role,
      plan
    );
  } catch (error) {
    console.error(
      "SUBSCRIPTION STATUS SYNC ERROR:",
      error.message
    );
  }

  const subscription =
    getSubscriptionState(
      user,
      role,
      plan
    );

  /* =======================================================
     ATTACH AUTH DATA
  ======================================================= */

  req.auth = {
    token,

    decoded,

    userId:
      user._id.toString(),

    role,

    plan:
      subscription.plan,

    planLimits:
      subscription.planLimits,

    subscriptionStatus:
      subscription
        .subscriptionStatus,

    isInternal:
      isInternalRole(
        role
      ),

    isBrandCreator:
      creator,

    isTrialActive:
      subscription
        .isTrialActive,

    isPaidPlanActive:
      subscription
        .isPaidPlanActive,

    isSubscriptionActive:
      subscription
        .isSubscriptionActive,

    isPlanExpired:
      subscription
        .isPlanExpired,

    requiresUpgrade:
      subscription
        .requiresUpgrade,

    trialDaysRemaining:
      subscription
        .trialDaysRemaining,

    trialExpiresAt:
      subscription
        .trialExpiresAt,

    planExpiresAt:
      subscription
        .planExpiresAt,
  };

  req.user =
    user;

  req.userId =
    req.auth.userId;

  req.userRole =
    role;

  req.userPlan =
    req.auth.plan;

  req.planLimits =
    req.auth.planLimits;

  req.subscriptionStatus =
    req.auth
      .subscriptionStatus;

  return next();
};

/* =========================================================
   OPTIONAL PROTECT
========================================================= */

exports.optionalProtect =
  async (
    req,
    res,
    next
  ) => {
    const token =
      getRequestToken(
        req
      );

    if (!token) {
      req.auth =
        null;

      req.user =
        null;

      req.userId =
        null;

      req.userRole =
        null;

      req.userPlan =
        null;

      return next();
    }

    return exports.protect(
      req,
      res,
      next
    );
  };

/* =========================================================
   REQUIRE ACTIVE SUBSCRIPTION
========================================================= */

exports.requireActiveSubscription =
  (
    req,
    res,
    next
  ) => {
    if (!req.user) {
      return sendUnauthorized(
        res,
        "AUTHENTICATION_REQUIRED",
        "Please log in to continue"
      );
    }

    /*
     Managers and admins bypass subscription checks.
    */

    if (
      req.auth
        ?.isInternal
    ) {
      return next();
    }

    if (
      !req.auth
        ?.isBrandCreator
    ) {
      return sendForbidden(
        res,
        "BRAND_CREATOR_REQUIRED",
        "This feature is available only to brand creator accounts"
      );
    }

    if (
      !req.auth
        ?.isSubscriptionActive
    ) {
      return sendForbidden(
        res,
        "SUBSCRIPTION_REQUIRED",
        req.auth
          ?.isPlanExpired
          ? "Your plan has expired. Upgrade or renew your subscription to continue."
          : "An active subscription is required to use this feature.",
        {
          plan:
            req.userPlan,

          subscriptionStatus:
            req.auth
              ?.subscriptionStatus,

          trialExpiresAt:
            req.auth
              ?.trialExpiresAt,

          planExpiresAt:
            req.auth
              ?.planExpiresAt,

          requiresUpgrade:
            true,
        }
      );
    }

    return next();
  };

/* =========================================================
   REQUIRE VERIFIED EMAIL
========================================================= */

exports.requireVerifiedEmail =
  (
    req,
    res,
    next
  ) => {
    if (!req.user) {
      return sendUnauthorized(
        res,
        "AUTHENTICATION_REQUIRED",
        "Please log in to continue"
      );
    }

    if (
      !req.user
        .isVerified
    ) {
      return sendForbidden(
        res,
        "EMAIL_NOT_VERIFIED",
        "Please verify your email before continuing"
      );
    }

    return next();
  };

/* =========================================================
   EXPORT UTILITIES
========================================================= */

exports.getRequestToken =
  getRequestToken;

exports.verifyAccessToken =
  verifyAccessToken;

exports.clearAuthCookie =
  clearAuthCookie;

exports.getSubscriptionState =
  getSubscriptionState;