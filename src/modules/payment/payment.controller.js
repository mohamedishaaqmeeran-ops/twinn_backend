const crypto = require("crypto");
const axios = require("axios");
const Razorpay = require("razorpay");
const Stripe = require("stripe");

const User = require("../../models/User");
const Payment = require("../../models/Payment");

const {
  getGatewayByCountry,
  getPlanPrice,
} = require("./payment.service");

/* =========================================================
   PAYMENT CLIENTS
========================================================= */

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY
);

const razorpay = new Razorpay({
  key_id:
    process.env.RAZORPAY_KEY_ID,

  key_secret:
    process.env.RAZORPAY_KEY_SECRET,
});

/* =========================================================
   CONSTANTS
========================================================= */

const VALID_PLANS = [
  "starter",
  "pro",
  "business",
];

const VALID_BILLING_CYCLES = [
  "monthly",
  "yearly",
];

/* =========================================================
   HELPERS
========================================================= */

const normalizePlan = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase();
};

const normalizeBilling = (value) => {
  return String(
    value || "monthly"
  )
    .trim()
    .toLowerCase();
};

const getUserId = (req) => {
  return (
    req.user?._id ||
    req.user?.id ||
    req.user?.userId ||
    ""
  );
};

const getClientIp = (req) => {
  const forwarded =
    req.headers["x-forwarded-for"];

  if (forwarded) {
    return forwarded
      .split(",")[0]
      .trim();
  }

  return (
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    ""
  );
};

const getCountryFromIp = async (
  ip
) => {
  try {
    if (
      !ip ||
      ip === "::1" ||
      ip === "127.0.0.1"
    ) {
      return "IN";
    }

    const cleanIp = String(ip)
      .replace("::ffff:", "")
      .trim();

    const { data } =
      await axios.get(
        `http://ip-api.com/json/${cleanIp}`,
        {
          timeout: 5000,
        }
      );

    if (
      data?.status === "success" &&
      data?.countryCode
    ) {
      return String(
        data.countryCode
      ).toUpperCase();
    }

    return "US";
  } catch (error) {
    console.error(
      "COUNTRY DETECTION ERROR:",
      error.message
    );

    return "US";
  }
};

const validatePlanAndBilling = (
  plan,
  billing
) => {
  if (!VALID_PLANS.includes(plan)) {
    return {
      valid: false,
      message:
        "Invalid subscription plan.",
    };
  }

  if (
    !VALID_BILLING_CYCLES.includes(
      billing
    )
  ) {
    return {
      valid: false,
      message:
        "Invalid billing cycle.",
    };
  }

  return {
    valid: true,
  };
};

/* =========================================================
   CREATE CHECKOUT
========================================================= */

exports.createCheckout = async (
  req,
  res
) => {
  try {
    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

    const plan =
      normalizePlan(
        req.body.plan
      );

    const billing =
      normalizeBilling(
        req.body.billing
      );

    const validation =
      validatePlanAndBilling(
        plan,
        billing
      );

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message:
          validation.message,
      });
    }

    const currentUser =
      await User.findById(
        userId
      ).select(
        "name fullName email phone mobile plan"
      );

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message:
          "User account not found.",
      });
    }

    if (
      String(
        currentUser.plan || ""
      ).toLowerCase() === plan
    ) {
      return res.status(409).json({
        success: false,
        message:
          `You are already subscribed to the ${plan} plan.`,
      });
    }

    const ip =
      getClientIp(req);

    const country =
      await getCountryFromIp(
        ip
      );

    const gateway =
      getGatewayByCountry(
        country
      );

    const price =
      getPlanPrice(
        plan,
        billing,
        country
      );

    if (
      !price ||
      !price.amount ||
      !price.currency
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Pricing is unavailable for the selected plan.",
      });
    }

    /* =====================================================
       RAZORPAY CHECKOUT
    ===================================================== */

    if (
      gateway === "razorpay"
    ) {
      const receipt =
        `twinn_${Date.now()}_${String(
          userId
        ).slice(-6)}`;

      const order =
        await razorpay.orders.create({
          amount:
            Math.round(
              price.amount * 100
            ),

          currency:
            price.currency,

          receipt,

          notes: {
            userId:
              String(userId),

            plan,

            billing,

            country,
          },
        });

      const payment =
        await Payment.create({
          userId,

          plan,

          billing,

          gateway:
            "razorpay",

          amount:
            price.amount,

          currency:
            price.currency,

          country,

          orderId:
            order.id,

          status:
            "created",

          metadata: {
            receipt,

            razorpayOrderAmount:
              order.amount,
          },
        });

      return res.status(201).json({
        success: true,

        gateway:
          "razorpay",

        key:
          process.env
            .RAZORPAY_KEY_ID,

        orderId:
          order.id,

        paymentRecordId:
          payment._id,

        amount:
          order.amount,

        displayAmount:
          price.amount,

        currency:
          order.currency,

        plan,

        billing,

        country,

        user: {
          name:
            currentUser.fullName ||
            currentUser.name ||
            "",

          email:
            currentUser.email ||
            "",

          phone:
            currentUser.phone ||
            currentUser.mobile ||
            "",
        },
      });
    }

    /* =====================================================
       STRIPE CHECKOUT
    ===================================================== */

    const frontendUrl =
      String(
        process.env.FRONTEND_URL ||
          "https://twinn.live"
      ).replace(/\/$/, "");

    const session =
      await stripe.checkout.sessions.create({
        mode: "payment",

        payment_method_types: [
          "card",
        ],

        customer_email:
          currentUser.email ||
          undefined,

        line_items: [
          {
            price_data: {
              currency:
                price.currency.toLowerCase(),

              product_data: {
                name:
                  `Twinn ${
                    plan
                      .charAt(0)
                      .toUpperCase() +
                    plan.slice(1)
                  } Plan`,

                description:
                  billing ===
                  "yearly"
                    ? "Annual subscription"
                    : "Monthly subscription",
              },

              unit_amount:
                Math.round(
                  price.amount *
                    100
                ),
            },

            quantity: 1,
          },
        ],

        success_url:
          `${frontendUrl}/payment-success` +
          `?session_id={CHECKOUT_SESSION_ID}`,

        cancel_url:
          `${frontendUrl}/payment-failed`,

        metadata: {
          userId:
            String(userId),

          plan,

          billing,

          country,
        },

        payment_intent_data: {
          metadata: {
            userId:
              String(userId),

            plan,

            billing,

            country,
          },
        },
      });

    const payment =
      await Payment.create({
        userId,

        plan,

        billing,

        gateway:
          "stripe",

        amount:
          price.amount,

        currency:
          price.currency,

        country,

        sessionId:
          session.id,

        status:
          "created",

        metadata: {
          checkoutUrl:
            session.url,
        },
      });

    return res.status(201).json({
      success: true,

      gateway:
        "stripe",

      checkoutUrl:
        session.url,

      sessionId:
        session.id,

      paymentRecordId:
        payment._id,

      amount:
        price.amount,

      currency:
        price.currency,

      plan,

      billing,

      country,
    });
  } catch (error) {
    console.error(
      "CREATE CHECKOUT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to create payment checkout.",
    });
  }
};

/* =========================================================
   VERIFY RAZORPAY
========================================================= */

exports.verifyRazorpay = async (
  req,
  res
) => {
  try {
    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

    const plan =
      normalizePlan(
        req.body.plan
      );

    const billing =
      normalizeBilling(
        req.body.billing
      );

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const validation =
      validatePlanAndBilling(
        plan,
        billing
      );

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message:
          validation.message,
      });
    }

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Razorpay payment details are required.",
      });
    }

    const payment =
      await Payment.findOne({
        orderId:
          razorpay_order_id,

        userId,

        gateway:
          "razorpay",
      });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message:
          "Payment order not found.",
      });
    }

    if (
      payment.status === "paid"
    ) {
      const existingUser =
        await User.findById(
          userId
        ).select(
          "-passwordHash -verificationToken -resetToken"
        );

      return res.json({
        success: true,
        message:
          "Payment was already verified.",
        user:
          existingUser,
      });
    }

    if (
      payment.plan !== plan ||
      payment.billing !== billing
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment plan details do not match the created order.",
      });
    }

    const signatureBody =
      `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature =
      crypto
        .createHmac(
          "sha256",
          process.env
            .RAZORPAY_KEY_SECRET
        )
        .update(
          signatureBody
        )
        .digest("hex");

    const receivedBuffer =
      Buffer.from(
        String(
          razorpay_signature
        ),
        "utf8"
      );

    const expectedBuffer =
      Buffer.from(
        String(
          expectedSignature
        ),
        "utf8"
      );

    const signatureValid =
      receivedBuffer.length ===
        expectedBuffer.length &&
      crypto.timingSafeEqual(
        receivedBuffer,
        expectedBuffer
      );

    if (!signatureValid) {
      await Payment.findByIdAndUpdate(
        payment._id,
        {
          status:
            "failed",

          metadata: {
            ...payment.metadata,

            failureReason:
              "Invalid signature",
          },
        }
      );

      return res.status(400).json({
        success: false,
        message:
          "Invalid payment signature.",
      });
    }

    const razorpayPayment =
      await razorpay.payments.fetch(
        razorpay_payment_id
      );

    if (
      razorpayPayment.order_id !==
      razorpay_order_id
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Razorpay order mismatch.",
      });
    }

    if (
      ![
        "authorized",
        "captured",
      ].includes(
        razorpayPayment.status
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Payment is not completed. Current status: ${razorpayPayment.status}`,
      });
    }

    const session =
      await mongooseSession();

    let updatedUser;

    try {
      await session.withTransaction(
        async () => {
          await Payment.findByIdAndUpdate(
            payment._id,
            {
              paymentId:
                razorpay_payment_id,

              status:
                "paid",

              metadata: {
                ...payment.metadata,

                razorpayStatus:
                  razorpayPayment.status,

                verifiedAt:
                  new Date(),
              },
            },
            {
              session,
            }
          );

          updatedUser =
            await User.findByIdAndUpdate(
              userId,
              {
                plan,

                billingCycle:
                  billing,

                planStartedAt:
                  new Date(),

                planExpiresAt:
                  calculatePlanExpiry(
                    billing
                  ),
              },
              {
                new: true,
                session,
              }
            ).select(
              "-passwordHash -verificationToken -resetToken"
            );
        }
      );
    } finally {
      await session.endSession();
    }

    return res.json({
      success: true,

      message:
        "Payment verified. Plan upgraded successfully.",

      user:
        updatedUser,
    });
  } catch (error) {
    console.error(
      "RAZORPAY VERIFY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to verify Razorpay payment.",
    });
  }
};

/* =========================================================
   STRIPE WEBHOOK
========================================================= */

exports.stripeWebhook = async (
  req,
  res
) => {
  try {
    const signature =
      req.headers[
        "stripe-signature"
      ];

    if (
      !process.env
        .STRIPE_WEBHOOK_SECRET
    ) {
      return res.status(500).json({
        success: false,
        message:
          "Stripe webhook secret is not configured.",
      });
    }

    if (!signature) {
      return res.status(400).json({
        success: false,
        message:
          "Stripe signature is missing.",
      });
    }

    const event =
      stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env
          .STRIPE_WEBHOOK_SECRET
      );

    if (
      event.type ===
      "checkout.session.completed"
    ) {
      const checkoutSession =
        event.data.object;

      const userId =
        checkoutSession.metadata
          ?.userId;

      const plan =
        normalizePlan(
          checkoutSession.metadata
            ?.plan
        );

      const billing =
        normalizeBilling(
          checkoutSession.metadata
            ?.billing
        );

      if (
        !userId ||
        !VALID_PLANS.includes(plan)
      ) {
        throw new Error(
          "Invalid Stripe checkout metadata."
        );
      }

      const payment =
        await Payment.findOne({
          sessionId:
            checkoutSession.id,

          gateway:
            "stripe",
        });

      if (!payment) {
        throw new Error(
          "Stripe payment record not found."
        );
      }

      if (
        payment.status !== "paid"
      ) {
        const session =
          await mongooseSession();

        try {
          await session.withTransaction(
            async () => {
              await Payment.findByIdAndUpdate(
                payment._id,
                {
                  status:
                    "paid",

                  paymentId:
                    checkoutSession.payment_intent,

                  metadata: {
                    ...payment.metadata,

                    stripePaymentStatus:
                      checkoutSession.payment_status,

                    completedAt:
                      new Date(),
                  },
                },
                {
                  session,
                }
              );

              await User.findByIdAndUpdate(
                userId,
                {
                  plan,

                  billingCycle:
                    billing,

                  planStartedAt:
                    new Date(),

                  planExpiresAt:
                    calculatePlanExpiry(
                      billing
                    ),
                },
                {
                  session,
                }
              );
            }
          );
        } finally {
          await session.endSession();
        }
      }
    }

    if (
      event.type ===
      "checkout.session.expired"
    ) {
      const checkoutSession =
        event.data.object;

      await Payment.findOneAndUpdate(
        {
          sessionId:
            checkoutSession.id,
        },
        {
          status:
            "cancelled",
        }
      );
    }

    if (
      event.type ===
      "payment_intent.payment_failed"
    ) {
      const paymentIntent =
        event.data.object;

      await Payment.findOneAndUpdate(
        {
          paymentId:
            paymentIntent.id,
        },
        {
          status:
            "failed",

          metadata: {
            failureMessage:
              paymentIntent
                .last_payment_error
                ?.message ||
              "Stripe payment failed",
          },
        }
      );
    }

    return res.json({
      received: true,
    });
  } catch (error) {
    console.error(
      "STRIPE WEBHOOK ERROR:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Stripe webhook processing failed.",
    });
  }
};

/* =========================================================
   SUBSCRIPTION HELPERS
========================================================= */

const mongooseSession = async () => {
  return User.startSession();
};

const calculatePlanExpiry = (
  billing
) => {
  const expiry =
    new Date();

  if (billing === "yearly") {
    expiry.setFullYear(
      expiry.getFullYear() + 1
    );
  } else {
    expiry.setMonth(
      expiry.getMonth() + 1
    );
  }

  return expiry;
};