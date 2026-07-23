/* =========================================================
   PAYMENT GATEWAY
========================================================= */

exports.getGatewayByCountry = (
  country
) => {
  return country === "IN"
    ? "razorpay"
    : "stripe";
};

/* =========================================================
   PLAN PRICES
========================================================= */

const PRICES = {
  IN: {
    starter: {
      monthly: {
        amount: 1299,
        currency: "INR",
      },

      yearly: {
        amount: 12999,
        currency: "INR",
      },
    },

    pro: {
      monthly: {
        amount: 2499,
        currency: "INR",
      },

      yearly: {
        amount: 24999,
        currency: "INR",
      },
    },

    business: {
      monthly: {
        amount: 7999,
        currency: "INR",
      },

      yearly: {
        amount: 79999,
        currency: "INR",
      },
    },
  },

  DEFAULT: {
    starter: {
      monthly: {
        amount: 15,
        currency: "USD",
      },

      yearly: {
        amount: 150,
        currency: "USD",
      },
    },

    pro: {
      monthly: {
        amount: 29,
        currency: "USD",
      },

      yearly: {
        amount: 290,
        currency: "USD",
      },
    },

    business: {
      monthly: {
        amount: 99,
        currency: "USD",
      },

      yearly: {
        amount: 990,
        currency: "USD",
      },
    },
  },
};

/* =========================================================
   GET PLAN PRICE
========================================================= */

exports.getPlanPrice = (
  plan,
  billing = "monthly",
  country = "US"
) => {
  const normalizedPlan =
    String(plan || "")
      .trim()
      .toLowerCase();

  const normalizedBilling =
    String(
      billing || "monthly"
    )
      .trim()
      .toLowerCase();

  const region =
    country === "IN"
      ? PRICES.IN
      : PRICES.DEFAULT;

  const planPrices =
    region[normalizedPlan];

  if (!planPrices) {
    throw new Error(
      "Invalid subscription plan."
    );
  }

  const price =
    planPrices[
      normalizedBilling
    ];

  if (!price) {
    throw new Error(
      "Invalid billing cycle."
    );
  }

  return price;
};

/* =========================================================
   EXPORT PRICES FOR TESTING
========================================================= */

exports.PRICES = PRICES;