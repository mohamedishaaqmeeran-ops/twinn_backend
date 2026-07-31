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

const BILLING_CYCLES =
  Object.freeze({
    MONTHLY: "monthly",
    YEARLY: "yearly",
  });

const ALL_PLANS = Object.freeze(
  Object.values(PLANS)
);

const PAID_PLANS =
  Object.freeze([
    PLANS.STARTER,
    PLANS.PRO,
    PLANS.BUSINESS,
  ]);

const CUSTOM_PLANS =
  Object.freeze([
    PLANS.AGENCY,
  ]);

const PLAN_ORDER =
  Object.freeze({
    [PLANS.FREE]: 0,
    [PLANS.STARTER]: 1,
    [PLANS.PRO]: 2,
    [PLANS.BUSINESS]: 3,
    [PLANS.AGENCY]: 4,
  });

/* =========================================================
   PLAN LIMITS
========================================================= */

const PLAN_LIMITS =
  Object.freeze({
    [PLANS.FREE]:
      Object.freeze({
        trialDays: 7,

        twins: 1,
        connectedPlatforms: 1,
        products: 10,
        schedules: 1,
        teamSeats: 1,
        managedBrands: 1,

        aiRepliesThisMonth: 100,
        liveMinutesThisMonth: 120,

        storageBytes:
          2.4 *
          1024 *
          1024 *
          1024,

        standardVoice: true,
        customVoiceCloning: false,

        basicLipSync: true,
        advancedLipSync: false,

        liveSalesAnalytics: false,
        advancedAnalytics: false,

        removePoweredByTwinBadge:
          false,

        whiteLabelBranding:
          false,

        shopifyIntegration: false,
        woocommerceIntegration:
          false,
        wordpressIntegration:
          false,
        stripeIntegration: false,
        klaviyoIntegration: false,
        zapierIntegration: false,

        apiAccess: false,
        customIntegrations: false,

        prioritySupport: false,
        onboardingSupport: false,
        dedicatedAccountManager:
          false,
        slaSupport: false,
      }),

    [PLANS.STARTER]:
      Object.freeze({
        trialDays: 0,

        twins: 2,
        connectedPlatforms: 2,
        products: 30,
        schedules: 10,
        teamSeats: 1,
        managedBrands: 1,

        aiRepliesThisMonth: 300,
        liveMinutesThisMonth: 600,

        storageBytes:
          10 *
          1024 *
          1024 *
          1024,

        standardVoice: true,
        customVoiceCloning: false,

        basicLipSync: true,
        advancedLipSync: false,

        liveSalesAnalytics: false,
        advancedAnalytics: false,

        removePoweredByTwinBadge:
          false,

        whiteLabelBranding:
          false,

        shopifyIntegration: false,
        woocommerceIntegration:
          false,
        wordpressIntegration:
          false,
        stripeIntegration: false,
        klaviyoIntegration: false,
        zapierIntegration: false,

        apiAccess: false,
        customIntegrations: false,

        prioritySupport: false,
        onboardingSupport: false,
        dedicatedAccountManager:
          false,
        slaSupport: false,
      }),

    [PLANS.PRO]:
      Object.freeze({
        trialDays: 0,

        twins: 3,
        connectedPlatforms: 4,
        products: 100,
        schedules: 50,
        teamSeats: 1,
        managedBrands: 1,

        aiRepliesThisMonth:
          Infinity,

        liveMinutesThisMonth:
          Infinity,

        storageBytes:
          50 *
          1024 *
          1024 *
          1024,

        standardVoice: true,
        customVoiceCloning: true,

        basicLipSync: true,
        advancedLipSync: true,

        liveSalesAnalytics: true,
        advancedAnalytics: false,

        removePoweredByTwinBadge:
          true,

        whiteLabelBranding:
          false,

        shopifyIntegration: false,
        woocommerceIntegration:
          false,
        wordpressIntegration:
          false,
        stripeIntegration: false,
        klaviyoIntegration: false,
        zapierIntegration: false,

        apiAccess: false,
        customIntegrations: false,

        prioritySupport: false,
        onboardingSupport: false,
        dedicatedAccountManager:
          false,
        slaSupport: false,
      }),

    [PLANS.BUSINESS]:
      Object.freeze({
        trialDays: 0,

        twins: Infinity,
        connectedPlatforms:
          Infinity,
        products: Infinity,
        schedules: Infinity,
        teamSeats: 5,
        managedBrands: 1,

        aiRepliesThisMonth:
          Infinity,

        liveMinutesThisMonth:
          Infinity,

        storageBytes: Infinity,

        standardVoice: true,
        customVoiceCloning: true,

        basicLipSync: true,
        advancedLipSync: true,

        liveSalesAnalytics: true,
        advancedAnalytics: true,

        removePoweredByTwinBadge:
          true,

        whiteLabelBranding:
          false,

        shopifyIntegration: true,
        woocommerceIntegration:
          true,
        wordpressIntegration:
          true,
        stripeIntegration: true,
        klaviyoIntegration: true,
        zapierIntegration: true,

        apiAccess: false,
        customIntegrations: false,

        prioritySupport: true,
        onboardingSupport: true,
        dedicatedAccountManager:
          false,
        slaSupport: false,
      }),

    [PLANS.AGENCY]:
      Object.freeze({
        trialDays: 0,

        twins: Infinity,
        connectedPlatforms:
          Infinity,
        products: Infinity,
        schedules: Infinity,
        teamSeats: Infinity,
        managedBrands: Infinity,

        aiRepliesThisMonth:
          Infinity,

        liveMinutesThisMonth:
          Infinity,

        storageBytes: Infinity,

        standardVoice: true,
        customVoiceCloning: true,

        basicLipSync: true,
        advancedLipSync: true,

        liveSalesAnalytics: true,
        advancedAnalytics: true,

        removePoweredByTwinBadge:
          true,

        whiteLabelBranding:
          true,

        shopifyIntegration: true,
        woocommerceIntegration:
          true,
        wordpressIntegration:
          true,
        stripeIntegration: true,
        klaviyoIntegration: true,
        zapierIntegration: true,

        apiAccess: true,
        customIntegrations: true,

        prioritySupport: true,
        onboardingSupport: true,

        dedicatedAccountManager:
          true,

        slaSupport: true,
      }),
  });

/* =========================================================
   PLAN PRICING
========================================================= */

const PLAN_PRICING =
  Object.freeze({
    [PLANS.FREE]:
      Object.freeze({
        monthly: 0,
        yearly: 0,
        currency: "USD",
        checkoutEnabled: false,
      }),

    [PLANS.STARTER]:
      Object.freeze({
        monthly: 12,
        yearly: 120,
        currency: "USD",
        checkoutEnabled: true,
      }),

    [PLANS.PRO]:
      Object.freeze({
        monthly: 29,
        yearly: 290,
        currency: "USD",
        checkoutEnabled: true,
      }),

    [PLANS.BUSINESS]:
      Object.freeze({
        monthly: 99,
        yearly: 990,
        currency: "USD",
        checkoutEnabled: true,
      }),

    [PLANS.AGENCY]:
      Object.freeze({
        monthly: null,
        yearly: null,
        currency: "USD",
        checkoutEnabled: false,
      }),
  });

/* =========================================================
   HELPERS
========================================================= */

const getPlanLimits = (
  plan
) =>
  PLAN_LIMITS[plan] ||
  PLAN_LIMITS[PLANS.FREE];

const getPlanPricing = (
  plan,
  billingCycle =
    BILLING_CYCLES.MONTHLY
) => {
  const pricing =
    PLAN_PRICING[plan];

  if (!pricing) {
    return null;
  }

  const safeBillingCycle =
    Object.values(
      BILLING_CYCLES
    ).includes(
      billingCycle
    )
      ? billingCycle
      : BILLING_CYCLES.MONTHLY;

  const amount =
    safeBillingCycle ===
    BILLING_CYCLES.YEARLY
      ? pricing.yearly
      : pricing.monthly;

  return {
    ...pricing,

    billingCycle:
      safeBillingCycle,

    amount,
  };
};

module.exports = {
  PLANS,
  BILLING_CYCLES,

  ALL_PLANS,
  PAID_PLANS,
  CUSTOM_PLANS,

  PLAN_ORDER,
  PLAN_LIMITS,
  PLAN_PRICING,

  getPlanLimits,
  getPlanPricing,
};