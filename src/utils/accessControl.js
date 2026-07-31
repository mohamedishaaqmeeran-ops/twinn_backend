const {
  ROLES,
  ALL_ROLES,
  INTERNAL_ROLES,
} = require(
  "../config/roles"
);

const {
  PLANS,
  ALL_PLANS,
  PLAN_ORDER,
  PLAN_LIMITS,
} = require(
  "../config/plans"
);

/* =========================================================
   NORMALIZE RAW VALUE
========================================================= */

const normalizeValue = (
  value
) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(
      /[\s_-]/g,
      ""
    );

/* =========================================================
   ROLE NORMALIZATION
========================================================= */

const normalizeRole = (
  role
) => {
  const normalized =
    normalizeValue(role);

  const roleMap = {
    user:
      ROLES.USER,

    customer:
      ROLES.USER,

    viewer:
      ROLES.USER,

    contentcreator:
      ROLES.CONTENT_CREATOR,

    content:
      ROLES.CONTENT_CREATOR,

    influencer:
      ROLES.CONTENT_CREATOR,

    brandcreator:
      ROLES.BRAND_CREATOR,

    creator:
      ROLES.BRAND_CREATOR,

    brand:
      ROLES.BRAND_CREATOR,

    seller:
      ROLES.BRAND_CREATOR,

    manager:
      ROLES.MANAGER,

    admin:
      ROLES.ADMIN,

    administrator:
      ROLES.ADMIN,
  };

  return (
    roleMap[normalized] ||
    ""
  );
};

/* =========================================================
   PLAN NORMALIZATION
========================================================= */

const normalizePlan = (
  plan
) => {
  const normalized =
    normalizeValue(plan);

  const planMap = {
    free:
      PLANS.FREE,

    freetrial:
      PLANS.FREE,

    trial:
      PLANS.FREE,

    basic:
      PLANS.FREE,

    starter:
      PLANS.STARTER,

    start:
      PLANS.STARTER,

    entry:
      PLANS.STARTER,

    pro:
      PLANS.PRO,

    professional:
      PLANS.PRO,

    premium:
      PLANS.PRO,

    business:
      PLANS.BUSINESS,

    company:
      PLANS.BUSINESS,

    enterprise:
      PLANS.BUSINESS,

    agency:
      PLANS.AGENCY,

    agencyplan:
      PLANS.AGENCY,

    custom:
      PLANS.AGENCY,

    whitelabel:
      PLANS.AGENCY,
  };

  return (
    planMap[normalized] ||
    ""
  );
};

/* =========================================================
   ROLE VALIDATION
========================================================= */

const isValidRole = (
  role
) =>
  ALL_ROLES.includes(
    normalizeRole(role)
  );

const isInternalRole = (
  role
) =>
  INTERNAL_ROLES.includes(
    normalizeRole(role)
  );

const isAdmin = (
  role
) =>
  normalizeRole(role) ===
  ROLES.ADMIN;

const isManager = (
  role
) =>
  normalizeRole(role) ===
  ROLES.MANAGER;

const isContentCreator = (
  role
) =>
  normalizeRole(role) ===
  ROLES.CONTENT_CREATOR;

const isBrandCreator = (
  role
) =>
  normalizeRole(role) ===
  ROLES.BRAND_CREATOR;

const isUser = (
  role
) =>
  normalizeRole(role) ===
  ROLES.USER;

/* =========================================================
   PLAN VALIDATION
========================================================= */

const isValidPlan = (
  plan
) =>
  ALL_PLANS.includes(
    normalizePlan(plan)
  );

const isFreePlan = (
  plan
) =>
  normalizePlan(plan) ===
  PLANS.FREE;

const isStarterPlan = (
  plan
) =>
  normalizePlan(plan) ===
  PLANS.STARTER;

const isProPlan = (
  plan
) =>
  normalizePlan(plan) ===
  PLANS.PRO;

const isBusinessPlan = (
  plan
) =>
  normalizePlan(plan) ===
  PLANS.BUSINESS;

const isAgencyPlan = (
  plan
) =>
  normalizePlan(plan) ===
  PLANS.AGENCY;

const isPaidPlan = (
  plan
) => {
  const normalizedPlan =
    normalizePlan(plan);

  return [
    PLANS.STARTER,
    PLANS.PRO,
    PLANS.BUSINESS,
    PLANS.AGENCY,
  ].includes(
    normalizedPlan
  );
};

/* =========================================================
   PLAN COMPARISON
========================================================= */

const hasMinimumPlan = (
  currentPlan,
  requiredPlan
) => {
  const normalizedCurrent =
    normalizePlan(
      currentPlan
    );

  const normalizedRequired =
    normalizePlan(
      requiredPlan
    );

  const currentOrder =
    PLAN_ORDER[
      normalizedCurrent
    ];

  const requiredOrder =
    PLAN_ORDER[
      normalizedRequired
    ];

  if (
    currentOrder ===
      undefined ||
    requiredOrder ===
      undefined
  ) {
    return false;
  }

  return (
    currentOrder >=
    requiredOrder
  );
};

/* =========================================================
   GET PLAN LIMITS
========================================================= */

const getPlanLimits = (
  plan
) => {
  const normalizedPlan =
    normalizePlan(plan);

  return (
    PLAN_LIMITS[
      normalizedPlan
    ] ||
    PLAN_LIMITS[
      PLANS.FREE
    ]
  );
};

/* =========================================================
   GET SINGLE PLAN LIMIT
========================================================= */

const getPlanLimit = (
  plan,
  resource
) => {
  const limits =
    getPlanLimits(plan);

  if (
    !Object.prototype
      .hasOwnProperty.call(
        limits,
        resource
      )
  ) {
    return null;
  }

  return limits[
    resource
  ];
};

/* =========================================================
   CHECK FEATURE ACCESS
========================================================= */

const hasFeatureAccess = (
  plan,
  feature
) => {
  const limits =
    getPlanLimits(plan);

  const value =
    limits[feature];

  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }

  if (
    typeof value ===
    "number"
  ) {
    return (
      value > 0 ||
      value === Infinity
    );
  }

  return Boolean(value);
};

/* =========================================================
   CHECK RESOURCE LIMIT
========================================================= */

const canUseResource = ({
  plan,
  resource,
  currentUsage = 0,
  requestedAmount = 1,
}) => {
  const limit =
    getPlanLimit(
      plan,
      resource
    );

  const used =
    Math.max(
      Number(
        currentUsage || 0
      ),
      0
    );

  const requested =
    Math.max(
      Number(
        requestedAmount || 1
      ),
      1
    );

  if (
    limit === null ||
    limit === undefined
  ) {
    return {
      allowed: false,
      limit: null,
      currentUsage: used,
      requestedAmount:
        requested,
      remaining: 0,
      reason:
        "RESOURCE_NOT_CONFIGURED",
    };
  }

  if (
    limit === Infinity
  ) {
    return {
      allowed: true,
      limit: Infinity,
      currentUsage: used,
      requestedAmount:
        requested,
      remaining: Infinity,
      reason: null,
    };
  }

  const remaining =
    Math.max(
      limit - used,
      0
    );

  const allowed =
    used + requested <=
    limit;

  return {
    allowed,
    limit,
    currentUsage: used,
    requestedAmount:
      requested,
    remaining,
    reason:
      allowed
        ? null
        : "PLAN_LIMIT_REACHED",
  };
};

/* =========================================================
   ROLE AND PLAN RELATIONSHIP
========================================================= */

const canHaveSubscriptionPlan = (
  role
) =>
  isBrandCreator(role);

const getSafePlanForRole = (
  role,
  plan
) => {
  if (
    !canHaveSubscriptionPlan(
      role
    )
  ) {
    return null;
  }

  return (
    normalizePlan(plan) ||
    PLANS.FREE
  );
};

/* =========================================================
   INTERNAL ROLE ACCESS
========================================================= */

const canManageUsers = (
  role
) =>
  [
    ROLES.ADMIN,
    ROLES.MANAGER,
  ].includes(
    normalizeRole(role)
  );

const canManageSystem = (
  role
) =>
  isAdmin(role);

const canManagePlans = (
  role
) =>
  isAdmin(role);

const canViewAdminAnalytics = (
  role
) =>
  isInternalRole(role);

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  normalizeValue,

  normalizeRole,
  normalizePlan,

  isValidRole,
  isValidPlan,

  isInternalRole,
  isAdmin,
  isManager,
  isContentCreator,
  isBrandCreator,
  isUser,

  isFreePlan,
  isStarterPlan,
  isProPlan,
  isBusinessPlan,
  isAgencyPlan,
  isPaidPlan,

  hasMinimumPlan,

  getPlanLimits,
  getPlanLimit,
  hasFeatureAccess,
  canUseResource,

  canHaveSubscriptionPlan,
  getSafePlanForRole,

  canManageUsers,
  canManageSystem,
  canManagePlans,
  canViewAdminAnalytics,
};