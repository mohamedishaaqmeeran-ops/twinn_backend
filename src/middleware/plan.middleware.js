const {
  PLANS,
  ALL_PLANS,
  PLAN_ORDER,
} = require(
  "../config/plans"
);

const {
  normalizePlan,
  isInternalRole,
  isBrandCreator,
  hasMinimumPlan,
  getPlanLimits,
  getPlanLimit,
  hasFeatureAccess,
  canUseResource,
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

const serverError = (
  res,
  code,
  message,
  extra = {}
) =>
  res.status(500).json({
    success: false,
    code,
    message,
    ...extra,
  });

/* =========================================================
   AUTH CONTEXT HELPERS
========================================================= */

const getRequestRole = (
  req
) =>
  req.userRole ||
  req.auth?.role ||
  req.user?.role ||
  "";

const getRequestPlan = (
  req
) => {
  const role =
    getRequestRole(req);

  if (
    !isBrandCreator(role)
  ) {
    return null;
  }

  return (
    normalizePlan(
      req.userPlan ||
      req.auth?.plan ||
      req.user?.plan
    ) ||
    PLANS.FREE
  );
};

const isInternalRequest = (
  req
) =>
  isInternalRole(
    getRequestRole(req)
  );

const ensureAuthenticated = (
  req,
  res
) => {
  if (!req.user) {
    unauthorized(
      res,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required"
    );

    return false;
  }

  return true;
};

const ensureBrandCreator = (
  req,
  res
) => {
  if (
    !isBrandCreator(
      getRequestRole(req)
    )
  ) {
    forbidden(
      res,
      "BRAND_CREATOR_ONLY",
      "Subscription plans are available only to brand creators"
    );

    return false;
  }

  return true;
};

/* =========================================================
   ACTIVE SUBSCRIPTION CHECK
========================================================= */

const hasActiveSubscription = (
  req
) => {
  /*
   Prefer the normalized state created by
   auth.middleware.js.
  */

  if (
    typeof req.auth
      ?.isSubscriptionActive ===
    "boolean"
  ) {
    return req.auth
      .isSubscriptionActive;
  }

  if (
    typeof req.user
      ?.isSubscriptionActive ===
    "boolean"
  ) {
    return req.user
      .isSubscriptionActive;
  }

  /*
   Fallback for older user models.
  */

  const status =
    String(
      req.auth
        ?.subscriptionStatus ||
      req.user
        ?.subscriptionStatus ||
      ""
    )
      .trim()
      .toLowerCase();

  return [
    "active",
    "trialing",
  ].includes(status);
};

const requireActiveCreatorSubscription = (
  req,
  res
) => {
  if (
    isInternalRequest(req)
  ) {
    return true;
  }

  if (
    !ensureBrandCreator(
      req,
      res
    )
  ) {
    return false;
  }

  if (
    !hasActiveSubscription(
      req
    )
  ) {
    const currentPlan =
      getRequestPlan(req);

    forbidden(
      res,
      "SUBSCRIPTION_REQUIRED",
      req.auth
        ?.isPlanExpired
        ? "Your subscription has expired. Renew or upgrade your plan to continue."
        : "An active trial or paid subscription is required to use this feature.",
      {
        currentPlan,

        subscriptionStatus:
          req.auth
            ?.subscriptionStatus ||
          req.user
            ?.subscriptionStatus ||
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

    return false;
  }

  return true;
};

/* =========================================================
   NORMALIZE ALLOWED PLANS
========================================================= */

const validatePlans = (
  plans,
  middlewareName
) => {
  const flattened =
    plans.flat(Infinity);

  if (!flattened.length) {
    throw new Error(
      `${middlewareName} requires at least one plan.`
    );
  }

  const normalized =
    flattened
      .map(normalizePlan)
      .filter(Boolean);

  const uniquePlans = [
    ...new Set(normalized),
  ];

  const invalidPlans =
    flattened.filter(
      (plan) =>
        !normalizePlan(plan)
    );

  if (invalidPlans.length) {
    throw new Error(
      `${middlewareName} received invalid plans: ${invalidPlans.join(
        ", "
      )}`
    );
  }

  if (!uniquePlans.length) {
    throw new Error(
      `${middlewareName} requires at least one valid plan.`
    );
  }

  return uniquePlans;
};

/* =========================================================
   REQUIRE EXACT PLAN
========================================================= */

const requirePlan =
  (...plans) => {
    const allowed =
      validatePlans(
        plans,
        "requirePlan"
      );

    return (
      req,
      res,
      next
    ) => {
      if (
        !ensureAuthenticated(
          req,
          res
        )
      ) {
        return;
      }

      /*
       Admin and manager bypass plan restrictions.
      */

      if (
        isInternalRequest(req)
      ) {
        return next();
      }

      if (
        !requireActiveCreatorSubscription(
          req,
          res
        )
      ) {
        return;
      }

      const current =
        getRequestPlan(req);

      if (
        !allowed.includes(
          current
        )
      ) {
        return forbidden(
          res,
          "PLAN_NOT_ALLOWED",
          `Your ${current} plan does not include this feature`,
          {
            currentPlan:
              current,

            requiredPlans:
              allowed,

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
    const required =
      normalizePlan(
        minimumPlan
      );

    if (
      !required ||
      PLAN_ORDER[required] ===
        undefined
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
      if (
        !ensureAuthenticated(
          req,
          res
        )
      ) {
        return;
      }

      if (
        isInternalRequest(req)
      ) {
        return next();
      }

      if (
        !requireActiveCreatorSubscription(
          req,
          res
        )
      ) {
        return;
      }

      const current =
        getRequestPlan(req);

      if (
        !hasMinimumPlan(
          current,
          required
        )
      ) {
        return forbidden(
          res,
          "PLAN_UPGRADE_REQUIRED",
          `This feature requires the ${required} plan or higher`,
          {
            currentPlan:
              current,

            requiredPlan:
              required,

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
    const normalizedFeature =
      String(
        featureName || ""
      ).trim();

    if (!normalizedFeature) {
      throw new Error(
        "requirePlanFeature requires a feature name."
      );
    }

    /*
     Validate the feature against every configured plan.
    */

    const featureExists =
      ALL_PLANS.some(
        (plan) =>
          Object.prototype
            .hasOwnProperty.call(
              getPlanLimits(
                plan
              ),
              normalizedFeature
            )
      );

    if (!featureExists) {
      throw new Error(
        `Unknown plan feature: ${normalizedFeature}`
      );
    }

    return (
      req,
      res,
      next
    ) => {
      if (
        !ensureAuthenticated(
          req,
          res
        )
      ) {
        return;
      }

      if (
        isInternalRequest(req)
      ) {
        return next();
      }

      if (
        !requireActiveCreatorSubscription(
          req,
          res
        )
      ) {
        return;
      }

      const currentPlan =
        getRequestPlan(req);

      const limits =
        getPlanLimits(
          currentPlan
        );

      if (
        !Object.prototype
          .hasOwnProperty.call(
            limits,
            normalizedFeature
          )
      ) {
        return serverError(
          res,
          "INVALID_PLAN_FEATURE",
          `The feature "${normalizedFeature}" is not configured for the ${currentPlan} plan`
        );
      }

      /*
       Feature middleware should normally be
       used for boolean configuration values.
      */

      if (
        typeof limits[
          normalizedFeature
        ] !== "boolean"
      ) {
        return serverError(
          res,
          "INVALID_FEATURE_TYPE",
          `The plan property "${normalizedFeature}" is not a boolean feature`
        );
      }

      if (
        !hasFeatureAccess(
          currentPlan,
          normalizedFeature
        )
      ) {
        return forbidden(
          res,
          "FEATURE_NOT_INCLUDED",
          `The ${normalizedFeature} feature is not included in your current plan`,
          {
            currentPlan,

            feature:
              normalizedFeature,

            requiresUpgrade:
              true,
          }
        );
      }

      req.planFeature = {
        plan:
          currentPlan,

        feature:
          normalizedFeature,

        enabled:
          true,
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
        "requireResourceLimit requires a resource name."
      );
    }

    if (
      getCurrentUsage !==
        undefined &&
      typeof getCurrentUsage !==
        "function"
    ) {
      throw new TypeError(
        "getCurrentUsage must be a function."
      );
    }

    const resourceExists =
      ALL_PLANS.some(
        (plan) =>
          getPlanLimit(
            plan,
            resource
          ) !== null
      );

    if (!resourceExists) {
      throw new Error(
        `Unknown plan resource: ${resource}`
      );
    }

    const getRequestedAmount =
      options.getRequestedAmount;

    if (
      getRequestedAmount !==
        undefined &&
      typeof getRequestedAmount !==
        "function"
    ) {
      throw new TypeError(
        "options.getRequestedAmount must be a function."
      );
    }

    return async (
      req,
      res,
      next
    ) => {
      if (
        !ensureAuthenticated(
          req,
          res
        )
      ) {
        return;
      }

      if (
        isInternalRequest(req)
      ) {
        return next();
      }

      if (
        !requireActiveCreatorSubscription(
          req,
          res
        )
      ) {
        return;
      }

      const currentPlan =
        getRequestPlan(req);

      const limit =
        getPlanLimit(
          currentPlan,
          resource
        );

      if (
        limit === null ||
        limit === undefined
      ) {
        return serverError(
          res,
          "INVALID_PLAN_LIMIT",
          `The resource "${resource}" is not configured for the ${currentPlan} plan`
        );
      }

      let currentUsage;

      try {
        currentUsage =
          typeof getCurrentUsage ===
            "function"
            ? await getCurrentUsage(
                req
              )
            : req.user
                ?.usage?.[
                  resource
                ] || 0;
      } catch (error) {
        console.error(
          `PLAN USAGE LOOKUP ERROR [${resource}]:`,
          error
        );

        return serverError(
          res,
          "USAGE_LOOKUP_FAILED",
          `Unable to determine the current ${resource} usage`
        );
      }

      let requestedAmount =
        1;

      try {
        if (
          typeof getRequestedAmount ===
          "function"
        ) {
          requestedAmount =
            await getRequestedAmount(
              req
            );
        } else if (
          options.requestedAmount !==
          undefined
        ) {
          requestedAmount =
            options.requestedAmount;
        }
      } catch (error) {
        console.error(
          `REQUESTED USAGE LOOKUP ERROR [${resource}]:`,
          error
        );

        return serverError(
          res,
          "REQUESTED_USAGE_LOOKUP_FAILED",
          `Unable to determine the requested ${resource} quantity`
        );
      }

      const numericCurrent =
        Number(currentUsage);

      const numericRequested =
        Number(
          requestedAmount
        );

      if (
        !Number.isFinite(
          numericCurrent
        ) ||
        numericCurrent < 0
      ) {
        return serverError(
          res,
          "INVALID_CURRENT_USAGE",
          `Invalid current usage value for ${resource}`
        );
      }

      if (
        !Number.isFinite(
          numericRequested
        ) ||
        numericRequested <= 0
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

      const usageCheck =
        canUseResource({
          plan:
            currentPlan,

          resource,

          currentUsage:
            numericCurrent,

          requestedAmount:
            numericRequested,
        });

      if (
        !usageCheck.allowed
      ) {
        return forbidden(
          res,
          "PLAN_LIMIT_REACHED",
          `Your ${currentPlan} plan supports only ${limit} ${resource}`,
          {
            currentPlan,

            resource,

            currentUsage:
              usageCheck
                .currentUsage,

            requestedAmount:
              usageCheck
                .requestedAmount,

            limit:
              usageCheck.limit,

            remaining:
              usageCheck
                .remaining,

            requiresUpgrade:
              true,
          }
        );
      }

      req.resourceUsage = {
        resource,

        plan:
          currentPlan,

        current:
          usageCheck
            .currentUsage,

        requested:
          usageCheck
            .requestedAmount,

        limit:
          usageCheck.limit,

        remainingBefore:
          usageCheck
            .remaining,

        remainingAfter:
          usageCheck.limit ===
            Infinity
            ? Infinity
            : Math.max(
                usageCheck.limit -
                  usageCheck
                    .currentUsage -
                  usageCheck
                    .requestedAmount,
                0
              ),
      };

      return next();
    };
  };

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  requirePlan,
  requireMinimumPlan,
  requirePlanFeature,
  requireResourceLimit,
};