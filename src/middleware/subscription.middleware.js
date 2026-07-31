const {
  PLANS,
  ALL_PLANS,
  PLAN_ORDER,
  PLAN_LIMITS,
} = require(
  "../config/plans"
);

const {
  normalizePlan,
  normalizeRole,
  isBrandCreator,
  isInternalRole,
  hasMinimumPlan,
} = require(
  "../utils/accessControl"
);

/* =========================================================
   RESPONSE HELPERS
========================================================= */

const unauthorized = (
  res,
  code,
  message
) =>
  res.status(401).json({
    success: false,
    code,
    message,
  });

const forbidden = (
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

const internalError = (
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
   REQUEST CONTEXT HELPERS
========================================================= */

const getRequestRole = (
  req
) =>
  normalizeRole(
    req.userRole ||
      req.auth?.role ||
      req.user?.role
  );

const getRequestPlan = (
  req
) =>
  normalizePlan(
    req.userPlan ||
      req.auth?.plan ||
      req.user?.plan
  ) || PLANS.FREE;

const getSubscriptionStatus = (
  req
) =>
  String(
    req.auth
      ?.subscriptionStatus ||
      req.user
        ?.subscriptionStatus ||
      ""
  )
    .trim()
    .toLowerCase();

const isSubscriptionActive = (
  req
) => {
  if (
    typeof req.auth
      ?.isSubscriptionActive ===
    "boolean"
  ) {
    return req.auth
      .isSubscriptionActive;
  }

  /*
   Mongoose virtuals may be properties rather than
   methods, so do not invoke them as functions.
  */

  if (
    typeof req.user
      ?.isSubscriptionActive ===
    "boolean"
  ) {
    return req.user
      .isSubscriptionActive;
  }

  const status =
    getSubscriptionStatus(req);

  return [
    "active",
    "trialing",
  ].includes(status);
};

/* =========================================================
   COMMON ACCESS CHECK
========================================================= */

const checkCreatorAccess = (
  req,
  res
) => {
  if (!req.user) {
    unauthorized(
      res,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required"
    );

    return {
      allowed: false,
      internal: false,
      creator: false,
    };
  }

  const role =
    getRequestRole(req);

  if (
    isInternalRole(role)
  ) {
    return {
      allowed: true,
      internal: true,
      creator: false,
      role,
    };
  }

  if (
    !isBrandCreator(role)
  ) {
    forbidden(
      res,
      "BRAND_CREATOR_ONLY",
      "Subscription plans are available only to brand creators",
      {
        currentRole:
          role || null,
      }
    );

    return {
      allowed: false,
      internal: false,
      creator: false,
      role,
    };
  }

  return {
    allowed: true,
    internal: false,
    creator: true,
    role,
  };
};

/* =========================================================
   REQUIRE ACTIVE SUBSCRIPTION
========================================================= */

const requireActiveSubscription =
  (
    req,
    res,
    next
  ) => {
    const access =
      checkCreatorAccess(
        req,
        res
      );

    if (!access.allowed) {
      return;
    }

    /*
     Admin and manager bypass subscription checks.
    */

    if (access.internal) {
      return next();
    }

    const currentPlan =
      getRequestPlan(req);

    if (
      !isSubscriptionActive(
        req
      )
    ) {
      return forbidden(
        res,
        "SUBSCRIPTION_INACTIVE",
        currentPlan ===
          PLANS.FREE
          ? "Your free trial is inactive or has expired"
          : "Your subscription is inactive or has expired",
        {
          currentPlan,

          subscriptionStatus:
            getSubscriptionStatus(
              req
            ) ||
            "inactive",

          trialExpiresAt:
            req.auth
              ?.trialExpiresAt ||
            req.user
              ?.trialExpiresAt ||
            null,

          planExpiresAt:
            req.auth
              ?.planExpiresAt ||
            req.user
              ?.planExpiresAt ||
            null,

          requiresUpgrade:
            true,
        }
      );
    }

    return next();
  };

/* =========================================================
   VALIDATE PLAN INPUT
========================================================= */

const validatePlans = (
  plans,
  middlewareName
) => {
  const rawPlans =
    plans.flat(Infinity);

  if (!rawPlans.length) {
    throw new Error(
      `${middlewareName} requires at least one plan`
    );
  }

  const invalidPlans =
    rawPlans.filter(
      (plan) =>
        !normalizePlan(plan)
    );

  if (
    invalidPlans.length
  ) {
    throw new Error(
      `${middlewareName} received invalid plans: ${invalidPlans.join(
        ", "
      )}`
    );
  }

  return [
    ...new Set(
      rawPlans.map(
        normalizePlan
      )
    ),
  ];
};

/* =========================================================
   REQUIRE EXACT PLAN
========================================================= */

const requirePlan =
  (...allowedPlans) => {
    const requiredPlans =
      validatePlans(
        allowedPlans,
        "requirePlan"
      );

    return (
      req,
      res,
      next
    ) => {
      const access =
        checkCreatorAccess(
          req,
          res
        );

      if (!access.allowed) {
        return;
      }

      if (access.internal) {
        return next();
      }

      if (
        !isSubscriptionActive(
          req
        )
      ) {
        return forbidden(
          res,
          "SUBSCRIPTION_INACTIVE",
          "Your subscription is inactive or expired",
          {
            currentPlan:
              getRequestPlan(
                req
              ),
            requiresUpgrade:
              true,
          }
        );
      }

      const currentPlan =
        getRequestPlan(req);

      if (
        !requiredPlans.includes(
          currentPlan
        )
      ) {
        return forbidden(
          res,
          "PLAN_NOT_ALLOWED",
          `Your ${currentPlan} plan does not include this feature`,
          {
            currentPlan,
            requiredPlans,
            requiresUpgrade:
              true,
          }
        );
      }

      return next();
    };
  };

/* =========================================================
   REQUIRE MINIMUM PLAN
========================================================= */

const requireMinimumPlan =
  (minimumPlan) => {
    const requiredPlan =
      normalizePlan(
        minimumPlan
      );

    if (
      !requiredPlan ||
      PLAN_ORDER[
        requiredPlan
      ] === undefined
    ) {
      throw new Error(
        `Invalid minimum plan: ${minimumPlan}`
      );
    }

    return (
      req,
      res,
      next
    ) => {
      const access =
        checkCreatorAccess(
          req,
          res
        );

      if (!access.allowed) {
        return;
      }

      if (access.internal) {
        return next();
      }

      if (
        !isSubscriptionActive(
          req
        )
      ) {
        return forbidden(
          res,
          "SUBSCRIPTION_INACTIVE",
          "Your subscription is inactive or expired",
          {
            currentPlan:
              getRequestPlan(
                req
              ),
            requiresUpgrade:
              true,
          }
        );
      }

      const currentPlan =
        getRequestPlan(req);

      if (
        !hasMinimumPlan(
          currentPlan,
          requiredPlan
        )
      ) {
        return forbidden(
          res,
          "PLAN_UPGRADE_REQUIRED",
          `This feature requires the ${requiredPlan} plan or higher`,
          {
            currentPlan,
            requiredPlan,
            requiresUpgrade:
              true,
          }
        );
      }

      return next();
    };
  };

/* =========================================================
   REQUIRE BOOLEAN PLAN FEATURE
========================================================= */

const requirePlanFeature =
  (featureName) => {
    const feature =
      String(
        featureName || ""
      ).trim();

    if (!feature) {
      throw new Error(
        "requirePlanFeature requires a feature name"
      );
    }

    const configured =
      ALL_PLANS.some(
        (plan) =>
          Object.prototype
            .hasOwnProperty.call(
              PLAN_LIMITS[
                plan
              ] || {},
              feature
            )
      );

    if (!configured) {
      throw new Error(
        `Unknown plan feature: ${feature}`
      );
    }

    return (
      req,
      res,
      next
    ) => {
      const access =
        checkCreatorAccess(
          req,
          res
        );

      if (!access.allowed) {
        return;
      }

      if (access.internal) {
        return next();
      }

      if (
        !isSubscriptionActive(
          req
        )
      ) {
        return forbidden(
          res,
          "SUBSCRIPTION_INACTIVE",
          "Your subscription is inactive or expired",
          {
            currentPlan:
              getRequestPlan(
                req
              ),
            requiresUpgrade:
              true,
          }
        );
      }

      const currentPlan =
        getRequestPlan(req);

      const limits =
        PLAN_LIMITS[
          currentPlan
        ];

      if (
        !limits ||
        !Object.prototype
          .hasOwnProperty.call(
            limits,
            feature
          )
      ) {
        return internalError(
          res,
          "INVALID_PLAN_FEATURE",
          `The feature "${feature}" is not configured for the ${currentPlan} plan`
        );
      }

      if (
        typeof limits[
          feature
        ] !== "boolean"
      ) {
        return internalError(
          res,
          "INVALID_PLAN_FEATURE_TYPE",
          `The plan property "${feature}" must be a boolean`
        );
      }

      if (
        limits[
          feature
        ] !== true
      ) {
        return forbidden(
          res,
          "FEATURE_NOT_INCLUDED",
          `The ${feature} feature is not included in your current plan`,
          {
            feature,
            currentPlan,
            requiresUpgrade:
              true,
          }
        );
      }

      req.planFeature = {
        feature,
        currentPlan,
        enabled: true,
      };

      return next();
    };
  };

/* =========================================================
   REQUIRE RESOURCE LIMIT
========================================================= */

const requireResourceLimit =
  (
    resourceName,
    getCurrentUsage,
    options = {}
  ) => {
    const resource =
      String(
        resourceName || ""
      ).trim();

    if (!resource) {
      throw new Error(
        "requireResourceLimit requires a resource name"
      );
    }

    if (
      getCurrentUsage !==
        undefined &&
      typeof getCurrentUsage !==
        "function"
    ) {
      throw new TypeError(
        "getCurrentUsage must be a function"
      );
    }

    if (
      options.getRequestedAmount !==
        undefined &&
      typeof options
        .getRequestedAmount !==
        "function"
    ) {
      throw new TypeError(
        "options.getRequestedAmount must be a function"
      );
    }

    const configured =
      ALL_PLANS.some(
        (plan) =>
          Object.prototype
            .hasOwnProperty.call(
              PLAN_LIMITS[
                plan
              ] || {},
              resource
            )
      );

    if (!configured) {
      throw new Error(
        `Unknown resource limit: ${resource}`
      );
    }

    return async (
      req,
      res,
      next
    ) => {
      try {
        const access =
          checkCreatorAccess(
            req,
            res
          );

        if (!access.allowed) {
          return;
        }

        if (access.internal) {
          return next();
        }

        if (
          !isSubscriptionActive(
            req
          )
        ) {
          return forbidden(
            res,
            "SUBSCRIPTION_INACTIVE",
            "Your subscription is inactive or expired",
            {
              currentPlan:
                getRequestPlan(
                  req
                ),
              requiresUpgrade:
                true,
            }
          );
        }

        const currentPlan =
          getRequestPlan(req);

        const limits =
          PLAN_LIMITS[
            currentPlan
          ];

        const limit =
          limits?.[
            resource
          ];

        if (
          limit === undefined
        ) {
          return internalError(
            res,
            "INVALID_PLAN_LIMIT",
            `The resource "${resource}" is not configured for the ${currentPlan} plan`
          );
        }

        const rawUsage =
          typeof getCurrentUsage ===
            "function"
            ? await getCurrentUsage(
                req
              )
            : req.user
                ?.usage?.[
                  resource
                ] || 0;

        const rawRequested =
          typeof options
            .getRequestedAmount ===
            "function"
            ? await options
                .getRequestedAmount(
                  req
                )
            : options
                .requestedAmount ??
              1;

        const currentUsage =
          Number(rawUsage);

        const requestedAmount =
          Number(
            rawRequested
          );

        if (
          !Number.isFinite(
            currentUsage
          ) ||
          currentUsage < 0
        ) {
          return internalError(
            res,
            "INVALID_RESOURCE_USAGE",
            `Invalid current usage for ${resource}`
          );
        }

        if (
          !Number.isFinite(
            requestedAmount
          ) ||
          requestedAmount <= 0
        ) {
          return res
            .status(400)
            .json({
              success: false,
              code:
                "INVALID_REQUESTED_AMOUNT",
              message:
                `Requested ${resource} amount must be greater than zero`,
            });
        }

        const exceedsLimit =
          limit !==
            Infinity &&
          currentUsage +
            requestedAmount >
            Number(limit);

        if (
          exceedsLimit
        ) {
          return forbidden(
            res,
            "PLAN_LIMIT_REACHED",
            `Your ${currentPlan} plan supports only ${limit} ${resource}`,
            {
              resource,
              currentPlan,
              currentUsage,
              requestedAmount,
              limit,
              remaining:
                Math.max(
                  Number(
                    limit
                  ) -
                    currentUsage,
                  0
                ),
              requiresUpgrade:
                true,
            }
          );
        }

        req.resourceUsage = {
          resource,
          currentPlan,
          current:
            currentUsage,
          requested:
            requestedAmount,
          limit,

          remainingBefore:
            limit ===
            Infinity
              ? Infinity
              : Math.max(
                  Number(
                    limit
                  ) -
                    currentUsage,
                  0
                ),

          remainingAfter:
            limit ===
            Infinity
              ? Infinity
              : Math.max(
                  Number(
                    limit
                  ) -
                    currentUsage -
                    requestedAmount,
                  0
                ),
        };

        return next();
      } catch (error) {
        console.error(
          `RESOURCE LIMIT ERROR [${resource}]:`,
          error
        );

        return internalError(
          res,
          "PLAN_LIMIT_CHECK_FAILED",
          "Unable to verify plan limit"
        );
      }
    };
  };

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  requireActiveSubscription,
  requirePlan,
  requireMinimumPlan,
  requirePlanFeature,
  requireResourceLimit,
};