/* =========================================================
   PLAN NAMES
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
   PLAN LIMITS
========================================================= */

const PLAN_LIMITS =
  Object.freeze({
    free: Object.freeze({
      twins: 1,
      products: 10,
      platforms: 1,
      aiRepliesPerMonth: 100,
      teamSeats: 1,
    }),

    starter:
      Object.freeze({
        twins: 2,
        products: 30,
        platforms: 2,
        aiRepliesPerMonth: 300,
        teamSeats: 1,
      }),

    pro: Object.freeze({
      twins: 3,
      products: 100,
      platforms: 4,
      aiRepliesPerMonth:
        Infinity,
      teamSeats: 1,
    }),

    business:
      Object.freeze({
        twins: Infinity,
        products: Infinity,
        platforms: 5,
        aiRepliesPerMonth:
          Infinity,
        teamSeats: 5,
      }),

    agency:
      Object.freeze({
        twins: Infinity,
        products: Infinity,
        platforms: 9,
        aiRepliesPerMonth:
          Infinity,
        teamSeats: Infinity,
      }),
  });

/* =========================================================
   NORMALIZE PLAN
========================================================= */

const normalizePlan = (
  plan
) =>
  String(plan || PLANS.FREE)
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");

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
    PLAN_LIMITS.free
  );
};

/* =========================================================
   GET ONE PLAN LIMIT
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
   EXPORTS
========================================================= */

module.exports = {
  PLANS,
  ALL_PLANS,
  PLAN_LIMITS,

  normalizePlan,
  getPlanLimits,
  getPlanLimit,
};