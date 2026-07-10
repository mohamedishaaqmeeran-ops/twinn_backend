const Razorpay = require("razorpay");
const Stripe = require("stripe");
const crypto = require("crypto");
const axios = require("axios");

const User = require("../../models/User");
const Payment = require("../../models/Payment");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();

  return (
    req.headers["x-real-ip"] ||
    req.socket.remoteAddress ||
    req.connection?.remoteAddress ||
    ""
  );
};

const getCountryFromIp = async (ip) => {
  try {
    if (!ip || ip === "::1" || ip === "127.0.0.1") {
      return "IN"; // local testing default
    }

    const cleanIp = ip.replace("::ffff:", "");
    const { data } = await axios.get(`http://ip-api.com/json/${cleanIp}`);

    return data?.countryCode || "US";
  } catch {
    return "US";
  }
};

const getPrice = (plan, billing = "monthly", country) => {
  const prices = {
    IN: {
      pro: {
        monthly: 2499,
        yearly: 24999,
      },
      business: {
        monthly: 7999,
        yearly: 79999,
      },
    },

    DEFAULT: {
      pro: {
        monthly: 29,
        yearly: 290,
      },
      business: {
        monthly: 99,
        yearly: 990,
      },
    },
  };

  const region = country === "IN" ? prices.IN : prices.DEFAULT;

  if (!region[plan]) {
    throw new Error("Invalid plan");
  }

  return {
    amount: region[plan][billing],
    currency: country === "IN" ? "INR" : "USD",
  };
};

exports.createCheckout = async (req, res) => {
  try {
    const { plan, billing = "monthly" } = req.body;

   if (
  !["pro", "business"].includes(plan) ||
  !["monthly", "yearly"].includes(billing)
) {
  return res.status(400).json({
    success: false,
    message: "Invalid plan or billing cycle",
  });
}

    const ip = getClientIp(req);
    const country = await getCountryFromIp(ip);
    const price = getPrice(plan, billing, country);

    if (country === "IN") {
      const order = await razorpay.orders.create({
        amount: price.amount * 100,
        currency: price.currency,
        receipt: `twinn_${Date.now()}`,
        notes: {
  userId: req.user.id,
  plan,
  billing,
  country,
},
      });

      await Payment.create({
  userId: req.user.id,
  plan,
  billing,
  gateway: "razorpay",
  amount: price.amount,
  currency: price.currency,
  country,
  orderId: order.id,
  status: "created",
});

      return res.json({
  success: true,
  gateway: "razorpay",
  key: process.env.RAZORPAY_KEY_ID,
  orderId: order.id,
  amount: order.amount,
  currency: order.currency,
  plan,
  billing,
  country,
});
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: price.currency.toLowerCase(),
            product_data: {
              name: `Twinn ${plan} Plan`,
            },
            unit_amount: price.amount * 100,
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment-failed`,
     metadata: {
  userId: req.user.id,
  plan,
  billing,
  country,
},
    });

    await Payment.create({
  userId: req.user.id,
  plan,
  billing,
  gateway: "stripe",
  amount: price.amount,
  currency: price.currency,
  country,
  sessionId: session.id,
  status: "created",
});

   return res.json({
  success: true,
  gateway: "stripe",
  checkoutUrl: session.url,
  billing,
  country,
});
  } catch (error) {
    console.log("CREATE CHECKOUT ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.verifyRazorpay = async (req, res) => {
  try {
    const {
      plan,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!["pro", "business"].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan",
      });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    await Payment.findOneAndUpdate(
      { orderId: razorpay_order_id },
      {
        paymentId: razorpay_payment_id,
        status: "success",
      },
      { new: true }
    );

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { plan },
      { new: true }
    ).select("-passwordHash -verificationToken -resetToken");

    res.json({
      success: true,
      message: "Payment verified. Plan upgraded.",
      user,
    });
  } catch (error) {
    console.log("RAZORPAY VERIFY ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.stripeWebhook = async (req, res) => {
  try {
    let event = req.body;

    if (process.env.STRIPE_WEBHOOK_SECRET) {
      const signature = req.headers["stripe-signature"];

      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const userId = session.metadata.userId;
      const plan = session.metadata.plan;

      await Payment.findOneAndUpdate(
        { sessionId: session.id },
        {
          status: "success",
          paymentId: session.payment_intent,
        },
        { new: true }
      );

      await User.findByIdAndUpdate(userId, { plan });
    }

    res.json({ received: true });
  } catch (error) {
    console.log("STRIPE WEBHOOK ERROR:", error.message);

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};