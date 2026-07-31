const mongoose =
  require("mongoose");

const {
  ROLES,
  ALL_ROLES,
} = require("../config/roles");

const {
  PLANS,
  ALL_PLANS,
  PLAN_LIMITS,
} = require("../config/plans");

const {
  ALL_PERMISSIONS,
} = require("../config/permissions");

/* =========================================================
   CONSTANTS
========================================================= */

const BILLING_CYCLES =
  Object.freeze([
    "monthly",
    "yearly",
  ]);

const USER_STATUSES =
  Object.freeze([
    "Active",
    "Blocked",
  ]);

const SUBSCRIPTION_STATUSES =
  Object.freeze([
    "inactive",
    "trialing",
    "active",
    "past_due",
    "cancelled",
    "expired",
  ]);

const PAYMENT_GATEWAYS =
  Object.freeze([
    "razorpay",
    "stripe",
  ]);

/* =========================================================
   USAGE SCHEMA
========================================================= */

const usageSchema =
  new mongoose.Schema(
    {
      twins: {
        type: Number,
        default: 0,
        min: 0,
      },

      connectedPlatforms: {
        type: Number,
        default: 0,
        min: 0,
      },

      products: {
        type: Number,
        default: 0,
        min: 0,
      },

      schedules: {
        type: Number,
        default: 0,
        min: 0,
      },

      aiRepliesThisMonth: {
        type: Number,
        default: 0,
        min: 0,
      },

      teamSeats: {
        type: Number,
        default: 1,
        min: 1,
      },

      managedBrands: {
        type: Number,
        default: 1,
        min: 0,
      },

      liveMinutesThisMonth: {
        type: Number,
        default: 0,
        min: 0,
      },

      storageUsedBytes: {
        type: Number,
        default: 0,
        min: 0,
      },

      usageResetAt: {
        type: Date,
        default: null,
      },
    },
    {
      _id: false,
    }
  );

/* =========================================================
   USER SCHEMA
========================================================= */

const userSchema =
  new mongoose.Schema(
    {
      name: {
        type: String,
        trim: true,
        maxlength: 100,
        default: "",
      },

      phone: {
        type: String,
        trim: true,
        maxlength: 30,
        default: "",
      },

      brand: {
        type: String,
        trim: true,
        maxlength: 150,
        default: "",
      },

      email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        maxlength: 150,
        match:
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      },

      passwordHash: {
        type: String,
        select: false,
        default: null,
      },

      googleId: {
        type: String,
        trim: true,
        sparse: true,
        unique: true,
        index: true,
        default: null,
      },

      authProvider: {
  type: String,

  enum: [
    "local",
    "google",
    "both",
  ],

  default:
    "local",

  lowercase: true,

  trim: true,

  index: true,
},

      avatarUrl: {
        type: String,
        trim: true,
        default: "",
      },

      /* =====================================================
         ROLE
      ===================================================== */

      role: {
        type: String,
        enum: ALL_ROLES,
        default: ROLES.USER,
        lowercase: true,
        trim: true,
        index: true,
      },

      permissions: [
        {
          type: String,
          enum: ALL_PERMISSIONS,
          lowercase: true,
          trim: true,
        },
      ],

      /* =====================================================
         ACCOUNT STATUS
      ===================================================== */

      status: {
        type: String,
        enum: USER_STATUSES,
        default: "Active",
        index: true,
      },

      isBlocked: {
        type: Boolean,
        default: false,
        index: true,
      },

      blockedAt: {
        type: Date,
        default: null,
      },

      blockedReason: {
        type: String,
        trim: true,
        maxlength: 500,
        default: "",
      },

      /* =====================================================
         SUBSCRIPTION PLAN

         Agency is a plan, not a role.

         Example:
         {
           role: "brandcreator",
           plan: "agency"
         }
      ===================================================== */

      plan: {
        type: String,
        enum: [
          ...ALL_PLANS,
          null,
        ],
        default: null,
        lowercase: true,
        trim: true,
        index: true,
      },

      billingCycle: {
        type: String,
        enum: [
          ...BILLING_CYCLES,
          null,
        ],
        default: null,
      },

      planStartedAt: {
        type: Date,
        default: null,
      },

      planExpiresAt: {
        type: Date,
        default: null,
        index: true,
      },

      planCancelledAt: {
        type: Date,
        default: null,
      },

      cancelAtPeriodEnd: {
        type: Boolean,
        default: false,
      },

      subscriptionStatus: {
        type: String,
        enum:
          SUBSCRIPTION_STATUSES,
        default: "inactive",
        index: true,
      },

      /* =====================================================
         FREE TRIAL
      ===================================================== */

      trialStartedAt: {
        type: Date,
        default: null,
      },

      trialExpiresAt: {
        type: Date,
        default: null,
        index: true,
      },

      isTrialUsed: {
        type: Boolean,
        default: false,
      },

      trialPlan: {
        type: String,
        enum: [
          ...ALL_PLANS,
          null,
        ],
        default: null,
      },

      /* =====================================================
         PAYMENT DETAILS
      ===================================================== */

      paymentGateway: {
        type: String,
        enum: [
          ...PAYMENT_GATEWAYS,
          null,
        ],
        default: null,
      },

      razorpayCustomerId: {
        type: String,
        trim: true,
        default: null,
      },

      razorpaySubscriptionId: {
        type: String,
        trim: true,
        default: null,
      },

      stripeCustomerId: {
        type: String,
        trim: true,
        default: null,
      },

      stripeSubscriptionId: {
        type: String,
        trim: true,
        default: null,
      },

      lastPaymentId: {
        type: String,
        trim: true,
        default: null,
      },

      lastPaymentAt: {
        type: Date,
        default: null,
      },

      /* =====================================================
         EMAIL VERIFICATION
      ===================================================== */

      isVerified: {
        type: Boolean,
        default: false,
        index: true,
      },

      verificationToken: {
        type: String,
        select: false,
        default: null,
      },

      verificationTokenExpiresAt: {
        type: Date,
        select: false,
        default: null,
      },

      /* =====================================================
         PASSWORD RESET
      ===================================================== */

      resetToken: {
        type: String,
        select: false,
        default: null,
      },

      resetTokenExpiresAt: {
        type: Date,
        select: false,
        default: null,
      },

      /* =====================================================
         AUTHENTICATION SECURITY
      ===================================================== */

      tokenVersion: {
        type: Number,
        default: 0,
        min: 0,
        select: false,
      },

      /* =====================================================
         CREDITS AND USAGE
      ===================================================== */

      credits: {
        type: Number,
        default: 0,
        min: 0,
      },

      usage: {
        type: usageSchema,
        default: () => ({}),
      },

      /* =====================================================
         LOGIN INFORMATION
      ===================================================== */

      lastLogin: {
        type: Date,
        default: null,
      },

      lastLoginIp: {
        type: String,
        trim: true,
        default: "",
      },
    },
    {
      timestamps: true,

      toJSON: {
        virtuals: true,

        transform(
          document,
          result
        ) {
          delete result.passwordHash;
          delete result.verificationToken;
          delete result.verificationTokenExpiresAt;
          delete result.resetToken;
          delete result.resetTokenExpiresAt;
          delete result.tokenVersion;

          return result;
        },
      },

      toObject: {
        virtuals: true,
      },
    }
  );

/* =========================================================
   INDEXES
========================================================= */

userSchema.index({
  role: 1,
  status: 1,
});

userSchema.index({
  plan: 1,
  subscriptionStatus: 1,
});

userSchema.index({
  plan: 1,
  planExpiresAt: 1,
});

userSchema.index({
  subscriptionStatus: 1,
  trialExpiresAt: 1,
});

/* =========================================================
   VIRTUAL: TRIAL ACTIVE
========================================================= */

userSchema
  .virtual("isTrialActive")
  .get(function () {
    return Boolean(
      this.subscriptionStatus ===
        "trialing" &&
      this.trialStartedAt &&
      this.trialExpiresAt &&
      new Date(
        this.trialExpiresAt
      ).getTime() >
        Date.now()
    );
  });

/* =========================================================
   VIRTUAL: PAID PLAN ACTIVE
========================================================= */

userSchema
  .virtual("isPaidPlanActive")
  .get(function () {
    if (
      this.role !==
      ROLES.BRAND_CREATOR
    ) {
      return false;
    }

    if (
      !this.plan ||
      this.plan === PLANS.FREE
    ) {
      return false;
    }

    if (
      this.subscriptionStatus !==
      "active"
    ) {
      return false;
    }

    /*
     Agency may be provisioned manually with
     no fixed expiry date.
    */
    if (
      this.plan ===
        PLANS.AGENCY &&
      !this.planExpiresAt
    ) {
      return true;
    }

    return Boolean(
      this.planExpiresAt &&
      new Date(
        this.planExpiresAt
      ).getTime() >
        Date.now()
    );
  });

/* =========================================================
   VIRTUAL: SUBSCRIPTION ACTIVE
========================================================= */

userSchema
  .virtual(
    "isSubscriptionActive"
  )
  .get(function () {
    if (
      this.role !==
      ROLES.BRAND_CREATOR
    ) {
      return false;
    }

    if (
      this.status !== "Active" ||
      this.isBlocked
    ) {
      return false;
    }

    /*
     Free is a seven-day trial.
     It is not permanently active.
    */
    if (
      this.plan === PLANS.FREE
    ) {
      return this.isTrialActive;
    }

    if (this.isTrialActive) {
      return true;
    }

    return this.isPaidPlanActive;
  });

/* =========================================================
   VIRTUAL: PLAN LIMITS
========================================================= */

userSchema
  .virtual("planLimits")
  .get(function () {
    if (
      this.role !==
      ROLES.BRAND_CREATOR
    ) {
      return null;
    }

    return (
      PLAN_LIMITS[this.plan] ||
      PLAN_LIMITS[
        PLANS.FREE
      ]
    );
  });

/* =========================================================
   VIRTUAL: TRIAL REMAINING DAYS
========================================================= */

userSchema
  .virtual(
    "trialDaysRemaining"
  )
  .get(function () {
    if (
      !this.isTrialActive
    ) {
      return 0;
    }

    const difference =
      new Date(
        this.trialExpiresAt
      ).getTime() -
      Date.now();

    return Math.max(
      Math.ceil(
        difference /
          (
            24 *
            60 *
            60 *
            1000
          )
      ),
      0
    );
  });

/* =========================================================
   VIRTUAL: PLAN EXPIRED
========================================================= */

userSchema
  .virtual("isPlanExpired")
  .get(function () {
    if (
      this.role !==
      ROLES.BRAND_CREATOR
    ) {
      return false;
    }

    if (
      this.plan === PLANS.FREE
    ) {
      return Boolean(
        this.trialExpiresAt &&
        new Date(
          this.trialExpiresAt
        ).getTime() <=
          Date.now()
      );
    }

    if (
      this.plan ===
        PLANS.AGENCY &&
      !this.planExpiresAt &&
      this.subscriptionStatus ===
        "active"
    ) {
      return false;
    }

    return Boolean(
      this.planExpiresAt &&
      new Date(
        this.planExpiresAt
      ).getTime() <=
        Date.now()
    );
  });

/* =========================================================
   METHOD: GET PLAN LIMITS
========================================================= */

userSchema.methods
  .getPlanLimits =
  function () {
    return this.planLimits;
  };

/* =========================================================
   METHOD: CHECK PLAN FEATURE
========================================================= */

userSchema.methods
  .hasPlanFeature =
  function (featureName) {
    const limits =
      this.getPlanLimits();

    if (!limits) {
      return false;
    }

    return (
      limits[
        featureName
      ] === true
    );
  };

/* =========================================================
   METHOD: CHECK RESOURCE LIMIT
========================================================= */

userSchema.methods
  .canCreateResource =
  function (
    resourceName,
    currentUsage
  ) {
    const limits =
      this.getPlanLimits();

    if (
      !limits ||
      limits[
        resourceName
      ] === undefined
    ) {
      return false;
    }

    const limit =
      limits[resourceName];

    if (
      limit === Infinity
    ) {
      return true;
    }

    return (
      Number(
        currentUsage || 0
      ) <
      Number(limit)
    );
  };

/* =========================================================
   METHOD: CUSTOM PERMISSION
========================================================= */

userSchema.methods
  .hasCustomPermission =
  function (permission) {
    const normalized =
      String(
        permission || ""
      )
        .trim()
        .toLowerCase();

    return (
      Array.isArray(
        this.permissions
      ) &&
      this.permissions.includes(
        normalized
      )
    );
  };

/* =========================================================
   METHOD: START FREE TRIAL
========================================================= */

userSchema.methods
  .startFreeTrial =
  function () {
    if (this.isTrialUsed) {
      throw new Error(
        "Free trial has already been used"
      );
    }

    if (
      this.role !==
      ROLES.BRAND_CREATOR
    ) {
      throw new Error(
        "Only brand creator accounts can start a trial"
      );
    }

    const startedAt =
      new Date();

    const trialDays =
      PLAN_LIMITS[
        PLANS.FREE
      ].trialDays || 7;

    const expiresAt =
      new Date(
        startedAt.getTime() +
          trialDays *
            24 *
            60 *
            60 *
            1000
      );

    this.plan =
      PLANS.FREE;

    this.trialPlan =
      PLANS.FREE;

    this.trialStartedAt =
      startedAt;

    this.trialExpiresAt =
      expiresAt;

    this.planStartedAt =
      startedAt;

    this.planExpiresAt =
      expiresAt;

    this.subscriptionStatus =
      "trialing";

    this.isTrialUsed =
      true;

    this.billingCycle =
      null;

    return this;
  };

/* =========================================================
   METHOD: ACTIVATE PAID PLAN
========================================================= */

userSchema.methods
  .activatePlan =
  function ({
    plan,
    billingCycle,
    paymentGateway = null,
    paymentId = null,
    subscriptionId = null,
    expiresAt = null,
  }) {
    if (
      this.role !==
      ROLES.BRAND_CREATOR
    ) {
      throw new Error(
        "Only brand creator accounts can have subscription plans"
      );
    }

    if (
      !ALL_PLANS.includes(
        plan
      ) ||
      plan === PLANS.FREE
    ) {
      throw new Error(
        "Invalid paid plan"
      );
    }

    const now = new Date();

    let calculatedExpiry =
      expiresAt
        ? new Date(expiresAt)
        : null;

    /*
     Agency may use a manually managed
     custom contract without a fixed expiry.
    */
    if (
      plan !== PLANS.AGENCY &&
      !calculatedExpiry
    ) {
      const months =
        billingCycle ===
        "yearly"
          ? 12
          : 1;

      calculatedExpiry =
        new Date(now);

      calculatedExpiry.setMonth(
        calculatedExpiry.getMonth() +
          months
      );
    }

    this.plan = plan;

    this.billingCycle =
      plan === PLANS.AGENCY
        ? billingCycle || null
        : billingCycle;

    this.planStartedAt =
      now;

    this.planExpiresAt =
      calculatedExpiry;

    this.planCancelledAt =
      null;

    this.cancelAtPeriodEnd =
      false;

    this.subscriptionStatus =
      "active";

    this.paymentGateway =
      paymentGateway;

    this.lastPaymentId =
      paymentId;

    this.lastPaymentAt =
      paymentId ? now : null;

    if (
      paymentGateway ===
        "razorpay" &&
      subscriptionId
    ) {
      this.razorpaySubscriptionId =
        subscriptionId;
    }

    if (
      paymentGateway ===
        "stripe" &&
      subscriptionId
    ) {
      this.stripeSubscriptionId =
        subscriptionId;
    }

    return this;
  };

/* =========================================================
   METHOD: CANCEL PLAN
========================================================= */

userSchema.methods
  .cancelPlan =
  function ({
    atPeriodEnd = true,
  } = {}) {
    if (
      this.plan ===
      PLANS.FREE
    ) {
      this.subscriptionStatus =
        "expired";

      this.trialExpiresAt =
        new Date();

      this.planExpiresAt =
        new Date();

      return this;
    }

    this.planCancelledAt =
      new Date();

    this.cancelAtPeriodEnd =
      Boolean(atPeriodEnd);

    if (!atPeriodEnd) {
      this.subscriptionStatus =
        "cancelled";

      this.planExpiresAt =
        new Date();
    }

    return this;
  };

/* =========================================================
   METHOD: BLOCK USER
========================================================= */

userSchema.methods
  .blockUser =
  function (reason = "") {
    this.status =
      "Blocked";

    this.isBlocked =
      true;

    this.blockedAt =
      new Date();

    this.blockedReason =
      String(
        reason || ""
      ).trim();

    this.tokenVersion =
      Number(
        this.tokenVersion || 0
      ) + 1;

    return this;
  };

/* =========================================================
   METHOD: UNBLOCK USER
========================================================= */

userSchema.methods
  .unblockUser =
  function () {
    this.status =
      "Active";

    this.isBlocked =
      false;

    this.blockedAt =
      null;

    this.blockedReason =
      "";

    return this;
  };

/* =========================================================
   PRE-VALIDATE
========================================================= */

/* =========================================================
   PRE-VALIDATE
========================================================= */

userSchema.pre(
  "validate",
  function () {
    if (
      this.role ===
      ROLES.BRAND_CREATOR
    ) {
      if (
        !ALL_PLANS.includes(
          this.plan
        )
      ) {
        this.plan =
          PLANS.FREE;
      }

      /*
       Do not automatically mark Free as active.
       Free is a trial and must have valid trial dates.
      */
      if (
        this.plan ===
        PLANS.FREE
      ) {
        this.billingCycle =
          null;

        if (
          this.trialStartedAt &&
          this.trialExpiresAt
        ) {
          this.planStartedAt =
            this.trialStartedAt;

          this.planExpiresAt =
            this.trialExpiresAt;

          this.subscriptionStatus =
            this.isTrialActive
              ? "trialing"
              : "expired";
        } else {
          this.subscriptionStatus =
            "inactive";
        }
      }

      /*
       Expire paid plans automatically.
       Agency without planExpiresAt can stay active.
      */
      if (
        this.plan !==
          PLANS.FREE &&
        this.plan !==
          PLANS.AGENCY &&
        this.planExpiresAt &&
        new Date(
          this.planExpiresAt
        ).getTime() <=
          Date.now() &&
        this.subscriptionStatus ===
          "active"
      ) {
        this.subscriptionStatus =
          "expired";
      }

      if (
        this.plan ===
          PLANS.AGENCY &&
        this.subscriptionStatus ===
          "active"
      ) {
        this.billingCycle =
          this.billingCycle ||
          null;
      }
    } else {
      /*
       Non-brand-creator roles do not have plans.
      */
      this.plan =
        null;

      this.billingCycle =
        null;

      this.planStartedAt =
        null;

      this.planExpiresAt =
        null;

      this.planCancelledAt =
        null;

      this.cancelAtPeriodEnd =
        false;

      this.subscriptionStatus =
        "inactive";

      this.trialStartedAt =
        null;

      this.trialExpiresAt =
        null;

      this.isTrialUsed =
        false;

      this.trialPlan =
        null;

      this.paymentGateway =
        null;

      this.razorpayCustomerId =
        null;

      this.razorpaySubscriptionId =
        null;

      this.stripeCustomerId =
        null;

      this.stripeSubscriptionId =
        null;
    }

    if (this.isBlocked) {
      this.status =
        "Blocked";
    } else if (
      this.status ===
        "Blocked"
    ) {
      this.status =
        "Active";
    }
  }
);

/* =========================================================
   EXPORT
========================================================= */

module.exports =
  mongoose.models.User ||
  mongoose.model(
    "User",
    userSchema
  );