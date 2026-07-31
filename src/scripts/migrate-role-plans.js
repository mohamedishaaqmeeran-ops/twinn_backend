require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

const run = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const clearNonBrandPlans = await User.updateMany(
    { role: { $ne: "brandcreator" } },
    {
      $set: {
        plan: null,
        billingCycle: null,
        planStartedAt: null,
        planExpiresAt: null,
        planCancelledAt: null,
        cancelAtPeriodEnd: false,
        subscriptionStatus: null,
        trialStartedAt: null,
        trialExpiresAt: null,
        trialPlan: null,
        isTrialUsed: false,
        paymentGateway: null,
        razorpayCustomerId: null,
        razorpaySubscriptionId: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        lastPaymentId: null,
        lastPaymentAt: null,
      },
    }
  );

  const initializeBrandPlans = await User.updateMany(
    {
      role: "brandcreator",
      $or: [{ plan: null }, { plan: { $exists: false } }],
    },
    {
      $set: {
        plan: "free",
        subscriptionStatus: "active",
      },
    }
  );

  console.log({
    nonBrandUsersUpdated: clearNonBrandPlans.modifiedCount,
    brandCreatorsUpdated: initializeBrandPlans.modifiedCount,
  });

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("MIGRATION ERROR:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
