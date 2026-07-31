const {
  ROLES,
} = require(
  "../config/roles"
);

const {
  PLANS,
  PLAN_LIMITS,
} = require(
  "../config/plans"
);

const {
  normalizeRole,
  normalizePlan,
  isBrandCreator,
} = require(
  "./accessControl"
);

/* =========================================================
   PRIVATE FIELDS
========================================================= */

const PRIVATE_FIELDS = [
  "password",
  "passwordHash",

  "verificationToken",
  "verificationTokenExpiresAt",

  "resetToken",
  "resetTokenExpiresAt",

  "tokenVersion",

  "googleAccessToken",
  "googleRefreshToken",

  "facebookAccessToken",
  "instagramAccessToken",
  "youtubeAccessToken",
  "tiktokAccessToken",

  "__v",
];

/* =========================================================
   PAYMENT IDENTIFIERS
========================================================= */

const PRIVATE_PAYMENT_FIELDS = [
  "razorpayCustomerId",
  "razorpaySubscriptionId",
  "razorpayOrderId",

  "stripeCustomerId",
  "stripeSubscriptionId",
  "stripePaymentIntentId",

  "lastPaymentId",
  "paymentGatewayCustomerId",
  "paymentGatewaySubscriptionId",
];

/* =========================================================
   SUBSCRIPTION FIELDS
========================================================= */

const SUBSCRIPTION_FIELDS = [
  "plan",
  "billingCycle",

  "planStartedAt",
  "planExpiresAt",
  "planCancelledAt",

  "cancelAtPeriodEnd",
  "subscriptionStatus",

  "trialStartedAt",
  "trialExpiresAt",
  "isTrialUsed",
  "trialPlan",

  "paymentGateway",

  "lastPaymentAt",

  "planLimits",

  "isTrialActive",
  "trialDaysRemaining",

  "isPaidPlanActive",
  "isSubscriptionActive",
  "isPlanExpired",
];

/* =========================================================
   DELETE FIELDS
========================================================= */

const deleteFields = (
  object,
  fields
) => {
  fields.forEach(
    (field) => {
      delete object[field];
    }
  );
};

/* =========================================================
   DATE TO ISO
========================================================= */

const toISOStringOrNull = (
  value
) => {
  if (!value) {
    return null;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.toISOString();
};

/* =========================================================
   SUBSCRIPTION SUMMARY
========================================================= */

const buildSubscriptionSummary = (
  source
) => {
  const plan =
    normalizePlan(
      source.plan
    ) ||
    PLANS.FREE;

  const limits =
    PLAN_LIMITS[plan] ||
    PLAN_LIMITS[
      PLANS.FREE
    ];

  return {
    plan,

    billingCycle:
      source.billingCycle ||
      null,

    status:
      source.subscriptionStatus ||
      "inactive",

    startedAt:
      toISOStringOrNull(
        source.planStartedAt
      ),

    expiresAt:
      toISOStringOrNull(
        source.planExpiresAt
      ),

    cancelledAt:
      toISOStringOrNull(
        source.planCancelledAt
      ),

    cancelAtPeriodEnd:
      Boolean(
        source.cancelAtPeriodEnd
      ),

    trial: {
      active:
        Boolean(
          source.isTrialActive
        ),

      used:
        Boolean(
          source.isTrialUsed
        ),

      plan:
        normalizePlan(
          source.trialPlan
        ) ||
        null,

      startedAt:
        toISOStringOrNull(
          source.trialStartedAt
        ),

      expiresAt:
        toISOStringOrNull(
          source.trialExpiresAt
        ),

      daysRemaining:
        Number(
          source.trialDaysRemaining ||
            0
        ),
    },

    isPaidPlanActive:
      Boolean(
        source.isPaidPlanActive
      ),

    isActive:
      Boolean(
        source.isSubscriptionActive
      ),

    isExpired:
      Boolean(
        source.isPlanExpired
      ),

    requiresUpgrade:
      !Boolean(
        source.isSubscriptionActive
      ),

    limits,
  };
};

/* =========================================================
   SANITIZE USER
========================================================= */

const sanitizeUser = (
  user
) => {
  if (!user) {
    return null;
  }

  const source =
    typeof user.toObject ===
    "function"
      ? user.toObject({
          virtuals: true,

          getters: true,

          transform:
            false,
        })
      : {
          ...user,
        };

  /*
   Remove all credentials and tokens.
  */

  deleteFields(
    source,
    PRIVATE_FIELDS
  );

  /*
   Payment-provider IDs must not be returned
   to the frontend.
  */

  deleteFields(
    source,
    PRIVATE_PAYMENT_FIELDS
  );

  const normalizedRole =
    normalizeRole(
      source.role
    ) ||
    ROLES.USER;

  source.role =
    normalizedRole;

  /*
   Ensure MongoDB id is available consistently.
  */

  if (
    source._id &&
    !source.id
  ) {
    source.id =
      String(
        source._id
      );
  }

  if (source._id) {
    source._id =
      String(
        source._id
      );
  }

  /*
   Only brand creators can have a plan.
  */

  if (
    isBrandCreator(
      normalizedRole
    )
  ) {
    const subscription =
      buildSubscriptionSummary(
        source
      );

    source.plan =
      subscription.plan;

    source.subscription =
      subscription;

    /*
     Keep commonly used top-level fields
     for existing frontend compatibility.
    */

    source.subscriptionStatus =
      subscription.status;

    source.billingCycle =
      subscription.billingCycle;

    source.planStartedAt =
      subscription.startedAt;

    source.planExpiresAt =
      subscription.expiresAt;

    source.cancelAtPeriodEnd =
      subscription
        .cancelAtPeriodEnd;

    source.trialStartedAt =
      subscription
        .trial.startedAt;

    source.trialExpiresAt =
      subscription
        .trial.expiresAt;

    source.trialDaysRemaining =
      subscription
        .trial.daysRemaining;

    source.isTrialActive =
      subscription
        .trial.active;

    source.isSubscriptionActive =
      subscription.isActive;

    source.isPaidPlanActive =
      subscription
        .isPaidPlanActive;

    source.isPlanExpired =
      subscription.isExpired;

    source.requiresUpgrade =
      subscription
        .requiresUpgrade;

    source.planLimits =
      subscription.limits;
  } else {
    /*
     User, manager and admin accounts must
     never expose subscription fields.
    */

    deleteFields(
      source,
      SUBSCRIPTION_FIELDS
    );

    delete source.subscription;
  }

  return source;
};

module.exports =
  sanitizeUser;