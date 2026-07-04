// modules/payment/payment.service.js

exports.getGatewayByCountry = (country) => {
  if (country === "IN") return "razorpay";

  return "stripe";
};

exports.getPlanPrice = (plan, country) => {
  const prices = {
    IN: {
      pro: {
        amount: 2499,
        currency: "INR",
      },
      business: {
        amount: 7999,
        currency: "INR",
      },
    },

    DEFAULT: {
      pro: {
        amount: 29,
        currency: "USD",
      },
      business: {
        amount: 99,
        currency: "USD",
      },
    },
  };

  return country === "IN" ? prices.IN[plan] : prices.DEFAULT[plan];
};