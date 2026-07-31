/* =========================================================
   PLAN CONSTANTS
========================================================= */

const PLANS = Object.freeze({
  FREE: "free",
  STARTER: "starter",
  PRO: "pro",
  BUSINESS: "business",
  AGENCY: "agency",
});

/* =========================================================
   ALL PLANS
========================================================= */

const ALL_PLANS = Object.freeze(
  Object.values(PLANS)
);

/* =========================================================
   PLAN ORDER
========================================================= */

const PLAN_ORDER = Object.freeze({
  free: 0,
  starter: 1,
  pro: 2,
  business: 3,
  agency: 4,
});

/* =========================================================
   PLAN LIMITS
========================================================= */

const PLAN_LIMITS = Object.freeze({
  free: Object.freeze({
    twins: 1,
    products: 10,
    platforms: 1,
    schedules: 1,
    aiRepliesPerMonth: 100,
    teamSeats: 1,
  }),

  starter: Object.freeze({
    twins: 2,
    products: 30,
    platforms: 2,
    schedules: 10,
    aiRepliesPerMonth: 300,
    teamSeats: 1,
  }),

  pro: Object.freeze({
    twins: 3,
    products: 100,
    platforms: 4,
    schedules: 50,
    aiRepliesPerMonth: Infinity,
    teamSeats: 1,
  }),

  business: Object.freeze({
    twins: Infinity,
    products: Infinity,
    platforms: 5,
    schedules: Infinity,
    aiRepliesPerMonth: Infinity,
    teamSeats: 5,
  }),

  agency: Object.freeze({
    twins: Infinity,
    products: Infinity,
    platforms: 9,
    schedules: Infinity,
    aiRepliesPerMonth: Infinity,
    teamSeats: Infinity,
  }),
});

/* =========================================================
   NORMALIZE PLAN
========================================================= */

const normalizePlan = (
  plan
) =>
  String(
    plan ||
      PLANS.FREE
  )
    .trim()
    .toLowerCase()
    .replace(
      /[\s_-]/g,
      ""
    );

/* =========================================================
   CHECK VALID PLAN
========================================================= */

const isValidPlan = (
  plan
) =>
  ALL_PLANS.includes(
    normalizePlan(plan)
  );

/* =========================================================
   GET PLAN ORDER
========================================================= */

const getPlanOrder = (
  plan
) => {
  const normalized =
    normalizePlan(plan);

  return (
    PLAN_ORDER[
      normalized
    ] ??
    PLAN_ORDER.free
  );
};

/* =========================================================
   GET PLAN LIMITS
========================================================= */

const getPlanLimits = (
  plan
) => {
  const normalized =
    normalizePlan(plan);

  return (
    PLAN_LIMITS[
      normalized
    ] ||
    PLAN_LIMITS.free
  );
};

/* =========================================================
   GET RESOURCE LIMIT
========================================================= */

const getPlanLimit = (
  plan,
  resource
) => {
  const limits =
    getPlanLimits(plan);

  return limits[
    resource
  ];
};

/* =========================================================
   CHECK MINIMUM PLAN
========================================================= */

const hasMinimumPlan = (
  currentPlan,
  requiredPlan
) => {
  const current =
    getPlanOrder(
      currentPlan
    );

  const required =
    getPlanOrder(
      requiredPlan
    );

  return (
    current >= required
  );
};

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  PLANS,
  ALL_PLANS,
  PLAN_ORDER,
  PLAN_LIMITS,

  normalizePlan,
  isValidPlan,
  getPlanOrder,
  getPlanLimits,
  getPlanLimit,
  hasMinimumPlan,
};