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
        platforms: Infinity,
        aiRepliesPerMonth:
          Infinity,
        teamSeats: Infinity,
      }),
  });

const normalizePlan = (
  plan
) =>
  String(plan || "free")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");

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

const getPlanLimit = (
  plan,
  resource
) =>
  getPlanLimits(plan)[
    resource
  ];

module.exports = {
  PLAN_LIMITS,
  normalizePlan,
  getPlanLimits,
  getPlanLimit,
};